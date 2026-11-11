import { CapacitorHttp } from '@capacitor/core';
import type { HttpResult } from '../types';

interface Opts {
  url: string;
  method: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: unknown;
  responseType?: 'json' | 'text';
  timeoutMs?: number;
}

/**
 * Requisição via camada nativa (CapacitorHttp): sem CORS e com Referer/Origin livres.
 * Nunca lança: devolve { ok:false, error } em falhas.
 */
export async function httpRequest<T = any>(opts: Opts): Promise<HttpResult<T>> {
  const t0 = performance.now();
  const timeout = opts.timeoutMs ?? 20000;
  try {
    const res = await CapacitorHttp.request({
      url: opts.url,
      method: opts.method,
      headers: opts.headers,
      data: opts.body,
      responseType: opts.responseType ?? 'json',
      connectTimeout: timeout,
      readTimeout: timeout,
    });
    let data: any = res.data;
    if ((opts.responseType ?? 'json') === 'json' && typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch {
        /* mantém texto */
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
  } catch (e: any) {
    return {
      ok: false,
      status: 0,
      ms: Math.round(performance.now() - t0),
      url: opts.url,
      data: null as any,
      error: e?.message ?? String(e),
    };
  }
}
