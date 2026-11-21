import { LocalNotifications } from '@capacitor/local-notifications';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AlertRule, MerusVehicle } from '../types';
import { describeRule, ensurePermission, evaluateLiveRules, hasLiveRules, newRule } from './notifications';

const veh = (id: string, lat: number, lng: number, lineKey = '58'): MerusVehicle => ({
  id, lineKey, lineLabel: lineKey, lineName: '', lat, lng, heading: null, direction: '', speed: null, updatedAt: '', raw: {},
}); // prettier-ignore
const base = { createdAt: 0, enabled: true, lineCode: '58' };
const depart: AlertRule = { ...base, id: 'd', nid: 1, type: 'depart' };
const pass: AlertRule = {
  ...base,
  id: 'p',
  nid: 2,
  type: 'pass',
  radius: 300,
  stop: { id: 's', name: 'Ponto X', lat: -22.283, lng: -42.535 },
};

beforeEach(() => {
  vi.mocked(LocalNotifications.schedule).mockClear();
});

describe('regras de alerta', () => {
  it('newRule gera nid sequencial e id único', () => {
    const a = newRule([], { type: 'pass', lineCode: '58' });
    const b = newRule([a], { type: 'pass', lineCode: '58' });
    expect([a.nid, b.nid]).toEqual([1, 2]);
    expect(a.id).not.toBe(b.id);
    expect(a.enabled).toBe(true);
  });
  it('hasLiveRules considera só depart/pass ativos', () => {
    expect(
      hasLiveRules([
        { ...depart, enabled: false },
        { ...base, id: 's', nid: 3, type: 'schedule' },
      ]),
    ).toBe(false);
    expect(hasLiveRules([pass])).toBe(true);
  });
  it('describeRule', () => {
    expect(
      describeRule({ ...base, id: 'x', nid: 9, type: 'schedule', originName: 'Estação Livre', leadMin: 5 }),
    ).toContain('5 min antes');
    expect(describeRule(depart)).toContain('Estação Livre');
    expect(describeRule(pass)).toContain('Ponto X');
  });
});

describe('evaluateLiveRules (GPS)', () => {
  it('"saiu do ponto final": dispara ao sair do raio, uma vez (cooldown)', () => {
    expect(evaluateLiveRules([depart], [veh('v1', -22.2819, -42.5312)])).toEqual([]); // dentro de 150 m
    const fired = evaluateLiveRules([depart], [veh('v1', -22.285, -42.536)]); // ~700 m
    expect(fired).toHaveLength(1);
    expect(fired[0]).toContain('acabou de sair de Estação Livre');
    expect(evaluateLiveRules([depart], [veh('v1', -22.29, -42.54)])).toEqual([]);
    expect(LocalNotifications.schedule).toHaveBeenCalledTimes(1);
  });

  it('"passando no ponto": dispara ao entrar no raio e ignora outras linhas', () => {
    const far = veh('p1', -22.29, -42.55);
    expect(evaluateLiveRules([pass], [far])).toEqual([]);
    const fired = evaluateLiveRules(
      [pass],
      [veh('p1', -22.2831, -42.5351), veh('o1', -22.283, -42.535, '10')],
    );
    expect(fired).toHaveLength(1);
    expect(fired[0]).toContain('Ponto X');
  });

  it('regras desativadas ou do tipo "schedule" não disparam; sem veículos nada acontece', () => {
    expect(evaluateLiveRules([{ ...pass, id: 'off', enabled: false }], [veh('z', -22.283, -42.535)])).toEqual(
      [],
    );
    expect(
      evaluateLiveRules([{ ...base, id: 'sc', nid: 5, type: 'schedule' }], [veh('z', -22.283, -42.535)]),
    ).toEqual([]);
    expect(evaluateLiveRules([pass], [])).toEqual([]);
  });
});

describe('ensurePermission', () => {
  it('já concedida; pede quando não; falha vira false', async () => {
    vi.mocked(LocalNotifications.checkPermissions).mockResolvedValueOnce({ display: 'granted' });
    expect(await ensurePermission()).toBe(true);
    vi.mocked(LocalNotifications.checkPermissions).mockResolvedValueOnce({ display: 'prompt' });
    vi.mocked(LocalNotifications.requestPermissions).mockResolvedValueOnce({ display: 'denied' });
    expect(await ensurePermission()).toBe(false);
    vi.mocked(LocalNotifications.checkPermissions).mockRejectedValueOnce(new Error('x'));
    expect(await ensurePermission()).toBe(false);
  });
});
