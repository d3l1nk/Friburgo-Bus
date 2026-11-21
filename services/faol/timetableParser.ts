import { CIRCULAR_MAIN, resolveLineKey } from '../../data/faolLines';
import type { DayCode, Departure, Timetable, TimetableColumn } from '../../types';
import { clean, parseHtml, textLines } from './dom';
import { extractOriginalHtml } from './originalHtml';

const TERMINAL_RE = /esta[cç][aã]o\s*livre|terminal/i;
const PARTIDAS_RE = /partidas?\s*de\s*:?/i;
const GENERIC_HEAD = /^(partidas?\s*de\s*:?|faixa|hor[aá]ri[ao]s?|hora|linha|dia)$/i;
const HOUR_ONLY = /^\s*(\d{1,2})\s*(?:[:hH]\s*(\d{2})?)?\s*(?:hs?|horas?)?\s*$/;

const hhmm = (h: number, m: number) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

function dedupeSort(deps: Departure[]): Departure[] {
  const u = new Map<string, Departure>();
  deps.forEach((d) => u.set(`${d.time}${d.ramal ?? ''}`, d));
  return [...u.values()].sort((a, b) => a.minutes - b.minutes);
}

/** "00 15 30A 45-B" ou "04:15 04:45" -> saídas */
export function tokenizeCell(text: string, rowHour: number | null): Departure[] {
  const out: Departure[] = [];
  const re = /(?<!\d)(?:(\d{1,2})\s*[:hH]\s*)?(\d{2})(?!\d)(?:\s*[-(]?\s*([A-Za-z])(?![A-Za-z]))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const h = m[1] !== undefined ? parseInt(m[1], 10) : rowHour;
    const min = parseInt(m[2], 10);
    if (h === null || h > 29 || min > 59) continue;
    const hh = h % 24;
    out.push({ time: hhmm(hh, min), minutes: hh * 60 + min, ramal: m[3] ? m[3].toUpperCase() : undefined });
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
      for (let dr = 0; dr < rs; dr++)
        for (let dc = 0; dc < cs; dc++) if (grid[r + dr]) grid[r + dr][c + dc] = val;
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

/** Lê uma <table> com cabeçalho de 1 ou mais linhas (colspan/rowspan) e devolve uma coluna por origem. */
export function parseTableElement(table: HTMLTableElement): TimetableColumn[] {
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
  if (hourCol < 0)
    hourCol = Math.max(
      0,
      dataRows[0].findIndex((c) => c.text && HOUR_ONLY.test(c.text)),
    );

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
    return {
      origin,
      isTerminal: TERMINAL_RE.test(c.pieces.join(' ') || origin),
      departures: dedupeSort(c.deps),
    };
  });
}

/**
 * Páginas sem <table> utilizável: texto corrido.
 * Ignora a coluna "Faixa Horária" (04:00, 05:00, 06:00…) e atribui as saídas reais
 * à última origem declarada ("Partidas de: X").
 */
export function parseFlow(lines: string[], ignoreFaixa = true): TimetableColumn[] {
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
    } else if (
      sawPartidas &&
      !/\d/.test(l) &&
      l.length < 40 &&
      !GENERIC_HEAD.test(l) &&
      lines[i + 1] &&
      /\d{1,2}:\d{2}/.test(lines[i + 1])
    ) {
      cur = l;
      return;
    }
    if (skip.has(i)) return;
    for (const m of body.matchAll(TIME)) {
      const hh = parseInt(m[1], 10);
      const mm = parseInt(m[2], 10);
      const d: Departure = {
        time: hhmm(hh, mm),
        minutes: hh * 60 + mm,
        ramal: m[3] ? m[3].toUpperCase() : undefined,
      };
      cols.set(cur, [...(cols.get(cur) ?? []), d]);
    }
  });

  const out: TimetableColumn[] = [];
  cols.forEach((deps, origin) => {
    out.push({ origin, isTerminal: TERMINAL_RE.test(origin), departures: dedupeSort(deps) });
  });
  return out;
}

export function parseLegend(lines: string[], code: string): { code: string; label: string }[] {
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

export function hasDepartures(t: Timetable): boolean {
  return t.columns.some((c) => c.departures.length > 0);
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
    if (prev) prev.departures = dedupeSort([...prev.departures, ...c.departures]);
    else merged.set(c.origin, { ...c });
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
    columns = columns.map((c) =>
      /^(partidas|todos os hor[aá]rios)$/i.test(c.origin) ? { ...c, origin: 'Saídas (circular)' } : c,
    );
  }

  columns.sort((a, b) => Number(b.isTerminal) - Number(a.isTerminal));
  return {
    code,
    day,
    fetchedAt: Date.now(),
    columns,
    legend: parseLegend(lines, code),
    rawText,
    originalHtml: extractOriginalHtml(doc, lines),
  };
}
