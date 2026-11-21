import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

const STYLE = `body{font-family:system-ui,sans-serif;margin:16px;color:#111}h1{font-size:18px}
table{border-collapse:collapse;margin:12px 0;font-size:14px}th,td{border:1px solid #bbb;padding:4px 8px;text-align:center}
th{background:#eef2f7}p{margin:4px 0}small{color:#666}`;

export function buildHtmlDocument(title: string, bodyHtml: string, sourceUrl?: string): string {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>${STYLE}</style></head><body><h1>${title}</h1>${bodyHtml}<p><small>Fonte: ${sourceUrl ?? 'faol.com.br'} · salvo pelo Where is my bus? em ${new Date().toLocaleString('pt-BR')}. Confira sempre os canais oficiais da concessionária.</small></p></body></html>`;
}

/** Salva o arquivo e abre o menu de compartilhar do Android (permite "Salvar em Arquivos/Drive"). */
export async function saveAndShare(
  filename: string,
  title: string,
  content: string,
): Promise<'shared' | 'downloaded' | 'failed'> {
  try {
    const canShare = await Share.canShare()
      .then((r) => r.value)
      .catch(() => false);
    if (canShare) {
      const res = await Filesystem.writeFile({
        path: filename,
        data: content,
        directory: Directory.Cache,
        encoding: Encoding.UTF8,
      });
      await Share.share({ title, url: res.uri, dialogTitle: 'Salvar ou compartilhar tabela' });
      return 'shared';
    }
    const blob = new Blob([content], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
    return 'downloaded';
  } catch {
    return 'failed';
  }
}
