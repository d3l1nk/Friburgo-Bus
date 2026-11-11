import { httpRequest } from '../lib/http';
import { recordDebug } from '../lib/debug';
import { getJSON, listKeys, removeKey, setJSON } from '../lib/storage';
import { CIRCULAR_TABLE_LINES, findLine, isKnownKey, resolveLineKey } from '../data/faolLines';
import type {
  AlertsCache,
  DayCode,
  Departure,
  FaolAlert,
  Timetable,
  TimetableColumn,
  TimetableResult,
} from '../types';

export const FAOL_HORARIOS_URL = 'https://www.faol.com.br/horarios';
export const faolTableUrl = (code: string, day: DayCode) =>
  `https://www.faol.com.br/tabelas/${code}-${day}`;

const ALERTS_KEY = 'faol:alerts:v2';
const LINKS_KEY = 'faol:links:v2';
const TABLE_PREFIX = 'faol:table:v2:';
const TABLE_MAX_AGE_MS = 24 * 3600 * 1000;

const HEADERS = {
  accept: 'text/html,application/xhtml+xml,application/pdf,*/*',
  'accept-language': 'pt-BR,pt;q=0.9',
  'user-agent':
    'Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
  Referer: 'https://www.faol.com.br/horarios',
};

type LinkMap = Record<string, Partial<Record<DayCode, string>>>;
let memoryLinks: LinkMap | null = null;

const BLOCK = new Set([
  'P', 'DIV', 'LI', 'UL', 'OL', 'TR', 'TABLE', 'TBODY', 'THEAD', 'TFOOT',
  'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'SECTION', 'ARTICLE', 'HEADER',
  'FOOTER', 'BR', 'HR', 'DT', 'DD', 'BLOCKQUOTE', 'FORM', 'MAIN', 'ASIDE', 'NAV',
]);

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
const norm = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function parseHtml(html: string): Document {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script,style,noscript,svg').forEach((n) => n.remove());
  return doc;
}

function textLines(root: Node): string[] {
  const out: string[] = [];
  let buf = '';
  const flush = () => {
    const t = clean(buf);
    if (t) out.push(t);
    buf = '';
  };
  const walk = (n: Node) => {
    if (n.nodeType === Node.TEXT_NODE) {
      buf += ' ' + (n.nodeValue ?? '');
      return;
    }
    if (n.nodeType !== Node.ELEMENT_NODE) return;
    const el = n as Element;
    const isBlock = BLOCK.has(el.tagName);
    if (isBlock) flush();
    el.childNodes.forEach(walk);
    if (isBlock) flush();
  };
  walk(root);
  flush();
  return out;
}

// =====================================================================
// Alertas e Mapeamento de Links Reais em /horarios
// =====================================================================
const ALERT_RE = /^(ALTERA[ÇC][ÃA]O|ATEN[ÇC][ÃA]O)\b\s*[:!\-–—.]*\s*(.*)$/i;
const CODE_RE = /(?<!\d)(\d{2,3}[A-Za-z]?)(?!\d)/g;

function kindOf(s: string): 'ALTERAÇÃO' | 'ATENÇÃO' {
  return /^altera/i.test(norm(s)) ? 'ALTERAÇÃO' : 'ATENÇÃO';
}

function keyFromStrings(candidates: (string | null | undefined)[]): string {
  for (const s of candidates) {
    if (!s) continue;
    for (const m of s.matchAll(CODE_RE)) {
      const k = resolveLineKey(m[1]);
      if (k && isKnownKey(k)) return k;
    }
  }
  return '';
}

function alertsFromLines(lines: string[], key: string | (() => string)): FaolAlert[] {
  const out: FaolAlert[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(ALERT_RE);
    if (!m) continue;
    let text = m[2];
    let j = i + 1;
    while (j < lines.length && j <= i + 3 && !ALERT_RE.test(lines[j]) && !/selecione o hor/i.test(lines[j])) {
      text = text ? `${text} ${lines[j]}` : lines[j];
      j++;
    }
    text = clean(text);
    const k = typeof key === 'function' ? key() : key;
    if (text && k) out.push({ lineKey: k, kind: kindOf(m[1]), text });
  }
  return out;
}

