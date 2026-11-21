import { Geolocation } from '@capacitor/geolocation';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ESTACAO_LIVRE, formatDistance, getPosition, haversine } from './geo';

describe('haversine', () => {
  it('distância de um ponto até ele mesmo é 0', () => {
    expect(haversine(ESTACAO_LIVRE, ESTACAO_LIVRE)).toBe(0);
  });
  it('1 grau de latitude ≈ 111 km', () => {
    const d = haversine({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_000);
  });
  it('é simétrica', () => {
    const a = { lat: -22.28, lng: -42.53 };
    const b = { lat: -22.29, lng: -42.54 };
    expect(haversine(a, b)).toBeCloseTo(haversine(b, a), 6);
  });
});

describe('formatDistance', () => {
  it('vazio quando indefinida', () => expect(formatDistance(undefined)).toBe(''));
  it('abaixo de 1 km: metros arredondados para a dezena', () => {
    expect(formatDistance(0)).toBe('0 m');
    expect(formatDistance(94)).toBe('90 m');
    expect(formatDistance(996)).toBe('1000 m');
  });
  it('a partir de 1 km: vírgula decimal', () => {
    expect(formatDistance(1000)).toBe('1,0 km');
    expect(formatDistance(1560)).toBe('1,6 km');
  });
});

describe('getPosition', () => {
  const pos = (lat: number, lng: number) => ({ coords: { latitude: lat, longitude: lng } });
  beforeEach(() => {
    vi.mocked(Geolocation.checkPermissions)
      .mockReset()
      .mockResolvedValue({ location: 'granted', coarseLocation: 'granted' });
    vi.mocked(Geolocation.requestPermissions).mockReset();
    vi.mocked(Geolocation.getCurrentPosition).mockReset();
  });

  it('usa a localização rápida (rede) e depois refina com o GPS se andou mais de 30 m', async () => {
    const quick = pos(-22.28, -42.53);
    const precise = pos(-22.2805, -42.53);
    vi.mocked(Geolocation.getCurrentPosition)
      .mockResolvedValueOnce(quick as never)
      .mockResolvedValueOnce(precise as never);
    const onRefine = vi.fn();
    const fix = await getPosition(onRefine);
    expect(fix).toEqual({ pos: { lat: -22.28, lng: -42.53 }, usingFallback: false });
    expect(vi.mocked(Geolocation.getCurrentPosition).mock.calls[0][0]).toMatchObject({
      enableHighAccuracy: false,
      timeout: 3000,
    });
    await vi.waitFor(() => expect(onRefine).toHaveBeenCalled());
    expect(onRefine.mock.calls[0][0].pos).toEqual({ lat: -22.2805, lng: -42.53 });
  });

  it('não chama onRefine se o GPS preciso é praticamente o mesmo ponto', async () => {
    vi.mocked(Geolocation.getCurrentPosition).mockResolvedValue(pos(-22.28, -42.53) as never);
    const onRefine = vi.fn();
    await getPosition(onRefine);
    await new Promise((r) => setTimeout(r, 20));
    expect(onRefine).not.toHaveBeenCalled();
  });

  it('cai na Estação Livre quando não há localização', async () => {
    vi.mocked(Geolocation.getCurrentPosition).mockRejectedValue(new Error('denied'));
    expect(await getPosition()).toEqual({ pos: ESTACAO_LIVRE, usingFallback: true });
  });

  it('pede permissão quando ainda não concedida', async () => {
    vi.mocked(Geolocation.checkPermissions).mockResolvedValue({
      location: 'prompt',
      coarseLocation: 'prompt',
    });
    vi.mocked(Geolocation.getCurrentPosition).mockRejectedValue(new Error('x'));
    await getPosition();
    expect(Geolocation.requestPermissions).toHaveBeenCalled();
  });
});
