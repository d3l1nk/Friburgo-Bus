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
export const faolTableUrl = (code: string, day: DayCode) => `https://faol.com.br/tabelas/${code}-${day}`;

const ALERTS_KEY = 'faol:alerts:v1';
const TABLE_PREFIX = 'faol:table:';
const TABLE_MAX_AGE_MS = 24 * 3600 * 1000;

const HEADERS = {
  accept: 'text/html,application/xhtml+xml',
  'accept-language': 'pt-BR,pt;q=0.9',
  'user-agent': 'Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36',
};

// =====================================================================
// Utilidades de DOM
// =====================================================================
const BLOCK = new Set([
  'P', 'DIV', 'LI', 'UL', 'OL', 'TR', 'TABLE', 'TBODY', 'THEAD', 'TFOOT', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'BR', 'HR', 'DT', 'DD', 'BLOCKQUOTE', 'FORM', 'MAIN', 'ASIDE', 'NAV',
]);

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function parseHtml(html: string): Document {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script,style,noscript,svg').forEach((n) => n.remove());
  return doc;
}

/** Converte um elemento em linhas de texto, quebrando em elementos de bloco. */
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
// Alertas (ALTERAÇÃO / ATENÇÃO) em /horarios
// =====================================================================
const ALERT_RE = /^(ALTERA[ÇC][ÃA]O|ATEN[ÇC][ÃA]O)\b\s*[:!\-–—.]*\s*(.*)$/i;
const CODE_RE = /(?<!\d)(\d{2,3}[A-Za-z]?)(?![A-Za-z0-9:])/;

function kindOf(word: string): FaolAlert['kind'] {
  return /^altera/i.test(norm(word)) ? 'ALTERAÇÃO' : 'ATENÇÃO';
}

function keyFromStrings(strings: (string | null | undefined)[]): string {
  for (const s of strings) {
    if (!s) continue;
    const m = s.match(CODE_RE);
    if (!m) continue;
    const k = resolveLineKey(m[1]);
    if (k && isKnownKey(k)) return k;
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
    while (!text && j < lines.length && j <= i + 3 && !ALERT_RE.test(lines[j])) {
      text = lines[j];
      j++;
    }
    text = clean(text);
    const k = typeof key === 'function' ? key() : key;
    if (text && k) out.push({ lineKey: k, kind: kindOf(m[1]), text });
  }
  return out;
}

export function parseAlerts(html: string): FaolAlert[] {
  const doc = parseHtml(html);
  const found: FaolAlert[] = [];

  // 1) Modais por linha
  const all = [...doc.querySelectorAll<HTMLElement>('.modal, [role="dialog"], [id*="modal" i]')];
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
      ...lines.slice(0, 2),
    ]);
    if (key) found.push(...alertsFromLines(lines, key));
  }

  // 2) Fallback: varre a página inteira acompanhando o cabeçalho da linha corrente
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
    data: res.ok ? { htmlLength: html.length, parsed: summarize(html), htmlPreview: html.slice(0, 20000) } : res.data,
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
    return { alerts: cache?.alerts ?? [], fromCache: true, savedAt: cache?.savedAt ?? 0, error: res.error ?? 'Sem resposta' };
  }
  const alerts = parseAlerts(html);
  const entry: AlertsCache = { savedAt: Date.now(), alerts };
  await setJSON(ALERTS_KEY, entry);
  return { alerts, fromCache: false, savedAt: entry.savedAt };
}

export async function getCachedAlerts(): Promise<AlertsCache | null> {
  return getJSON<AlertsCache>(ALERTS_KEY);
}

// =====================================================================
// Tabelas de horários
// =====================================================================
const HOUR_COL_RE = /faixa|hor[aá]rio|^hora/i;
const TERMINAL_RE = /esta[cç][aã]o\s*livre|terminal/i;

function cleanOrigin(s: string): string {
  return clean(s.replace(/partidas?\s*de\s*:?/i, '')) || 'Partidas';
}

/** "00 15 30A 45-B" ou "04:15 04:45" -> saídas */
function tokenizeCell(text: string, rowHour: number | null): Departure[] {
  const out: Departure[] = [];
  const re = /(?:(\d{1,2})\s*[:hH]\s*)?(\d{2})(?!\d)(?:\s*[-(]?\s*([A-Za-z])(?![A-Za-z]))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const h = m[1] !== undefined ? parseInt(m[1], 10) : rowHour;
    const min = parseInt(m[2], 10);
    if (h === null || h > 29 || min > 59) continue;
    const hh = h % 24;
    out.push({
      time: `${String(hh).padStart(2, '0')}:${String(min).padStart(2, '0')}`,
      minutes: hh * 60 + min,
      ramal: m[3] ? m[3].toUpperCase() : undefined,
    });
  }
  return out;
}