/** Extrai o mapa de URLs exatas dos botões (Dias Úteis, Sábado, Domingo, Circular) da FAOL */
export function extractTableLinks(html: string): LinkMap {
  const doc = parseHtml(html);
  const map: LinkMap = {};

  doc.querySelectorAll('a[href]').forEach((a) => {
    const rawHref = a.getAttribute('href')?.trim() ?? '';
    if (!rawHref || rawHref.startsWith('#') || rawHref.startsWith('javascript')) return;

    const label = norm(a.textContent ?? '');
    let day: DayCode | null = null;
    if (label.includes('uteis') || label.includes('úteis') || label.includes('util')) day = 'U';
    else if (label.includes('sabado') || label.includes('sábado')) day = 'S';
    else if (label.includes('domingo') || label.includes('feriado')) day = 'D';
    else if (label.includes('circular')) day = 'C';

    const urlMatch = rawHref.match(/tabelas\/([^/?#]+?)(?:[-_]([USDCusdc]))?(?:\.pdf|\.html|\.php)?$/);
    if (!day && urlMatch?.[2]) {
      day = urlMatch[2].toUpperCase() as DayCode;
    }
    if (!day) return;

    const modal = a.closest('.modal, [role="dialog"], [id*="modal" i], div');
    const heads = modal
      ? [...modal.querySelectorAll('.modal-title, h1, h2, h3, h4, h5, h6')].map((h) => h.textContent)
      : [];
    const k = keyFromStrings([
      urlMatch?.[1],
      modal?.id,
      ...heads,
    ]);
    if (!k) return;

    const fullUrl = rawHref.startsWith('http')
      ? rawHref
      : `https://www.faol.com.br/${rawHref.replace(/^\/+/, '')}`;

    map[k] = map[k] ?? {};
    map[k]![day] = fullUrl;
  });

  return map;
}

export function parseAlerts(html: string): FaolAlert[] {
  const doc = parseHtml(html);
  const found: FaolAlert[] = [];

  const all = [...doc.querySelectorAll('.modal, [role="dialog"], [id*="modal" i]')];
  const containers = all.filter((c) => !all.some((o) => o !== c && o.contains(c)));
  for (const c of containers) {
    const lines = textLines(c);
    const heads = [...c.querySelectorAll('.modal-title, h1, h2, h3, h4, h5, h6')].map((h) => h.textContent);
    const key = keyFromStrings([
      c.id,
      c.getAttribute('data-linha'),
      c.getAttribute('data-line'),
      c.getAttribute('aria-labelledby'),
      ...heads,
      ...lines.slice(0, 3),
    ]);
    if (key) found.push(...alertsFromLines(lines, key));
  }

  if (!found.length) {
    const lines = textLines(doc.body);
    let current = '';
    const hdr = /^(?:linha\s*)?(\d{2,3}[A-Za-z]?)\s*[-–—:.]?\s+(.+)$/i;
    const getKey = () => current;
    for (let i = 0; i < lines.length; i++) {
      const h = lines[i].match(hdr);
      if (h) {
        const k = resolveLineKey(h[1]);
        const line = k && isKnownKey(k) ? findLine(k) : undefined;
        const first = line ? norm(line.name).split(/[ /]/)[0] : '';
        if (line && first && norm(h[2]).includes(first)) current = k;
      }
      if (ALERT_RE.test(lines[i])) found.push(...alertsFromLines(lines.slice(i, i + 5), getKey));
    }
  }

  const seen = new Set<string>();
  return found.filter((a) => {
    const id = `${a.lineKey}|${norm(a.text)}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

async function fetchHtml(debugKey: string, url: string, summarize: (html: string) => unknown) {
  const res = await httpRequest<string>({ url, method: 'GET', headers: HEADERS, responseType: 'text' });
  const html = typeof res.data === 'string' ? res.data : '';
  recordDebug(debugKey, {
    label: url,
    at: Date.now(),
    url,
    method: 'GET',
    status: res.status,
    ms: res.ms,
    ok: res.ok,
    error: res.error,
    data: res.ok
      ? { htmlLength: html.length, parsed: summarize(html), htmlPreview: html.slice(0, 12000) }
      : res.data,
  });
  return { res, html };
}

export interface AlertsResult {
  alerts: FaolAlert[];
  fromCache: boolean;
  savedAt: number;
  error?: string;
}

export async function getAlerts(): Promise<AlertsResult> {
  const cache = await getJSON<AlertsCache>(ALERTS_KEY);
  const { res, html } = await fetchHtml('faol-alerts', FAOL_HORARIOS_URL, (h) => parseAlerts(h));
  if (!res.ok || !html) {
    return {
      alerts: cache?.alerts ?? [],
      fromCache: true,
      savedAt: cache?.savedAt ?? 0,
      error: res.error ?? 'Sem resposta',
    };
  }
  const alerts = parseAlerts(html);
  const links = extractTableLinks(html);
  if (Object.keys(links).length > 0) {
    memoryLinks = links;
    await setJSON(LINKS_KEY, links);
  }
  const entry: AlertsCache = { savedAt: Date.now(), alerts };
  await setJSON(ALERTS_KEY, entry);
  return { alerts, fromCache: false, savedAt: entry.savedAt };
}

export async function getCachedAlerts(): Promise<AlertsCache | null> {
  return getJSON<AlertsCache>(ALERTS_KEY);
}

// =====================================================================
// Parser Avançado de Tabelas (Suporta Cabeçalho Duplo, HTML e PDF/Texto)
// =====================================================================
const HOUR_COL_RE = /faixa|hor[aá]ri[oa]|^hora$/i;
const TERMINAL_RE = /esta[cç][aã]o\s*livre|terminal|centro|rodovi[aá]ria/i;

function cleanOrigin(s: string, index: number): string {
  const cleaned = clean(
    s
      .replace(/partidas?\s*de\s*:?/gi, '')
      .replace(/faixa\s*hor[aá]ria/gi, '')
      .replace(/hor[aá]rios?/gi, ''),
  );
  return cleaned || `Sentido ${index}`;
}

/** Extrai horários de uma célula ("00 15 30A 45-B" ou "04:15 04:45") */
function tokenizeCell(text: string, rowHour: number | null): Departure[] {
  const out: Departure[] = [];
  const cleaned = text.replace(/\b24:/g, '00:');
  const re = /(?:(\d{1,2})\s*[:hH]\s*)?(\d{2})(?!\d)(?:\s*[-–/(]?\s*([A-Za-z])(?![A-Za-z]))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cleaned))) {
    const h = m[1] !== undefined ? parseInt(m[1], 10) : rowHour;
    const min = parseInt(m[2], 10);
    if (h === null || h < 0 || h > 29 || min < 0 || min > 59) continue;
    const hh = h % 24;
    out.push({
      time: `${String(hh).padStart(2, '0')}:${String(min).padStart(2, '0')}`,
      minutes: hh * 60 + min,
      ramal: m[3] ? m[3].toUpperCase() : undefined,
    });
  }
  return out;
}

/** Expansão de células com colspan para alinhar cabeçalhos duplos */
function expandRowCells(row: Element): string[] {
  const out: string[] = [];
  row.querySelectorAll('th,td').forEach((cell) => {
    const txt = clean(cell.textContent ?? '');
    const span = Math.max(1, parseInt(cell.getAttribute('colspan') ?? '1', 10) || 1);
    for (let i = 0; i < span; i++) out.push(txt);
  });
  return out;
}

function isDataRow(cells: string[]): boolean {
  if (!cells.length) return false;
  // Uma linha de dados começa com faixa horária (ex: "04:00", "04", "05:00") ou possui horários HH:MM nas células
  const timeCells = cells.filter((c) => /\b\d{1,2}[:hH]\d{2}\b/.test(c) || /^\d{2}(\s*[-A-Z])?$/.test(c));
  return timeCells.length >= 1 && /^\d{1,2}(:\d{2})?$/.test(cells[0] ?? '');
}

function parseTableElement(table: HTMLTableElement): TimetableColumn[] {
  const rows = [...table.querySelectorAll('tr')];
  if (rows.length < 2) return [];

  const expandedRows = rows.map(expandRowCells).filter((r) => r.some(Boolean));
  if (expandedRows.length < 2) return [];

  // Descobre onde começam as linhas de horários (após 1, 2 ou 3 linhas de cabeçalho)
  let firstBodyIdx = expandedRows.findIndex(isDataRow);
  if (firstBodyIdx <= 0) firstBodyIdx = 1;

  const headerRows = expandedRows.slice(0, firstBodyIdx);
  const bodyRows = expandedRows.slice(firstBodyIdx);

  const maxCols = Math.max(...expandedRows.map((r) => r.length));
  const combinedHeaders: string[] = [];

  for (let colIdx = 0; colIdx < maxCols; colIdx++) {
    const parts = headerRows
      .map((r) => r[colIdx] ?? '')
      .filter((val) => val && !/^partidas?\s*de:?$/i.test(val) && !/^faixa$/i.test(val));
    const rawHeader = parts[parts.length - 1] || headerRows[headerRows.length - 1]?.[colIdx] || '';
    combinedHeaders.push(rawHeader);
  }

  let hourCol = combinedHeaders.findIndex((h) => HOUR_COL_RE.test(h));
  if (hourCol < 0 && headerRows.some((r) => HOUR_COL_RE.test(r[0] ?? ''))) {
    hourCol = 0;
  }

  // Verifica se todas as células de dados já trazem hora completa HH:MM
  const hasFullTimesInBody = bodyRows.some((r) =>
    r.slice(1).some((c) => /\b\d{1,2}:\d{2}\b/.test(c)),
  );
  if (hourCol < 0 && hasFullTimesInBody && bodyRows.every((r) => /^\d{2}:00$/.test(r[0] ?? ''))) {
    hourCol = 0;
  }

  const caption = clean(table.querySelector('caption')?.textContent ?? '');
  const cols = new Map<number, Departure[]>();

  for (const cells of bodyRows) {
    const hm = hourCol >= 0 ? (cells[hourCol] ?? '').match(/(\d{1,2})/) : null;
    const rowHour = hm ? parseInt(hm[1], 10) : null;

    cells.forEach((txt, j) => {
      if (j === hourCol || !txt) return;
      const deps = tokenizeCell(txt, rowHour);
      if (deps.length) cols.set(j, [...(cols.get(j) ?? []), ...deps]);
    });
  }

  const result: TimetableColumn[] = [];
  cols.forEach((deps, j) => {
    const rawOrigin = combinedHeaders[j] || caption || '';
    const origin = cleanOrigin(rawOrigin, j);
    const uniq = new Map<string, Departure>();
    deps.forEach((d) => uniq.set(`${d.time}${d.ramal ?? ''}`, d));
    result.push({
      origin,
      isTerminal: TERMINAL_RE.test(origin),
      departures: [...uniq.values()].sort((a, b) => a.minutes - b.minutes),
    });
  });

  return result;
}

/** Parser de tabelas em texto plano / PDF extraído (quando não há <table> HTML) */
function parseStructuredTextLines(lines: string[]): TimetableColumn[] {
  // Procura cabeçalhos entre "Horária" e o primeiro horário "04:00" / "05:00"
  const horariaIdx = lines.findIndex((l) => /^hor[aá]ria$/i.test(l));
  const firstHourIdx = lines.findIndex(
    (l, idx) => idx > Math.max(0, horariaIdx) && /^0[3456]:00$/.test(l),
  );

  let origins: string[] = [];
  if (horariaIdx >= 0 && firstHourIdx > horariaIdx + 1) {
    origins = lines
      .slice(horariaIdx + 1, firstHourIdx)
      .filter((l) => !/partidas|faixa/i.test(l));
  }

  if (!origins.length) {
    origins = ['Estação Livre', 'Bairro'];
  }

  const bucket = new Map<string, Departure[]>();
  origins.forEach((o) => bucket.set(o, []));

  const startIdx = firstHourIdx >= 0 ? firstHourIdx : 0;
  let colCursor = -1; // -1 = coluna "Faixa Horária" (ex: 04:00, 05:00)

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(/^([01]?\d|2[0-3]):([0-5]\d)(?:\s*[-–]?\s*([A-Za-z]))?$/);
    if (!m) continue;

    const hh = parseInt(m[1], 10);
    const mm = parseInt(m[2], 10);
    const time = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;

    // Se for HH:00 na abertura de uma nova faixa horária e o próximo item também estiver na mesma hora
    const nextLine = lines[i + 1] ?? '';
    const nextMatch = nextLine.match(/^([01]?\d|2[0-3]):([0-5]\d)/);
    if (mm === 0 && nextMatch && parseInt(nextMatch[1], 10) === hh && colCursor !== 0) {
      colCursor = 0;
      continue;
    }

    const targetOrigin = origins[Math.max(0, colCursor) % origins.length];
    bucket.get(targetOrigin)?.push({
      time,
      minutes: hh * 60 + mm,
      ramal: m[3]?.toUpperCase(),
    });
    colCursor = (Math.max(0, colCursor) + 1) % origins.length;
  }

  return [...bucket.entries()]
    .filter(([, deps]) => deps.length > 0)
    .map(([origin, deps]) => {
      const uniq = new Map<string, Departure>();
      deps.forEach((d) => uniq.set(`${d.time}${d.ramal ?? ''}`, d));
      return {
        origin,
        isTerminal: TERMINAL_RE.test(origin),
        departures: [...uniq.values()].sort((a, b) => a.minutes - b.minutes),
      };
    });
}

function parseLegend(lines: string[], code: string): { code: string; label: string }[] {
  const out = new Map<string, string>();
  const base = resolveLineKey(code);
  for (const l of lines) {
    const sub = l.match(/^(\d{2,3}[A-Za-z]?\s*-\s*[A-Za-z])\s*[-–:]?\s+(\p{L}.{2,})$/u);
    if (sub) {
      out.set(sub[1].replace(/\s+/g, ''), sub[2]);
      continue;
    }
    const main = l.match(/^(\d{2,3}[A-Za-z]?)\s+(\p{L}{3}.*)$/u);
    if (main && resolveLineKey(main[1]) === base && !/partidas|faixa/i.test(l)) {
      out.set(main[1], main[2]);
    }
  }
  return [...out.entries()].map(([c, label]) => ({ code: c, label }));
}

export function parseTimetable(html: string, code: string, day: DayCode): Timetable {
  const doc = parseHtml(html);
  const lines = textLines(doc.body);

  let columns: TimetableColumn[] = [];
  doc.querySelectorAll('table').forEach((t) => {
    columns.push(...parseTableElement(t as HTMLTableElement));
  });

  // Mescla colunas com exatamente a mesma origem
  const merged = new Map<string, TimetableColumn>();
  columns.forEach((c) => {
    const prev = merged.get(c.origin);
    if (prev) {
      const u = new Map<string, Departure>();
      [...prev.departures, ...c.departures].forEach((d) =>
        u.set(`${d.time}${d.ramal ?? ''}`, d),
      );
      prev.departures = [...u.values()].sort((a, b) => a.minutes - b.minutes);
    } else {
      merged.set(c.origin, { ...c });
    }
  });
  columns = [...merged.values()].filter((c) => c.departures.length > 0);

  let rawText: string | undefined;
  if (!columns.length) {
    columns = parseStructuredTextLines(lines);
  }

  if (!columns.length) {
    const times: Departure[] = [];
    const re = /\b([01]?\d|2[0-3]):([0-5]\d)\b/g;
    lines.join('\n').replace(re, (_m, h, m) => {
      const hh = parseInt(h, 10);
      const mm = parseInt(m, 10);
      times.push({
        time: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`,
        minutes: hh * 60 + mm,
      });
      return '';
    });
    if (times.length) {
      const u = new Map(times.map((d) => [d.time, d]));
      columns = [
        {
          origin: 'Horários de Partida',
          isTerminal: true,
          departures: [...u.values()].sort((a, b) => a.minutes - b.minutes),
        },
      ];
    } else {
      rawText = lines.join('\n').slice(0, 6000);
    }
  }

  columns.sort((a, b) => Number(b.isTerminal) - Number(a.isTerminal));
  return { code, day, fetchedAt: Date.now(), columns, legend: parseLegend(lines, code), rawText };
}

