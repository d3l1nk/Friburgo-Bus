import { httpRequest } from '../lib/http';
import { recordDebug } from '../lib/debug';
import { getJSON, listKeys, removeKey, setJSON } from '../lib/storage';
import { CIRCULAR_MAIN, CIRCULAR_TABLE_LINES, findLine, isKnownKey, lineKey, resolveLineKey } from '../data/faolLines';
import type {
  AlertsCache,
  DayCode,
  Departure,
  FaolAlert,
  FaolLinks,
  Timetable,
  TimetableColumn,
  TimetableResult,
} from '../types';

export const FAOL_HORARIOS_URL = 'https://www.faol.com.br/horarios';
export const faolTableUrl = (code: string, day: DayCode) => `https://faol.com.br/tabelas/${code}-${day}`;

const ALERTS_KEY = 'faol:alerts:v2';
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

function modalContainers(doc: Document): HTMLElement[] {
  const all = [...doc.querySelectorAll<HTMLElement>('.modal, [role="dialog"], [id*="modal" i]')];
  return all.filter((c) => !all.some((o) => o !== c && o.contains(c)));
}

function modalKey(c: HTMLElement, lines: string[]): string {
  const heads = [...c.querySelectorAll('.modal-title, h1, h2, h3, h4, h5, h6')].map((h) => h.textContent);
  return keyFromStrings([c.id, c.getAttribute('data-linha'), c.getAttribute('data-line'), c.getAttribute('aria-labelledby'), ...heads, ...lines.slice(0, 2)]);
}

