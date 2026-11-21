import { describe, expect, it, vi } from 'vitest';
import { getJSON, setJSON } from '../../lib/storage';
import type { FaolSnapshot, HttpResult } from '../../types';
import { SNAPSHOT_KEY, isFaolSnapshot, isSnapshotFresh, loadSnapshot, snapshotTable } from './snapshot';

const table = (code: string) => ({
  code,
  day: 'U' as const,
  fetchedAt: 1,
  legend: [],
  columns: [{ origin: 'Estação Livre', isTerminal: true, departures: [{ time: '04:00', minutes: 240 }] }],
});
const snap = (over: Partial<FaolSnapshot> = {}): FaolSnapshot => ({
  version: 1,
  generatedAt: Date.now(),
  alerts: [],
  links: {},
  tables: { '58-U': table('58') },
  ...over,
});
const ok = (data: unknown): HttpResult => ({ ok: true, status: 200, ms: 1, url: 'u', data });
const fail = (): HttpResult => ({ ok: false, status: 0, ms: 1, url: 'u', data: null, error: 'offline' });

describe('isFaolSnapshot', () => {
  it('aceita a estrutura válida', () => expect(isFaolSnapshot(snap())).toBe(true));
  it.each([
    null,
    undefined,
    42,
    'x',
    [],
    {},
    { version: 2 },
    { ...snap(), version: 2 },
    { ...snap(), alerts: 'x' },
    { ...snap(), tables: { a: 1 } },
  ])('rejeita %j', (v) => expect(isFaolSnapshot(v)).toBe(false));
});

describe('loadSnapshot', () => {
  it('sem URL configurada não faz nada', async () => {
    const request = vi.fn();
    expect(await loadSnapshot('', request)).toBeNull();
    expect(request).not.toHaveBeenCalled();
  });

  it('baixa, valida e guarda cópia local', async () => {
    const request = vi.fn().mockResolvedValue(ok(snap()));
    const s = await loadSnapshot('http://x/faol.json', request);
    expect(s?.version).toBe(1);
    expect(request.mock.calls[0][0]).toMatchObject({ url: 'http://x/faol.json', retries: 1 });
    expect(await getJSON(SNAPSHOT_KEY)).not.toBeNull();
  });

  it('usa a cópia local recente sem ir à rede', async () => {
    await setJSON(SNAPSHOT_KEY, { fetchedAt: Date.now(), snapshot: snap() });
    const request = vi.fn();
    expect(await loadSnapshot('http://x', request)).not.toBeNull();
    expect(request).not.toHaveBeenCalled();
  });

  it('rede falhou: cai na última cópia boa, mesmo antiga', async () => {
    const old = snap({ generatedAt: 5 });
    await setJSON(SNAPSHOT_KEY, { fetchedAt: 1, snapshot: old });
    expect((await loadSnapshot('http://x', vi.fn().mockResolvedValue(fail())))?.generatedAt).toBe(5);
  });

  it('JSON malformado nunca entra: mantém a cópia anterior ou devolve null', async () => {
    const bad = vi.fn().mockResolvedValue(ok({ version: 1, tables: 'x' }));
    expect(await loadSnapshot('http://x', bad)).toBeNull();
    await setJSON(SNAPSHOT_KEY, { fetchedAt: 1, snapshot: snap({ generatedAt: 7 }) });
    expect((await loadSnapshot('http://x', bad))?.generatedAt).toBe(7);
  });
});

describe('snapshotTable / isSnapshotFresh', () => {
  it('devolve a tabela só se ela tiver saídas', () => {
    expect(snapshotTable(snap(), '58', 'U')?.code).toBe('58');
    expect(snapshotTable(snap(), '10', 'U')).toBeNull();
    expect(snapshotTable(null, '58', 'U')).toBeNull();
    const empty = snap({
      tables: { '58-U': { ...table('58'), columns: [{ origin: 'x', isTerminal: false, departures: [] }] } },
    });
    expect(snapshotTable(empty, '58', 'U')).toBeNull();
  });
  it('fresco por 36 h', () => {
    expect(isSnapshotFresh(snap())).toBe(true);
    expect(isSnapshotFresh(snap({ generatedAt: Date.now() - 40 * 3600 * 1000 }))).toBe(false);
  });
});