const tableKey = (code: string, day: DayCode) => `${TABLE_PREFIX}${code}-${day}`;

/** Gera lista de URLs candidatas para garantir que nenhuma linha falhe */
async function candidateUrlsFor(code: string, day: DayCode): Promise<string[]> {
  if (!memoryLinks) {
    memoryLinks = (await getJSON<LinkMap>(LINKS_KEY)) ?? {};
  }
  const k = resolveLineKey(code);
  const fromModal = memoryLinks[k]?.[day];

  const stripped = code.replace(/^0+/, '');
  const candidates = [
    fromModal,
    `https://www.faol.com.br/tabelas/${code}-${day}`,
    `https://faol.com.br/tabelas/${code}-${day}`,
    stripped !== code ? `https://www.faol.com.br/tabelas/${stripped}-${day}` : undefined,
    // Linhas circulares (100, 200, 400, 500) muitas vezes usam sufixo -C ou código direto
    day !== 'C' && ['100', '200', '400', '500'].includes(code)
      ? `https://www.faol.com.br/tabelas/${code}-C`
      : undefined,
    day !== 'U' && ['100', '200', '400', '500'].includes(code)
      ? `https://www.faol.com.br/tabelas/${code}-U`
      : undefined,
  ].filter(Boolean) as string[];

  return [...new Set(candidates)];
}

