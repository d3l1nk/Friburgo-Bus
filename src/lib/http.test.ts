import { CapacitorHttp, type HttpResponse } from '@capacitor/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { httpRequest, isRetryable } from './http';

const request = vi.mocked(CapacitorHttp.request);
const resp = (status: number, data: unknown): HttpResponse => ({ status, data, headers: {}, url: 'u' });

beforeEach(() => {
  request.mockReset();
});

describe('isRetryable', () => {
  it('só rede/timeout (0) e 5xx valem nova tentativa', () => {
    expect([0, 500, 503].map(isRetryable)).toEqual([true, true, true]);
    expect([200, 301, 400, 404].map(isRetryable)).toEqual([false, false, false, false]);
  });
});

describe('httpRequest', () => {
  it('sucesso: ok + dados', async () => {
    request.mockResolvedValue(resp(200, { a: 1 }));
    const r = await httpRequest({ url: 'u', method: 'GET' });
    expect(r).toMatchObject({ ok: true, status: 200, data: { a: 1 } });
    expect(r.error).toBeUndefined();
  });

  it('converte texto JSON em objeto quando responseType é json', async () => {
    request.mockResolvedValue(resp(200, '{"x":2}'));
    expect((await httpRequest({ url: 'u', method: 'POST', body: {} })).data).toEqual({ x: 2 });
  });

  it('mantém o texto quando o JSON é inválido', async () => {
    request.mockResolvedValue(resp(200, '{quebrado'));
    expect((await httpRequest({ url: 'u', method: 'GET' })).data).toBe('{quebrado');
  });

  it('não interpreta JSON quando responseType é text', async () => {
    request.mockResolvedValue(resp(200, '{"x":2}'));
    expect((await httpRequest({ url: 'u', method: 'GET', responseType: 'text' })).data).toBe('{"x":2}');
  });

  it('HTTP 4xx: ok=false com mensagem e sem retry', async () => {
    request.mockResolvedValue(resp(404, 'nope'));
    const r = await httpRequest({ url: 'u', method: 'GET', retries: 3, retryDelayMs: 0 });
    expect(r).toMatchObject({ ok: false, status: 404, error: 'HTTP 404' });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('falha de rede: não lança, devolve status 0 e a mensagem', async () => {
    request.mockRejectedValue(new Error('timeout'));
    const r = await httpRequest({ url: 'u', method: 'GET' });
    expect(r).toMatchObject({ ok: false, status: 0, data: null, error: 'timeout' });
  });

  it('retry: tenta de novo em 5xx e para quando dá certo', async () => {
    request
      .mockResolvedValueOnce(resp(503, ''))
      .mockResolvedValueOnce(resp(502, ''))
      .mockResolvedValueOnce(resp(200, [1]));
    const r = await httpRequest({ url: 'u', method: 'GET', retries: 2, retryDelayMs: 0 });
    expect(r.ok).toBe(true);
    expect(request).toHaveBeenCalledTimes(3);
  });

  it('retry: respeita o limite de tentativas', async () => {
    request.mockRejectedValue(new Error('offline'));
    const r = await httpRequest({ url: 'u', method: 'GET', retries: 2, retryDelayMs: 0 });
    expect(r.ok).toBe(false);
    expect(request).toHaveBeenCalledTimes(3);
  });

  it('sem retries configurados faz uma única tentativa', async () => {
    request.mockRejectedValue(new Error('offline'));
    await httpRequest({ url: 'u', method: 'GET' });
    expect(request).toHaveBeenCalledTimes(1);
  });
});
