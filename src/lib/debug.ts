import type { DebugEntry } from '../types';

/** Último retorno bruto de cada rota, consultado pela aba Diagnóstico. */
const store = new Map<string, DebugEntry>();
const listeners = new Set<() => void>();

export function recordDebug(key: string, entry: DebugEntry) {
  store.set(key, entry);
  listeners.forEach((l) => l());
}
export function getDebug(key: string): DebugEntry | undefined {
  return store.get(key);
}
export function subscribeDebug(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
