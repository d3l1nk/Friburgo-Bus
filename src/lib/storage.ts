import { Preferences } from '@capacitor/preferences';

export async function getJSON<T>(key: string): Promise<T | null> {
  try {
    const { value } = await Preferences.get({ key });
    return value ? (JSON.parse(value) as T) : null;
  } catch {
    return null;
  }
}

export async function setJSON(key: string, value: unknown): Promise<void> {
  try {
    await Preferences.set({ key, value: JSON.stringify(value) });
  } catch (e) {
    console.warn('storage.set falhou', key, e);
  }
}

export async function removeKey(key: string): Promise<void> {
  try {
    await Preferences.remove({ key });
  } catch {
    /* ignora */
  }
}

export async function listKeys(prefix: string): Promise<string[]> {
  try {
    const { keys } = await Preferences.keys();
    return keys.filter((k) => k.startsWith(prefix));
  } catch {
    return [];
  }
}
