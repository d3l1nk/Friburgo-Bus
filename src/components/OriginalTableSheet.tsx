import { useState } from 'react';
import { Download, ExternalLink, X } from 'lucide-react';
import { buildHtmlDocument, saveAndShare } from '../lib/download';
import { openExternal } from '../lib/openUrl';
import { DAY_LABEL } from '../lib/time';
import type { Timetable } from '../types';

interface Props {
  lineCode: string;
  lineName: string;
  dayLabelKey: keyof typeof DAY_LABEL;
  table: Timetable | null;
  siteUrl: string;
  onClose: () => void;
}

export default function OriginalTableSheet({ lineCode, lineName, dayLabelKey, table, siteUrl, onClose }: Props) {
  const [msg, setMsg] = useState<string | null>(null);
  const title = `Linha ${lineCode} · ${lineName} · ${DAY_LABEL[dayLabelKey]}`;

  const download = async () => {
    if (!table?.originalHtml) return;
    const r = await saveAndShare(`faol-linha-${lineCode}-${dayLabelKey}.html`, title, buildHtmlDocument(title, table.originalHtml, siteUrl));
    setMsg(r === 'failed' ? 'Não foi possível salvar o arquivo.' : r === 'downloaded' ? 'Arquivo baixado.' : null);
  };

  return (
    <div className="fixed inset-0 z-[3000] bg-ink-950 flex flex-col">
      <div className="pt-safe shrink-0 border-b border-ink-700 bg-ink-950">
        <div className="flex items-center gap-2 px-4 h-14">
          <div className="flex-1 min-w-0">
            <div className="font-sign text-xl font-semibold leading-tight truncate">Tabela original</div>
            <div className="text-xs text-slate-400 truncate">{title}</div>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="h-10 w-10 grid place-items-center rounded-full active:bg-ink-700"><X size={22} /></button>
        </div>
      </div>

      <div className="scroll-y flex-1 p-4">
        {table?.originalHtml ? (
          <div className="faol-html" dangerouslySetInnerHTML={{ __html: table.originalHtml }} />
        ) : (
          <div className="rounded-xl bg-warn-soft border border-warn/40 p-4 text-sm">
            A tabela original ainda não foi carregada neste aparelho (ou foi salva por uma versão anterior). Conecte-se à internet e atualize a tabela, ou abra direto no site da FAOL.
          </div>
        )}
        {table && <div className="text-xs text-slate-500 mt-2">Atualizada em {new Date(table.fetchedAt).toLocaleString('pt-BR')}</div>}
        {msg && <div className="text-sm text-slate-300 mt-2">{msg}</div>}
      </div>

      <div className="shrink-0 grid grid-cols-2 gap-3 p-3 pb-safe border-t border-ink-700 bg-ink-900">
        <button onClick={() => void openExternal(siteUrl)} className="h-12 rounded-xl bg-ink-800 border border-ink-600 flex items-center justify-center gap-2 font-medium active:bg-ink-700">
          <ExternalLink size={18} /> Abrir no site
        </button>
        <button onClick={download} disabled={!table?.originalHtml} className="h-12 rounded-xl bg-route text-ink-950 flex items-center justify-center gap-2 font-semibold disabled:opacity-40">
          <Download size={18} /> Baixar / enviar
        </button>
      </div>
    </div>
  );
}
