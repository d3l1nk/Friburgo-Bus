import type { DayCode } from '../../types';

export const FAOL_HORARIOS_URL = 'https://www.faol.com.br/horarios';
export const faolTableUrl = (code: string, day: DayCode) => `https://faol.com.br/tabelas/${code}-${day}`;

export const ALERTS_KEY = 'faol:alerts:v2';
export const TABLE_PREFIX = 'faol:table:';
export const TABLE_MAX_AGE_MS = 24 * 3600 * 1000;

export const FAOL_HEADERS: Record<string, string> = {
  accept: 'text/html,application/xhtml+xml',
  'accept-language': 'pt-BR,pt;q=0.9',
  'user-agent': 'Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36',
};
