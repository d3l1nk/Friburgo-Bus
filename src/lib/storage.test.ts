import { Preferences } from '@capacitor/preferences';
import { describe, expect, it, vi } from 'vitest';
import { getJSON, listKeys, removeKey, setJSON } from './storage';

describe('storage', () => {
  it('guarda e lê objetos JSON', async () => {
    await setJSON('k', { a: 1, b: ['x'] });
    expect(await getJSON('k')).toEqual({ a: 1, b: ['x'] });
  });

  it('devolve null para chave inexistente', async () => {
    expect(await getJSON('nada')).toBeNull();
  });

  it('devolve null (sem lançar) quando o valor salvo é JSON malformado', async () => {
    await Preferences.set({ key: 'ruim', value: '{nao-e-json' });
    expect(await getJSON('ruim')).toBeNull();
  });

  it('devolve null quando o plugin falha', async () => {
    vi.spyOn(Preferences, 'get').mockRejectedValueOnce(new Error('falha nativa'));
    expect(await getJSON('k')).toBeNull();
  });

  it('setJSON não lança quando o plugin falha', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Preferences, 'set').mockRejectedValueOnce(new Error('cheio'));
    await expect(setJSON('k', 1)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
  });

  it('removeKey apaga e tolera falhas', async () => {
    await setJSON('k', 1);
    await removeKey('k');
    expect(await getJSON('k')).toBeNull();
    vi.spyOn(Preferences, 'remove').mockRejectedValueOnce(new Error('x'));
    await expect(removeKey('k')).resolves.toBeUndefined();
  });

  it('listKeys filtra por prefixo', async () => {
    await setJSON('faol:table:58-U', 1);
    await setJSON('faol:table:10-S', 1);
    await setJSON('favorites:v1', 1);
    expect((await listKeys('faol:table:')).sort()).toEqual(['faol:table:10-S', 'faol:table:58-U']);
  });

  it('listKeys devolve [] quando o plugin falha', async () => {
    vi.spyOn(Preferences, 'keys').mockRejectedValueOnce(new Error('x'));
    expect(await listKeys('a')).toEqual([]);
  });
});
