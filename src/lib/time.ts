import { useEffect, useRef, useState } from 'react';
import type { DayCode } from '../types';

export function dayTypeOf(d: Date = new Date()): DayCode {
  const w = d.getDay();
  return w === 0 ? 'D' : w === 6 ? 'S' : 'U';
}

export const DAY_LABEL: Record<DayCode, string> = {
  U: 'Dias úteis',
  S: 'Sábado',
  D: 'Domingo',
  C: 'Circular',
};

export function minutesOfDay(d: Date = new Date()): number {
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
}

export function formatCountdown(minutesLeft: number): string {
  const totalSec = Math.max(0, Math.round(minutesLeft * 60));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}min`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Executa fn já e a cada ms enquanto enabled. */
export function usePolling(fn: () => void | Promise<void>, ms: number, enabled: boolean, deps: unknown[] = []) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!enabled) return;
    void ref.current();
    const id = setInterval(() => void ref.current(), ms);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ms, ...deps]);
}
