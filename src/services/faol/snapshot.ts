import { httpRequest as defaultRequest } from '../../lib/http';
import { getJSON, setJSON } from '../../lib/storage';
import type { DayCode, FaolSnapshot, Timetable } from '../../types';

export const SNAPSHOT_KEY = 'faol:snapshot:v1';
export const SNAPSHOT_MAX_AGE_MS = 6 * 3600 * 1000;
/** Acima disso o snapshot só é usado como último recurso (quando o site da FAOL não responde). */
export const SNAPSHOT_FRESH_MS = 36 * 3600 * 1000;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Valida a estrutura mínima: um JSON malformado ou de outra versão nunca entra no app. */
export function isFaolSnapshot(v: unknown): v is FaolSnapshot {
  if (!isRecord(v) || v.version !== 1 || typeof v.generatedAt !== 'number') return false;
  if (!Array.isArray(v.alerts) || !isRecord(v.links) || !isRecord(v.tables)) return false;
  return Object.values(v.tables).every(
    (t) => isRecord(t) && Array.isArray(t.columns) && typeof t.code === 'string',
  );
}

interface CachedSnapshot {
  fetchedAt: number;
  snapshot: FaolSnapshot;
}

/**
 * Baixa o JSON pré-processado (se `url` estiver configurada). Mantém cópia local por 6 h e,
 * se a rede falhar ou o JSON vier inválido, cai para a última cópia boa.
 */
export async function loadSnapshot(
  url: string,
  request: typeof defaultRequest = defaultRequest,
): Promise<FaolSnapshot | null> {
  if (!url) return null;
  const cached = await getJSON<CachedSnapshot>(SNAPSHOT_KEY);
  const cachedOk = cached && isFaolSnapshot(cached.snapshot) ? cached : null;
  if (cachedOk && Date.now() - cachedOk.fetchedAt < SNAPSHOT_MAX_AGE_MS) return cachedOk.snapshot;

  const res = await request({ url, method: 'GET', responseType: 'json', timeoutMs: 15000, retries: 1 });
  if (res.ok && isFaolSnapshot(res.data)) {
    await setJSON(SNAPSHOT_KEY, { fetchedAt: Date.now(), snapshot: res.data } satisfies CachedSnapshot);
    return res.data;
  }
  return cachedOk?.snapshot ?? null;
}

export function snapshotTable(s: FaolSnapshot | null, code: string, day: DayCode): Timetable | null {
  const t = s?.tables[`${code}-${day}`];
  return t && t.columns.some((c) => c.departures.length) ? t : null;
}

export const isSnapshotFresh = (s: FaolSnapshot) => Date.now() - s.generatedAt < SNAPSHOT_FRESH_MS;
