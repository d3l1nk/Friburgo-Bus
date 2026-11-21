import { FAOL_SNAPSHOT_URL } from '../../config';
import { lineKey } from '../../data/faolLines';
import { getJSON, listKeys, removeKey, setJSON } from '../../lib/storage';
import type { AlertsCache, DayCode, FaolAlert, FaolLinks, Timetable, TimetableResult } from '../../types';
import { parseAlerts } from './alerts';
import { ALERTS_KEY, FAOL_HORARIOS_URL, TABLE_MAX_AGE_MS, TABLE_PREFIX, faolTableUrl } from './constants';
import { parseLinks } from './links';
import { daysForLine } from './schedule';
import { isSnapshotFresh, loadSnapshot, snapshotTable } from './snapshot';
import { fetchHtml } from './transport';
import { hasDepartures, parseTimetable } from './timetableParser';

const tableKey = (code: string, day: DayCode) => `${TABLE_PREFIX}${code}-${day}`;
const snapshot = () => loadSnapshot(FAOL_SNAPSHOT_URL);

// ---------------------------------------------------------------------
// Alertas e links
// ---------------------------------------------------------------------
export interface AlertsResult {
  alerts: FaolAlert[];
  links: FaolLinks;
  fromCache: boolean;
  savedAt: number;
  error?: string;
}

/** Site da FAOL > (se o site falhar) cópia mais recente entre o cache local e o snapshot. */
export async function getAlerts(): Promise<AlertsResult> {
  const cache = await getJSON<AlertsCache>(ALERTS_KEY);
  const { res, html } = await fetchHtml('faol-alerts', FAOL_HORARIOS_URL, (h) => ({
    alerts: parseAlerts(h),
    links: parseLinks(h),
  }));
  if (!res.ok || !html) {
    const snap = await snapshot();
    const error = res.error ?? 'Sem resposta';
    if (snap && snap.generatedAt > (cache?.savedAt ?? 0)) {
      return { alerts: snap.alerts, links: snap.links, fromCache: true, savedAt: snap.generatedAt, error };
    }
    return {
      alerts: cache?.alerts ?? [],
      links: cache?.links ?? {},
      fromCache: true,
      savedAt: cache?.savedAt ?? 0,
      error,
    };
  }
  const entry: AlertsCache = { savedAt: Date.now(), alerts: parseAlerts(html), links: parseLinks(html) };
  await setJSON(ALERTS_KEY, entry);
  return { alerts: entry.alerts, links: entry.links ?? {}, fromCache: false, savedAt: entry.savedAt };
}

export const getCachedAlerts = () => getJSON<AlertsCache>(ALERTS_KEY);

// ---------------------------------------------------------------------
// Tabelas de horários
// ---------------------------------------------------------------------
async function tableUrls(code: string, day: DayCode): Promise<string[]> {
  const cache = await getJSON<AlertsCache>(ALERTS_KEY);
  const fromLinks = cache?.links?.[lineKey(code)]?.[day];
  return [...new Set([fromLinks, faolTableUrl(code, day)].filter((u): u is string => !!u))];
}

export async function getTableUrl(code: string, day: DayCode): Promise<string> {
  return (await tableUrls(code, day))[0];
}

/**
 * Ordem: cache local recente > snapshot recente (se configurado) > site da FAOL >
 * (se tudo falhar) cache antigo ou snapshot antigo. `force` pula as cópias e vai direto ao site.
 */
export async function getTimetable(code: string, day: DayCode, force = false): Promise<TimetableResult> {
  const cached = await getJSON<Timetable>(tableKey(code, day));
  if (cached && !force && Date.now() - cached.fetchedAt < TABLE_MAX_AGE_MS) {
    return { table: cached, fromCache: true };
  }

  const snap = await snapshot();
  const snapTable = snapshotTable(snap, code, day);
  if (!force && snap && snapTable && isSnapshotFresh(snap)) {
    await setJSON(tableKey(code, day), snapTable);
    return { table: snapTable, fromCache: true };
  }
  const fallback = cached ?? snapTable;

  let ok: { html: string; url: string } | null = null;
  let lastStatus = 0;
  let lastError = '';
  for (const url of await tableUrls(code, day)) {
    const { res, html } = await fetchHtml('faol-table', url, (h) => {
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
    lastStatus = res.status;
    lastError = res.error ?? '';
    if (res.ok && html) {
      ok = { html, url };
      break;
    }
  }

  if (!ok) {
    if (fallback) return { table: fallback, fromCache: true };
    return {
      table: null,
      fromCache: false,
      error:
        lastStatus === 404
          ? 'Esta tabela não existe para este dia.'
          : `Sem conexão e sem cópia offline (${lastError || 'erro'}).`,
    };
  }

  const table: Timetable = { ...parseTimetable(ok.html, code, day), sourceUrl: ok.url };
  if (hasDepartures(table)) await setJSON(tableKey(code, day), table);
  else if (fallback) return { table: fallback, fromCache: true };
  return { table, fromCache: false };
}

export async function downloadAllDays(code: string): Promise<{ ok: number; total: number }> {
  const days = daysForLine(code).filter((d) => !(code === '54' && d === 'D'));
  let ok = 0;
  for (const d of days) {
    const r = await getTimetable(code, d, true);
    if (r.table && hasDepartures(r.table) && !r.fromCache) ok++;
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
