import { Browser } from '@capacitor/browser';

export async function openExternal(url: string): Promise<void> {
  try {
    await Browser.open({ url });
  } catch {
    window.open(url, '_blank');
  }
}