export async function getTimetable(
  code: string,
  day: DayCode,
  force = false,
): Promise<TimetableResult> {
  const cached = await getJSON<Timetable>(tableKey(code, day));
  if (cached && !force && Date.now() - cached.fetchedAt < TABLE_MAX_AGE_MS) {
    return { table: cached, fromCache: true };
  }

  // Tratamento especial documentado pela FAOL: Linha 54 aos Domingos
  if (code === '54' && day === 'D') {
    return {
      table: null,
      fromCache: false,
      error:
        'Aos domingos e feriados, o atendimento da linha 54 (Pilões) é feito pelas linhas 53 (Conquista), 55 (São Lourenço) e 500 (Circular). Consulte Dias Úteis/Sábado ou abra as linhas 53/55.',
    };
  }

  const urls = await candidateUrlsFor(code, day);
  let lastError = 'Tabela não encontrada para este dia.';

  for (const url of urls) {
    const { res, html } = await fetchHtml(`faol-table`, url, (h) => {
      const t = parseTimetable(h, code, day);
      return {
        columns: t.columns.map((c) => ({
          origin: c.origin,
          isTerminal: c.isTerminal,
          count: c.departures.length,
        })),
        legend: t.legend,
      };
    });

    if (res.ok && html) {
      const table = parseTimetable(html, code, day);
      const hasData = table.columns.some((c) => c.departures.length > 0);
      if (hasData) {
        await setJSON(tableKey(code, day), table);
        return { table, fromCache: false };
      }
    }
    lastError =
      res.status === 404
        ? 'A FAOL não disponibiliza tabela para esta linha neste dia da semana.'
        : `Falha ao consultar tabela (${res.error ?? 'HTTP ' + res.status}).`;
  }

  if (cached) return { table: cached, fromCache: true };
  return { table: null, fromCache: false, error: lastError };
}