function parseTableElement(table: HTMLTableElement): TimetableColumn[] {
  const rows = [...table.querySelectorAll('tr')];
  if (rows.length < 2) return [];
  const cellsOf = (r: Element) => [...r.querySelectorAll('th,td')].map((c) => clean(c.textContent ?? ''));
  const headIdx = rows.findIndex((r) => r.querySelector('th') || /partidas|faixa/i.test(r.textContent ?? ''));
  const header = cellsOf(rows[headIdx >= 0 ? headIdx : 0]);
  const body = rows.slice((headIdx >= 0 ? headIdx : 0) + 1);

  let hourCol = header.findIndex((h) => HOUR_COL_RE.test(h));
  if (hourCol < 0) hourCol = 0;

  const caption = clean(table.querySelector('caption')?.textContent ?? '');
  const cols = new Map<number, Departure[]>();

  for (const r of body) {
    const cells = cellsOf(r);
    const hm = (cells[hourCol] ?? '').match(/(\d{1,2})/);
    const rowHour = hm ? parseInt(hm[1], 10) : null;
    cells.forEach((txt, j) => {
      if (j === hourCol || !txt) return;
      const deps = tokenizeCell(txt, rowHour);
      if (deps.length) cols.set(j, [...(cols.get(j) ?? []), ...deps]);
    });
  }

  const result: TimetableColumn[] = [];
  cols.forEach((deps, j) => {
    const origin = cleanOrigin(header[j] || caption || '');
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
    if (main && resolveLineKey(main[1]) === base && !/partidas|faixa/i.test(l)) out.set(main[1], main[2]);
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

  // Mescla colunas com a mesma origem (várias tabelas)
  const merged = new Map<string, TimetableColumn>();
  columns.forEach((c) => {
    const prev = merged.get(c.origin);
    if (prev) {
      const u = new Map<string, Departure>();
      [...prev.departures, ...c.departures].forEach((d) => u.set(`${d.time}${d.ramal ?? ''}`, d));
      prev.departures = [...u.values()].sort((a, b) => a.minutes - b.minutes);
    } else merged.set(c.origin, { ...c });
  });
  columns = [...merged.values()];

  let rawText: string | undefined;
  if (!columns.length) {
    // Fallback: qualquer HH:MM no texto da página
    const times: Departure[] = [];
    const re = /\b([01]?\d|2[0-3]):([0-5]\d)\b/g;
    lines.join('\n').replace(re, (_m, h, m) => {
      const hh = parseInt(h, 10);
      const mm = parseInt(m, 10);
      times.push({ time: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, minutes: hh * 60 + mm });
      return '';
    });
    if (times.length) {
      const u = new Map(times.map((d) => [d.time, d]));
      columns = [{ origin: 'Todos os horários', isTerminal: false, departures: [...u.values()].sort((a, b) => a.minutes - b.minutes) }];
    } else {
      rawText = lines.join('\n').slice(0, 6000);
    }
  }

  // Estação Livre sempre primeiro
  columns.sort((a, b) => Number(b.isTerminal) - Number(a.isTerminal));

  return { code, day, fetchedAt: Date.now(), columns, legend: parseLegend(lines, code), rawText };
}

const tableKey = (code: string, day: DayCode) => `${TABLE_PREFIX}${code}-${day}`;

export async function getTimetable(code: string, day: DayCode, force = false): Promise<TimetableResult> {
  const cached = await getJSON<Timetable>(tableKey(code, day));
  if (cached && !force && Date.now() - cached.fetchedAt < TABLE_MAX_AGE_MS) {
    return { table: cached, fromCache: true };
  }
  const { res, html } = await fetchHtml(`faol-table`, faolTableUrl(code, day), (h) => {
    const t = parseTimetable(h, code, day);
    return { columns: t.columns.map((c) => ({ origin: c.origin, isTerminal: c.isTerminal, count: c.departures.length })), legend: t.legend };
  });
  if (!res.ok || !html) {
    if (cached) return { table: cached, fromCache: true };
    return {
      table: null,
      fromCache: false,
      error: res.status === 404 ? 'Esta tabela não existe para este dia.' : `Sem conexão e sem cópia offline (${res.error ?? 'erro'}).`,
    };
  }
  const table = parseTimetable(html, code, day);
  const hasData = table.columns.some((c) => c.departures.length);
  if (hasData) await setJSON(tableKey(code, day), table);
  else if (cached) return { table: cached, fromCache: true };
  return { table, fromCache: false };
}

export function daysForLine(code: string): DayCode[] {
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

// =====================================================================
// Próximas saídas
// =====================================================================
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
    const next = upcoming.find((d) => d.minutes >= nowMin) ?? undefined;
    const idx = next ? upcoming.indexOf(next) : -1;
    return {
      origin: c.origin,
      isTerminal: c.isTerminal,
      next,
      after: idx >= 0 ? upcoming[idx + 1] : undefined,
      minutesLeft: next ? next.minutes - nowMin : undefined,
    };
  });
}
