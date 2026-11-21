import { httpRequest as defaultRequest } from '../../lib/http';
import { recordDebug } from '../../lib/debug';
import type { HttpResult } from '../../types';
import { FAOL_HEADERS } from './constants';

export interface HtmlFetch {
  res: HttpResult;
  html: string;
}

/** GET de uma página da FAOL como texto, com registro para a tela de diagnóstico. */
export async function fetchHtml(
  debugKey: string,
  url: string,
  summarize: (html: string) => unknown,
  request: typeof defaultRequest = defaultRequest,
): Promise<HtmlFetch> {
  const res = await request({ url, method: 'GET', headers: FAOL_HEADERS, responseType: 'text', retries: 1 });
  const html = typeof res.data === 'string' ? res.data : '';
  recordDebug(debugKey, {
    label: url,
    at: Date.now(),
    url,
    method: 'GET',
    status: res.status,
    ms: res.ms,
    ok: res.ok,
    error: res.error,
    data: res.ok
      ? { htmlLength: html.length, parsed: summarize(html), htmlPreview: html.slice(0, 20000) }
      : res.data,
  });
  return { res, html };
}
