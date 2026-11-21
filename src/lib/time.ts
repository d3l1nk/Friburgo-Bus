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
