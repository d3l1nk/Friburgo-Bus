import type { DayCode } from './common';

export interface FaolAlert {
  lineKey: string;
  kind: 'ALTERAÇÃO' | 'ATENÇÃO';
  text: string;
}

/** Links reais da FAOL por linha (chave = lineKey) e dia. */
export type FaolLinks = Record<string, Partial<Record<DayCode, string>>>;

export interface AlertsCache {
  savedAt: number;
  alerts: FaolAlert[];
  links?: FaolLinks;
}

export interface Departure {
  /** HH:MM */
  time: string;
  /** minutos desde 00:00 */
  minutes: number;
  /** ex.: A, B */
  ramal?: string;
}

export interface TimetableColumn {
  origin: string;
  isTerminal: boolean;
  departures: Departure[];
}

export interface Timetable {
  code: string;
  day: DayCode;
  fetchedAt: number;
  columns: TimetableColumn[];
  legend: { code: string; label: string }[];
  /** página original da FAOL */
  sourceUrl?: string;
  /** tabela original higienizada (visualização dentro do app) */
  originalHtml?: string;
  /** só guardado quando o parser não achou horários */
  rawText?: string;
}

export interface TimetableResult {
  table: Timetable | null;
  fromCache: boolean;
  error?: string;
}

/** Fotografia pré-processada (gerada por scripts/faol-snapshot.ts) para consumo offline/rápido. */
export interface FaolSnapshot {
  version: 1;
  generatedAt: number;
  alerts: FaolAlert[];
  links: FaolLinks;
  /** chave: `${código}-${dia}`, ex.: "58-U" */
  tables: Record<string, Timetable>;
}
