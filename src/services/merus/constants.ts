export const MERUS_BASE = 'https://friburgo.merustracker.com.br:8888/api/v1.0';

export const MERUS_HEADERS: Record<string, string> = {
  accept: 'application/json, text/plain, */*',
  'accept-language': 'pt-BR',
  'content-type': 'application/json;charset=UTF-8',
  Referer: 'https://friburgo.merustracker.com.br/',
  Origin: 'https://friburgo.merustracker.com.br',
};

export const STOPS_RADIUS = 1000;
export const STOPS_REFETCH_METERS = 400;
export const STOPS_CACHE_KEY = 'merus:stops:v1';

export const MERUS_TIMEOUT_MS = 15000;
export const MERUS_RETRIES = 2;
