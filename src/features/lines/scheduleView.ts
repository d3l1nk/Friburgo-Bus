// Lógica pura da tela de horários da linha (sem React): fácil de testar.
import type { Departure } from '../../types';
import type { NextByColumn } from '../../services/faol';

export interface DepartureCardModel {
  tag: string;
  row: NextByColumn;
  tone: 'route' | 'go';
}

/**
 * Escolhe os cartões "Estação Livre" x "Bairro": o terminal e o bairro com saída mais próxima.
 * Os demais bairros com saída ficam em `others` (exibidos como chips).
 */
export function pickDepartureCards(rows: NextByColumn[]): {
  cards: DepartureCardModel[];
  others: NextByColumn[];
} {
  const terminal = rows.find((r) => r.isTerminal);
  const bairros = rows
    .filter((r) => !r.isTerminal)
    .sort((a, b) => (a.minutesLeft ?? 9999) - (b.minutesLeft ?? 9999));

  let cards: DepartureCardModel[] = [];
  if (terminal) cards.push({ tag: 'Saindo da Estação Livre', row: terminal, tone: 'route' });
  if (bairros[0]) cards.push({ tag: 'Saindo do bairro', row: bairros[0], tone: 'go' });
  if (cards.length === 1 && bairros[1]) cards.push({ tag: 'Saindo do bairro', row: bairros[1], tone: 'go' });
  if (!terminal && cards.length === 1) cards = [{ ...cards[0], tag: 'Próxima saída' }];

  const others = bairros.filter((b) => !cards.some((c) => c.row === b) && b.next);
  return { cards, others };
}

/** "Mostrar apenas próximos horários de hoje": mantém saídas a partir de 1 min atrás. */
export function filterUpcoming(departures: Departure[], nowMin: number, enabled: boolean): Departure[] {
  return enabled ? departures.filter((d) => d.minutes >= nowMin - 1) : departures;
}

export function nextMinute(departures: Departure[], nowMin: number): number | undefined {
  return departures.find((d) => d.minutes >= nowMin)?.minutes;
}

/** Agrupa as saídas por hora cheia, preservando a ordem. */
export function groupByHour(departures: Departure[]): [number, Departure[]][] {
  const byHour = new Map<number, Departure[]>();
  departures.forEach((d) => {
    const h = Math.floor(d.minutes / 60);
    byHour.set(h, [...(byHour.get(h) ?? []), d]);
  });
  return [...byHour.entries()];
}

const RAMAL_COLORS = ['#3b9cff', '#2dd4a0', '#fbbf24', '#f472b6', '#a78bfa', '#fb923c'];
export const ramalColor = (r?: string): string | undefined =>
  r ? RAMAL_COLORS[(r.charCodeAt(0) - 65 + RAMAL_COLORS.length * 4) % RAMAL_COLORS.length] : undefined;
