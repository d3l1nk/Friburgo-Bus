import { CapacitorHttp } from '@capacitor/core';
import { errMessage } from './errors';
import type { HttpResult } from '../types';

export interface HttpOptions {
  url: string;
  method: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: unknown;
  responseType?: 'json' | 'text';
  timeoutMs?: number;
  /** tentativas extras em falha de rede ou HTTP 5xx (padrão: 0) */
  retries?: number;
  /** espera inicial entre tentativas; dobra a cada retry (padrão: 400 ms) */
  retryDelayMs?: number;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Falhas que valem uma nova tentativa: sem resposta (rede/timeout) ou erro 5xx do servidor. */
export const isRetryable = (status: number) => status === 0 || status >= 500;

async function singleRequest(opts: HttpOptions): Promise<HttpResult> {
  const t0 = performance.now();
  const timeout = opts.timeoutMs ?? 20000;
  const responseType = opts.responseType ?? 'json';
  try {
    const res = await CapacitorHttp.request({
      url: opts.url,
      method: opts.method,
      headers: opts.headers,
      data: opts.body,
      responseType,
      connectTimeout: timeout,
      readTimeout: timeout,
    });
    let data: unknown = res.data;
    if (responseType === 'json' && typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch {
        /* mantém o texto */
      }
    }
    const ok = res.status >= 200 && res.status < 300;
    return {
      ok,
      status: res.status,
      ms: Math.round(performance.now() - t0),
      url: opts.url,
      data,
      error: ok ? undefined : `HTTP ${res.status}`,
    };
  } catch (e: unknown) {
    return {
      ok: false,
      status: 0,
      ms: Math.round(performance.now() - t0),
      url: opts.url,
      data: null,
      error: errMessage(e),
    };
  }
}

/**
 * Requisição via camada nativa (CapacitorHttp): sem CORS e com Referer/Origin livres.
 * Nunca lança: devolve { ok:false, error } em falhas, após as tentativas extras configuradas.
 */
export async function httpRequest(opts: HttpOptions): Promise<HttpResult> {
  const retries = Math.max(0, opts.retries ?? 0);
  const delay = opts.retryDelayMs ?? 400;
  let res = await singleRequest(opts);
  for (let attempt = 0; attempt < retries && !res.ok && isRetryable(res.status); attempt++) {
    await sleep(delay * 2 ** attempt);
    res = await singleRequest(opts);
  }
  return res;
}
