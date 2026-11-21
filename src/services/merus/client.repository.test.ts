import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getJSON, setJSON } from '../../lib/storage';
import type { HttpResult } from '../../types';
import { callMerus, rawPanel, rawStops, rawVehicles, type RequestFn } from './client';
import { MERUS_BASE, MERUS_HEADERS, STOPS_CACHE_KEY } from './constants';
import stops from './__fixtures__/stops.json';
import vehicles from './__fixtures__/vehicles.json';
import * as client from './client';
import { getAllVehicles, getNearbyStops, getStopArrivals, withDistance } from './repository';

const ok = (data: unknown): HttpResult => ({ ok: true, status: 200, ms: 3, url: 'u', data });
const bad = (status = 500): HttpResult => ({
  ok: false,
  status,
  ms: 3,
  url: 'u',
  data: null,
  error: `HTTP ${status}`,
});

describe('cliente Merus', () => {
  it('POST com os headers exigidos (Referer/Origin), timeout e retry', async () => {
    const req = vi.fn<RequestFn>().mockResolvedValue(ok([]));
    await callMerus('x', 'getveiculosconsultapassageiro', { id: null }, req);
    expect(req.mock.calls[0][0]).toMatchObject({
      url: `${MERUS_BASE}/getveiculosconsultapassageiro`,
      method: 'POST',
      headers: MERUS_HEADERS,
      body: { id: null },
      retries: 2,
      timeoutMs: 15000,
    });
    expect(MERUS_HEADERS.Referer).toBe('https://friburgo.merustracker.com.br/');
  });

  it('corpos exatos das 3 rotas', async () => {
    const req = vi.fn<RequestFn>().mockResolvedValue(ok([]));
    await rawStops(-22.28, -42.53, 1000, req);
    await rawPanel('1627', -22.28, -42.53, req);
    await rawPanel('abc', 1, 2, req);
    await rawVehicles(req);
    const bodies = req.mock.calls.map((c) => c[0].body);
    expect(bodies[0]).toEqual({
      coords: { type: 'Circle', center: { lat: -22.28, lng: -42.53 }, radius: 1000 },
    });
    expect(bodies[1]).toEqual({ id_cerca: 1627, lat: -22.28, lng: -42.53 });
    expect(bodies[2]).toMatchObject({ id_cerca: 'abc' });
    expect(bodies[3]).toEqual({ id: null, tipo: 1 });
  });

  it('propaga falhas sem lançar', async () => {
    const r = await callMerus('x', 'e', {}, vi.fn<RequestFn>().mockResolvedValue(bad(503)));
    expect(r).toMatchObject({ ok: false, status: 503, error: 'HTTP 503' });
  });
});

describe('repositório Merus', () => {
  const center = { lat: -22.2833, lng: -42.5378 };
  const spyStops = () => vi.spyOn(client, 'rawStops');
  const call = (raw: unknown, okFlag = true) => ({
    ok: okFlag,
    status: okFlag ? 200 : 500,
    ms: 1,
    raw,
    error: okFlag ? undefined : 'HTTP 500',
  });
  beforeEach(() => vi.restoreAllMocks());

  it('getNearbyStops: baixa, normaliza, ordena por distância e guarda só o normalizado', async () => {
    spyStops().mockResolvedValue(call(stops));
    const r = await getNearbyStops(center);
    expect(r.fromCache).toBe(false);
    expect(r.stops[0].id).toBe('1627');
    expect(r.stops.every((s, i, a) => i === 0 || (s.distance ?? 0) >= (a[i - 1].distance ?? 0))).toBe(true);
    const saved = await getJSON<{ stops: unknown[] }>(STOPS_CACHE_KEY);
    expect(saved?.stops).toHaveLength(3);
  });

  it('não refaz a chamada se andou menos de 400 m, mas refaz com force', async () => {
    const spy = spyStops().mockResolvedValue(call(stops));
    await getNearbyStops(center);
    const near = { lat: center.lat + 0.002, lng: center.lng }; // ~220 m
    expect((await getNearbyStops(near)).fromCache).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
    await getNearbyStops(near, true);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('refaz a chamada se andou mais de 400 m', async () => {
    const spy = spyStops().mockResolvedValue(call(stops));
    await getNearbyStops(center);
    await getNearbyStops({ lat: center.lat + 0.01, lng: center.lng }); // ~1,1 km
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('falha de rede: usa o cache antigo; sem cache, lança', async () => {
    spyStops().mockResolvedValue(call(null, false));
    await expect(getNearbyStops(center)).rejects.toThrow('HTTP 500');
    await setJSON(STOPS_CACHE_KEY, {
      center,
      radius: 1000,
      savedAt: 5,
      stops: [{ id: 'a', name: 'A', lat: -22.28, lng: -42.53, lines: [] }],
    });
    const r = await getNearbyStops({ lat: 10, lng: 10 });
    expect(r).toMatchObject({ fromCache: true, savedAt: 5 });
    expect(r.stops).toHaveLength(1);
  });

  it('getStopArrivals e getAllVehicles: erro vira exceção com mensagem', async () => {
    vi.spyOn(client, 'rawPanel').mockResolvedValue(call(null, false));
    vi.spyOn(client, 'rawVehicles').mockResolvedValue(call(vehicles));
    await expect(getStopArrivals('1', center)).rejects.toThrow('HTTP 500');
    expect(await getAllVehicles()).toHaveLength(3);
    vi.spyOn(client, 'rawVehicles').mockResolvedValue(call(null, false));
    await expect(getAllVehicles()).rejects.toThrow();
  });

  it('withDistance ordena do mais perto ao mais longe', () => {
    const list = withDistance(
      [
        { id: 'far', name: 'F', lat: -22.3, lng: -42.6, lines: [] },
        { id: 'near', name: 'N', lat: -22.2834, lng: -42.5379, lines: [] },
      ],
      center,
    );
    expect(list.map((s) => s.id)).toEqual(['near', 'far']);
  });
});
