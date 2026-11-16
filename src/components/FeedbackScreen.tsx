import { useEffect, useState } from 'react';
import { ArrowLeft, Send } from 'lucide-react';
import { Share } from '@capacitor/share';
import { Header, IconBtn } from './ui';
import { APP_NAME, APP_VERSION, FEEDBACK_EMAIL } from '../config';
import { FAOL_LINES } from '../data/faolLines';
import { getJSON, setJSON } from '../lib/storage';
import type { FeedbackItem } from '../types';

const KEY = 'feedback:v1';
const KINDS: { id: FeedbackItem['kind']; label: string }[] = [
  { id: 'reclamacao', label: 'Reclamação' },
  { id: 'sugestao', label: 'Sugestão' },
  { id: 'elogio', label: 'Elogio' },
];
const field = 'w-full rounded-lg bg-ink-950 border border-ink-600 px-3 text-sm outline-none focus:border-route';

export default function FeedbackScreen({ onBack, prefillLine }: { onBack: () => void; prefillLine?: string | null }) {
  const [kind, setKind] = useState<FeedbackItem['kind']>('reclamacao');
  const [lineCode, setLineCode] = useState(prefillLine ?? '');
  const [message, setMessage] = useState('');
  const [contact, setContact] = useState('');
  const [done, setDone] = useState<string | null>(null);
  const [history, setHistory] = useState<FeedbackItem[]>([]);

  useEffect(() => {
    getJSON<FeedbackItem[]>(KEY).then((h) => h && setHistory(h));
  }, []);

  const send = async () => {
    const item: FeedbackItem = { id: `f${Date.now()}`, kind, lineCode: lineCode || undefined, message: message.trim(), contact: contact.trim() || undefined, createdAt: Date.now() };
    if (!item.message) return;
    const label = KINDS.find((k) => k.id === kind)!.label;
    const text = `[${APP_NAME} v${APP_VERSION}] ${label}${item.lineCode ? ` · Linha ${item.lineCode}` : ''}\n\n${item.message}${item.contact ? `\n\nContato: ${item.contact}` : ''}`;
    const next = [item, ...history].slice(0, 20);
    setHistory(next);
    await setJSON(KEY, next);
    setMessage('');
    if (FEEDBACK_EMAIL) {
      window.location.href = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(`${APP_NAME} · ${label}`)}&body=${encodeURIComponent(text)}`;
      setDone('Abrindo seu aplicativo de e-mail. Obrigado pela mensagem!');
    } else {
      try {
        await Share.share({ title: `${APP_NAME} · ${label}`, text, dialogTitle: 'Enviar feedback por' });
        setDone('Mensagem preparada. Obrigado por ajudar a melhorar o app!');
      } catch {
        setDone('Sua mensagem foi salva neste aparelho.');
      }
    }
  };

  return (
    <div className="flex flex-col h-full">
      <Header title="Feedback" sub="Reclamações e sugestões" right={<IconBtn onClick={onBack} label="Voltar"><ArrowLeft size={20} /></IconBtn>} />
      <div className="scroll-y flex-1 px-4 py-4 space-y-4">
        <div className="flex gap-2">
          {KINDS.map((k) => (
            <button key={k.id} onClick={() => setKind(k.id)} className={`flex-1 h-10 rounded-full text-sm font-medium border ${kind === k.id ? 'bg-route text-ink-950 border-route' : 'bg-ink-800 border-ink-600 text-slate-300'}`}>{k.label}</button>
          ))}
        </div>
        <label className="block text-xs text-slate-400">
          Linha (opcional)
          <select className={`${field} h-11`} value={lineCode} onChange={(e) => setLineCode(e.target.value)}>
            <option value="">Não se refere a uma linha</option>
            {FAOL_LINES.map((l) => <option key={l.code} value={l.code}>{l.code} · {l.name}</option>)}
          </select>
        </label>
        <label className="block text-xs text-slate-400">
          Mensagem
          <textarea className={`${field} py-2 min-h-[140px]`} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Conte o que aconteceu ou o que podemos melhorar." />
        </label>
        <label className="block text-xs text-slate-400">
          Seu contato (opcional)
          <input className={`${field} h-11`} value={contact} onChange={(e) => setContact(e.target.value)} placeholder="E-mail ou telefone, se quiser resposta" />
        </label>
        <button onClick={send} disabled={!message.trim()} className="w-full h-12 rounded-xl bg-route text-ink-950 font-semibold flex items-center justify-center gap-2 disabled:opacity-40">
          <Send size={18} /> Enviar
        </button>
        {done && <div className="rounded-xl bg-go-soft border border-go/40 text-sm p-3">{done}</div>}
        <div className="text-xs text-slate-500">
          O Where is my bus? é independente: sua mensagem é enviada ao responsável pelo app, não à FAOL. Para reclamações sobre o serviço de ônibus, use também o canal oficial da concessionária.
        </div>

        {history.length > 0 && (
          <section>
            <h2 className="font-sign text-lg font-semibold mb-2">Enviados neste aparelho</h2>
            <div className="space-y-2">
              {history.slice(0, 5).map((h) => (
                <div key={h.id} className="rounded-xl bg-ink-800 border border-ink-700 p-3 text-sm">
                  <div className="text-xs text-slate-400">{KINDS.find((k) => k.id === h.kind)?.label}{h.lineCode ? ` · Linha ${h.lineCode}` : ''} · {new Date(h.createdAt).toLocaleDateString('pt-BR')}</div>
                  <div className="mt-1 line-clamp-3">{h.message}</div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