export function daysForLine(code: string): DayCode[] {
  if (code === '54') return ['U', 'S', 'C', 'D'];
  return CIRCULAR_TABLE_LINES.has(code) ? ['U', 'S', 'D', 'C'] : ['U', 'S', 'D'];
}

export async function downloadAllDays(code: string): Promise<{ ok: number; total: number }> {
  const days = daysForLine(code);
  let ok = 0;
  for (const d of days) {
    const r = await getTimetable(code, d, true);
    if (r.table && r.table.columns.some((c) => c.departures.length) && !r.fromCache) ok++;
  }
  return { ok, total: days.length };
}

export async function listCachedTables(): Promise<string[]> {
  const keys = await listKeys(TABLE_PREFIX);
  return keys.map((k) => k.slice(TABLE_PREFIX.length));
}

export async function clearCachedTables(): Promise<void> {
  const keys = await listKeys(TABLE_PREFIX);
  await Promise.all(keys.map(removeKey));
}

export interface NextByColumn {
  origin: string;
  isTerminal: boolean;
  next?: Departure;
  after?: Departure;
  minutesLeft?: number;
}

export function nextByColumn(table: Timetable, nowMin: number): NextByColumn[] {
  return table.columns.map((c) => {
    const upcoming = c.departures.filter((d) => d.minutes >= Math.floor(nowMin));
    const next = upcoming.find((d) => d.minutes >= nowMin) ?? c.departures[0];
    const isTomorrow = next && next.minutes < nowMin;
    const idx = next ? c.departures.indexOf(next) : -1;
    const diff = next
      ? isTomorrow
        ? 1440 - nowMin + next.minutes
        : next.minutes - nowMin
      : undefined;
    return {
      origin: c.origin,
      isTerminal: c.isTerminal,
      next,
      after: idx >= 0 ? c.departures[(idx + 1) % c.departures.length] : undefined,
      minutesLeft: diff,
    };
  });
}
