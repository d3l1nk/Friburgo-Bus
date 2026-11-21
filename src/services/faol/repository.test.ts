import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getJSON, listKeys, setJSON } from '../../lib/storage';
import type { Timetable } from '../../types';
import twoRow from './__fixtures__/timetable-two-row-header.html?raw';
import horarios from './__fixtures__/horarios-page.html?raw';
import { fetchHtml } from './transport';
import { clearCachedTables, downloadAllDays, getAlerts, getTimetable, listCachedTables } from './repository';

vi.mock('./transport', () => ({ fetchHtml: vi.fn() }));
const fetchMock = vi.mocked(fetchHtml);
const res = (ok: boolean, status: number, html = '') => ({
  res: { ok, status, ms: 1, url: 'u', data: html, error: ok ? undefined : `HTTP ${status}` },
  html,
});
const cached = (): Timetable => ({
  code: '58',
  day: 'U',
  fetchedAt: Date.now(),
  legend: [],
  columns: [{ origin: 'Estação Livre', isTerminal: true, departures: [{ time: '04:00', minutes: 240 }] }],
});

beforeEach(() => {
  fetchMock.mockReset();
});

describe('getTimetable', () => {
  it('cache recente: não vai à rede', async () => {
    await setJSON('faol:table:58-U', cached());
    const r = await getTimetable('58', 'U');
    expect(r.fromCache).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sem cache: baixa, interpreta, guarda e registra a URL de origem', async () => {
    fetchMock.mockResolvedValue(res(true, 200, twoRow));
    const r = await getTimetable('58', 'U');
    expect(r.fromCache).toBe(false);
    expect(r.table?.columns[0].origin).toBe('Estação Livre');
    expect(r.table?.sourceUrl).toBe('https://faol.com.br/tabelas/58-U');
    expect(await listCachedTables()).toEqual(['58-U']);
  });

  it('force ignora o cache recente', async () => {
    await setJSON('faol:table:58-U', cached());
    fetchMock.mockResolvedValue(res(true, 200, twoRow));
    expect((await getTimetable('58', 'U', true)).fromCache).toBe(false);
    expect(fetchMock).toHaveBeenCalled();
  });

  it('usa o link real guardado e tenta a URL padrão se ele falhar', async () => {
    await setJSON('faol:alerts:v2', {
      savedAt: 1,
      alerts: [],
      links: { '58': { U: 'https://faol.com.br/real/58u.html' } },
    });
    fetchMock.mockResolvedValueOnce(res(false, 404)).mockResolvedValueOnce(res(true, 200, twoRow));
    const r = await getTimetable('58', 'U');
    expect(fetchMock.mock.calls[0][1]).toBe('https://faol.com.br/real/58u.html');
    expect(fetchMock.mock.calls[1][1]).toBe('https://faol.com.br/tabelas/58-U');
    expect(r.table?.sourceUrl).toBe('https://faol.com.br/tabelas/58-U');
  });

  it('sem rede e sem cache: erro amigável', async () => {
    fetchMock.mockResolvedValue(res(false, 0));
    const r = await getTimetable('58', 'U');
    expect(r.table).toBeNull();
    expect(r.error).toContain('Sem conexão');
  });

  it('404 sem cache: informa que a tabela não existe', async () => {
    fetchMock.mockResolvedValue(res(false, 404));
    expect((await getTimetable('54', 'D')).error).toBe('Esta tabela não existe para este dia.');
  });

  it('rede falhou mas há cache antigo: devolve o cache', async () => {
    await setJSON('faol:table:58-U', { ...cached(), fetchedAt: 1 });
    fetchMock.mockResolvedValue(res(false, 500));
    const r = await getTimetable('58', 'U');
    expect(r.fromCache).toBe(true);
    expect(r.table?.columns).toHaveLength(1);
  });

  it('página sem horários não sobrescreve o cache bom', async () => {
    await setJSON('faol:table:58-U', { ...cached(), fetchedAt: 1 });
    fetchMock.mockResolvedValue(res(true, 200, '<p>indisponível</p>'));
    const r = await getTimetable('58', 'U');
    expect(r.fromCache).toBe(true);
    expect((await getJSON<Timetable>('faol:table:58-U'))?.fetchedAt).toBe(1);
  });

  it('página sem horários e sem cache: devolve a tabela vazia (com texto bruto) sem salvar', async () => {
    fetchMock.mockResolvedValue(res(true, 200, '<p>indisponível</p>'));
    const r = await getTimetable('58', 'U');
    expect(r.table?.rawText).toContain('indisponível');
    expect(await listCachedTables()).toEqual([]);
  });
});

describe('getAlerts', () => {
  it('sucesso: avisos + links, e guarda em cache', async () => {
    fetchMock.mockResolvedValue(res(true, 200, horarios));
    const r = await getAlerts();
    expect(r.fromCache).toBe(false);
    expect(r.alerts).toHaveLength(2);
    expect(r.links['58'].U).toBeDefined();
    expect((await getJSON<{ alerts: unknown[] }>('faol:alerts:v2'))?.alerts).toHaveLength(2);
  });

  it('falha de rede: devolve o cache e o erro', async () => {
    await setJSON('faol:alerts:v2', {
      savedAt: 9,
      alerts: [{ lineKey: '10', kind: 'ATENÇÃO', text: 'x' }],
      links: {},
    });
    fetchMock.mockResolvedValue(res(false, 0));
    const r = await getAlerts();
    expect(r).toMatchObject({ fromCache: true, savedAt: 9, error: 'HTTP 0' });
    expect(r.alerts).toHaveLength(1);
  });

  it('falha de rede sem cache: lista vazia, sem lançar', async () => {
    fetchMock.mockResolvedValue(res(false, 0));
    expect((await getAlerts()).alerts).toEqual([]);
  });
});

describe('downloadAllDays / cache', () => {
  it('baixa todos os dias da linha (a 54 pula o domingo e fica com U, S e C)', async () => {
    fetchMock.mockResolvedValue(res(true, 200, twoRow));
    expect(await downloadAllDays('58')).toEqual({ ok: 3, total: 3 });
    expect(await downloadAllDays('54')).toEqual({ ok: 3, total: 3 });
  });

  it('clearCachedTables apaga só as tabelas', async () => {
    await setJSON('faol:table:58-U', cached());
    await setJSON('favorites:v1', {});
    await clearCachedTables();
    expect(await listKeys('faol:table:')).toEqual([]);
    expect(await getJSON('favorites:v1')).toEqual({});
  });
});
