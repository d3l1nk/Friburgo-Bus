import { CIRCULAR_TABLE_LINES } from '../../data/faolLines';
import type { DayCode, Departure, Timetable } from '../../types';

export function daysForLine(code: string): DayCode[] {
  return CIRCULAR_TABLE_LINES.has(code) ? ['U', 'S', 'D', 'C'] : ['U', 'S', 'D'];
}

export interface NextByColumn {
  origin: string;
  isTerminal: boolean;
  next?: Departure;
  after?: Departure;
  minutesLeft?: number;
}

/** Próxima e seguinte saída de cada origem da tabela, a partir de `nowMin` (minutos desde 00:00). */
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
