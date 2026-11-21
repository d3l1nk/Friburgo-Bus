import { httpRequest as defaultRequest, type HttpOptions } from '../../lib/http';
import { recordDebug } from '../../lib/debug';
import type { HttpResult } from '../../types';
import { MERUS_BASE, MERUS_HEADERS, MERUS_RETRIES, MERUS_TIMEOUT_MS, STOPS_RADIUS } from './constants';

export interface MerusCall {
  ok: boolean;
  status: number;
  ms: number;
  raw: unknown;
  error?: string;
}

export type RequestFn = (opts: HttpOptions) => Promise<HttpResult>;

/** POST em uma rota do Merus, com timeout, retry e registro para a tela de diagnóstico. */
export async function callMerus(
  debugKey: string,
  endpoint: string,
  body: unknown,
  request: RequestFn = defaultRequest,
): Promise<MerusCall> {
  const url = `${MERUS_BASE}/${endpoint}`;
  const res = await request({
    url,
    method: 'POST',
    headers: MERUS_HEADERS,
    body,
    responseType: 'json',
    timeoutMs: MERUS_TIMEOUT_MS,
    retries: MERUS_RETRIES,
  });
  recordDebug(debugKey, {
    label: endpoint,
    at: Date.now(),
    url,
    method: 'POST',
    requestBody: body,
    status: res.status,
    ms: res.ms,
    ok: res.ok,
    error: res.error,
    data: res.data,
  });
  return { ok: res.ok, status: res.status, ms: res.ms, raw: res.data, error: res.error };
}

export const rawStops = (lat: number, lng: number, radius = STOPS_RADIUS, request?: RequestFn) =>
  callMerus(
    'stops',
    'getcercamaisproxima',
    { coords: { type: 'Circle', center: { lat, lng }, radius } },
    request,
  );

export const rawPanel = (idCerca: number | string, lat: number, lng: number, request?: RequestFn) =>
  callMerus(
    'panel',
    'getveiculospainel',
    { id_cerca: isNaN(Number(idCerca)) ? idCerca : Number(idCerca), lat, lng },
    request,
  );

export const rawVehicles = (request?: RequestFn) =>
  callMerus('vehicles', 'getveiculosconsultapassageiro', { id: null, tipo: 1 }, request);