export function parseAlerts(html: string): FaolAlert[] {
  const doc = parseHtml(html);
  const found: FaolAlert[] = [];

  // 1) Modais por linha
  for (const c of modalContainers(doc)) {
    const lines = textLines(c);
    const key = modalKey(c, lines);
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

// =====================================================================
// Links reais das tabelas (botões Dias Úteis / Sábado / Domingo / Circular)
// =====================================================================
const TABLE_HREF = /tabelas\/([^/?#]+?)-([USDC])(?:[/?#.]|$)/i;
const DAY_TEXT: [RegExp, DayCode][] = [
  [/dias?\s*[uú]teis/i, 'U'],
  [/s[aá]bado/i, 'S'],
  [/domingo/i, 'D'],
  [/circular/i, 'C'],
];

export function parseLinks(html: string): FaolLinks {
  const doc = parseHtml(html);
  const links: FaolLinks = {};
  const add = (key: string, day: DayCode, href: string) => {
    try {
      const url = new URL(href, FAOL_HORARIOS_URL).toString();
      if (!links[key]) links[key] = {};
      if (!links[key][day]) links[key][day] = url;
    } catch {
      /* href inválido */
    }
  };
  const usable = (href: string | null): href is string => !!href && !/^(#|javascript:|mailto:|tel:)/i.test(href.trim());

  // a) qualquer link no padrão /tabelas/{LINHA}-{DIA}
  doc.querySelectorAll('a[href]').forEach((a) => {
    const href = a.getAttribute('href');
    if (!usable(href)) return;
    const m = href.match(TABLE_HREF);
    if (!m) return;
    const key = resolveLineKey(m[1]);
    if (key) add(key, m[2].toUpperCase() as DayCode, href);
  });

  // b) links fora do padrão, identificados pelo texto do botão dentro do modal da linha
  for (const c of modalContainers(doc)) {
    const key = modalKey(c, textLines(c));
    if (!key) continue;
    c.querySelectorAll('a[href]').forEach((a) => {
      const href = a.getAttribute('href');
      if (!usable(href) || TABLE_HREF.test(href)) return;
      const txt = clean(a.textContent ?? '');
      const hit = DAY_TEXT.find(([re]) => re.test(txt));
      if (hit) add(key, hit[1], href);
    });
  }
  return links;
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
  links: FaolLinks;
  fromCache: boolean;
  savedAt: number;
  error?: string;
}

export async function getAlerts(): Promise<AlertsResult> {
  const cache = await getJSON<AlertsCache>(ALERTS_KEY);
  const { res, html } = await fetchHtml('faol-alerts', FAOL_HORARIOS_URL, (h) => ({ alerts: parseAlerts(h), links: parseLinks(h) }));
  if (!res.ok || !html) {
    return { alerts: cache?.alerts ?? [], links: cache?.links ?? {}, fromCache: true, savedAt: cache?.savedAt ?? 0, error: res.error ?? 'Sem resposta' };
  }
  const entry: AlertsCache = { savedAt: Date.now(), alerts: parseAlerts(html), links: parseLinks(html) };
  await setJSON(ALERTS_KEY, entry);
  return { alerts: entry.alerts, links: entry.links ?? {}, fromCache: false, savedAt: entry.savedAt };
}

export async function getCachedAlerts(): Promise<AlertsCache | null> {
  return getJSON<AlertsCache>(ALERTS_KEY);
}

// =====================================================================
// Tabelas de horários
// =====================================================================
const TERMINAL_RE = /esta[cç][aã]o\s*livre|terminal/i;
const PARTIDAS_RE = /partidas?\s*de\s*:?/i;
const GENERIC_HEAD = /^(partidas?\s*de\s*:?|faixa|hor[aá]ri[ao]s?|hora|linha|dia)$/i;
const HOUR_ONLY = /^\s*(\d{1,2})\s*(?:[:hH]\s*(\d{2})?)?\s*(?:hs?|horas?)?\s*$/;

/** "00 15 30A 45-B" ou "04:15 04:45" -> saídas */
function tokenizeCell(text: string, rowHour: number | null): Departure[] {
  const out: Departure[] = [];
  const re = /(?<!\d)(?:(\d{1,2})\s*[:hH]\s*)?(\d{2})(?!\d)(?:\s*[-(]?\s*([A-Za-z])(?![A-Za-z]))?/g;
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

interface Cell {
  text: string;
}

/** Monta a grade expandindo colspan/rowspan. Células expandidas compartilham a mesma referência. */
function buildGrid(rows: HTMLTableRowElement[]): Cell[][] {
  const grid: (Cell | undefined)[][] = rows.map(() => []);
  rows.forEach((tr, r) => {
    let c = 0;
    [...tr.cells].forEach((cell) => {
      while (grid[r][c]) c++;
      const cs = Math.max(1, Math.min(parseInt(cell.getAttribute('colspan') || '1', 10) || 1, 30));
      const rs = Math.max(1, Math.min(parseInt(cell.getAttribute('rowspan') || '1', 10) || 1, 30));
      const val: Cell = { text: clean(cell.textContent ?? '') };
      for (let dr = 0; dr < rs; dr++) for (let dc = 0; dc < cs; dc++) if (grid[r + dr]) grid[r + dr][c + dc] = val;
      c += cs;
    });
  });
  return grid.map((row) => Array.from(row, (v) => v ?? { text: '' }));
}

function isDataRow(row: Cell[]): boolean {
  const first = row.find((c) => c.text);
  if (!first) return false;
  const m = first.text.match(HOUR_ONLY);
  if (!m || parseInt(m[1], 10) > 29) return false;
  return row.some((c) => c !== first && /\d/.test(c.text));
}

const stripPartidas = (s: string) => clean(s.replace(PARTIDAS_RE, ''));

function parseTableElement(table: HTMLTableElement): TimetableColumn[] {
  const grid = buildGrid([...table.rows]);
  const headerCount = grid.findIndex(isDataRow);
  if (headerCount < 0) return [];
  const dataRows = grid.slice(headerCount).filter(isDataRow);
  const width = Math.max(...grid.map((r) => r.length));
  const heads = grid.slice(0, headerCount);

  // coluna da Faixa Horária
  let hourCol = -1;
  for (let j = 0; j < width; j++) {
    if (/faixa|hor[aá]ri/i.test(heads.map((r) => r[j]?.text ?? '').join(' '))) {
      hourCol = j;
      break;
    }
  }
  if (hourCol < 0) hourCol = Math.max(0, dataRows[0].findIndex((c) => c.text && HOUR_ONLY.test(c.text)));

  const caption = stripPartidas(clean(table.querySelector('caption')?.textContent ?? ''));
  const cols: { j: number; pieces: string[]; deps: Departure[] }[] = [];

  for (let j = 0; j < width; j++) {
    if (j === hourCol) continue;
    const deps: Departure[] = [];
    for (const r of dataRows) {
      const cell = r[j];
      if (!cell || cell === r[hourCol] || (j > 0 && cell === r[j - 1])) continue; // ignora colspan repetido
      const hm = (r[hourCol]?.text ?? '').match(HOUR_ONLY);
      deps.push(...tokenizeCell(cell.text, hm ? parseInt(hm[1], 10) : null));
    }
    if (!deps.length) continue;
    const pieces: string[] = [];
    heads.forEach((r) => {
      const t = stripPartidas(r[j]?.text ?? '');
      if (t && !GENERIC_HEAD.test(t) && pieces[pieces.length - 1] !== t) pieces.push(t);
    });
    cols.push({ j, pieces, deps });
  }

  // nome real de cada coluna = texto mais específico (última linha do cabeçalho)
  const names = cols.map((c) => c.pieces[c.pieces.length - 1] || caption || 'Partidas');
  const seen = new Map<string, number>();
  names.forEach((n) => seen.set(n, (seen.get(n) ?? 0) + 1));
  const used = new Map<string, number>();
  return cols.map((c, i) => {
    let origin = names[i];
    if ((seen.get(origin) ?? 0) > 1) {
      origin = c.pieces.length > 1 ? c.pieces.join(' – ') : origin;
      const n = (used.get(origin) ?? 0) + 1;
      used.set(origin, n);
      if (n > 1 || (seen.get(names[i]) ?? 0) > 1) origin = `${origin} (${c.j})`;
    }
    const u = new Map<string, Departure>();
    c.deps.forEach((d) => u.set(`${d.time}${d.ramal ?? ''}`, d));
    return {
      origin,
      isTerminal: TERMINAL_RE.test(c.pieces.join(' ') || origin),
      departures: [...u.values()].sort((a, b) => a.minutes - b.minutes),
    };
  });
}

/**
 * Páginas sem <table> utilizável: texto corrido.
 * Ignora a coluna "Faixa Horária" (04:00, 05:00, 06:00…) e atribui as saídas reais
 * à última origem declarada ("Partidas de: X").
 */
function parseFlow(lines: string[], ignoreFaixa = true): TimetableColumn[] {
  const TIME = /(?<!\d)([01]?\d|2[0-3]):([0-5]\d)(?!\d)(?:\s*[-(]?\s*([A-Za-z])(?![A-Za-z]))?/g;
  const skip = new Set<number>();

  if (ignoreFaixa) {
    let run: number[] = [];
    let prev = -2;
    const flush = () => {
      if (run.length >= 6) run.forEach((i) => skip.add(i));
      run = [];
      prev = -2;
    };
    lines.forEach((l, i) => {
      const m = [...l.matchAll(TIME)];
      if (m.length >= 6 && m.every((x, k) => x[2] === '00' && (k === 0 || +x[1] === +m[k - 1][1] + 1))) {
        skip.add(i);
        return;
      }
      const only = l.match(/^\s*([01]?\d|2[0-3]):00\s*$/);
      if (only) {
        const h = +only[1];
        if (run.length && h === prev + 1) {
          run.push(i);
          prev = h;
        } else {
          flush();
          run = [i];
          prev = h;
        }
      } else flush();
    });
    flush();
  }

  const cols = new Map<string, Departure[]>();
  let cur = 'Todos os horários';
  let sawPartidas = false;
  lines.forEach((l, i) => {
    let body = l;
    const ph = l.match(/partidas?\s*de\s*:?\s*(.*)$/i);
    if (ph) {
      sawPartidas = true;
      const name = clean(ph[1].replace(/[\d:].*$/, ''));
      if (name) cur = name;
      body = ph[1].slice(name.length);
    } else if (sawPartidas && !/\d/.test(l) && l.length < 40 && !GENERIC_HEAD.test(l) && lines[i + 1] && /\d{1,2}:\d{2}/.test(lines[i + 1])) {
      cur = l;
      return;
    }
    if (skip.has(i)) return;
    for (const m of body.matchAll(TIME)) {
      const hh = parseInt(m[1], 10);
      const mm = parseInt(m[2], 10);
      const d: Departure = {
        time: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`,
        minutes: hh * 60 + mm,
        ramal: m[3] ? m[3].toUpperCase() : undefined,
      };
      cols.set(cur, [...(cols.get(cur) ?? []), d]);
    }
  });

  const out: TimetableColumn[] = [];
  cols.forEach((deps, origin) => {
    const u = new Map<string, Departure>();
    deps.forEach((d) => u.set(`${d.time}${d.ramal ?? ''}`, d));
    out.push({ origin, isTerminal: TERMINAL_RE.test(origin), departures: [...u.values()].sort((a, b) => a.minutes - b.minutes) });
  });
  return out;
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
  doc.querySelectorAll('table').forEach((t) => columns.push(...parseTableElement(t as HTMLTableElement)));

  // junta tabelas diferentes da mesma origem
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
    columns = parseFlow(lines, true);
    if (!columns.length) columns = parseFlow(lines, false);
    if (!columns.length) rawText = lines.join('\n').slice(0, 6000);
  }

  // Circulares: coluna sem nome vira "Saídas (circular)"
  if (CIRCULAR_MAIN.has(code)) {
    columns = columns.map((c) => (/^(partidas|todos os hor[aá]rios)$/i.test(c.origin) ? { ...c, origin: 'Saídas (circular)' } : c));
  }

  columns.sort((a, b) => Number(b.isTerminal) - Number(a.isTerminal));
  return { code, day, fetchedAt: Date.now(), columns, legend: parseLegend(lines, code), rawText };
}

const tableKey = (code: string, day: DayCode) => `${TABLE_PREFIX}${code}-${day}`;

async function tableUrls(code: string, day: DayCode): Promise<string[]> {
  const cache = await getJSON<AlertsCache>(ALERTS_KEY);
  const fromLinks = cache?.links?.[lineKey(code)]?.[day];
  return [...new Set([fromLinks, faolTableUrl(code, day)].filter(Boolean) as string[])];
}

export async function getTableUrl(code: string, day: DayCode): Promise<string> {
  return (await tableUrls(code, day))[0];
}

export async function getTimetable(code: string, day: DayCode, force = false): Promise<TimetableResult> {
  const cached = await getJSON<Timetable>(tableKey(code, day));
  if (cached && !force && Date.now() - cached.fetchedAt < TABLE_MAX_AGE_MS) {
    return { table: cached, fromCache: true };
  }

  let ok: { html: string; url: string } | null = null;
  let lastStatus = 0;
  let lastError = '';
  for (const url of await tableUrls(code, day)) {
    const { res, html } = await fetchHtml('faol-table', url, (h) => {
      const t = parseTimetable(h, code, day);
      return { columns: t.columns.map((c) => ({ origin: c.origin, isTerminal: c.isTerminal, count: c.departures.length })), legend: t.legend };
    });
    lastStatus = res.status;
    lastError = res.error ?? '';
    if (res.ok && html) {
      ok = { html, url };
      break;
    }
  }

  if (!ok) {
    if (cached) return { table: cached, fromCache: true };
    return {
      table: null,
      fromCache: false,
      error: lastStatus === 404 ? 'Esta tabela não existe para este dia.' : `Sem conexão e sem cópia offline (${lastError || 'erro'}).`,
    };
  }

  const table: Timetable = { ...parseTimetable(ok.html, code, day), sourceUrl: ok.url };
  if (table.columns.some((c) => c.departures.length)) await setJSON(tableKey(code, day), table);
  else if (cached) return { table: cached, fromCache: true };
  return { table, fromCache: false };
}

export function daysForLine(code: string): DayCode[] {
  return CIRCULAR_TABLE_LINES.has(code) ? ['U', 'S', 'D', 'C'] : ['U', 'S', 'D'];
}

export async function downloadAllDays(code: string): Promise<{ ok: number; total: number }> {
  const days = daysForLine(code).filter((d) => !(code === '54' && d === 'D'));
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
    const upcoming = c.departures.filter((d) => d.minutes >= nowMin);
    return {
      origin: c.origin,
      isTerminal: c.isTerminal,
      next: upcoming[0],
      after: upcoming[1],
      minutesLeft: upcoming[0] ? upcoming[0].minutes - nowMin : undefined,
    };
  });
}
