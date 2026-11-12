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

/** Partes para exibir um tempo restante em destaque. */
export function etaParts(minutesLeft: number): { big: string; unit: string } {
  if (minutesLeft < 1) return { big: 'Agora', unit: '' };
  if (minutesLeft < 60) return { big: String(Math.ceil(minutesLeft)), unit: 'min' };
  const total = Math.ceil(minutesLeft);
  return { big: `${Math.floor(total / 60)}h${String(total % 60).padStart(2, '0')}`, unit: '' };
}

/** Relógio que só atualiza o componente que o usa (pausa com a tela em segundo plano). */
export function useNow(intervalMs = 10000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => {
      if (!document.hidden) setNow(new Date());
    };
    const id = setInterval(tick, intervalMs);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [intervalMs]);
  return now;
}

/** Executa fn já e a cada ms enquanto enabled e o app estiver visível. */
export function usePolling(fn: () => void | Promise<void>, ms: number, enabled: boolean, deps: unknown[] = []) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!enabled) return;
    void ref.current();
    const id = setInterval(() => {
      if (!document.hidden) void ref.current();
    }, ms);
    const onVis = () => {
      if (!document.hidden) void ref.current();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ms, ...deps]);
}
