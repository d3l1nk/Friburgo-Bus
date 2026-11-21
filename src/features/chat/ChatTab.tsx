import { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import LuizAvatar from '../../components/ui/LuizAvatar';
import {
  GREETING,
  QUICK_MESSAGES,
  luizAnswer,
  type LuizAction,
  type LuizContext,
  type LuizMemory,
  type LuizReply,
} from '../../services/luiz';

interface Msg {
  id: number;
  from: 'bot' | 'user';
  text: string;
  actions?: LuizAction[];
}

interface Props {
  ctx: LuizContext;
  onAction: (a: LuizAction) => void;
}

export default function ChatTab({ ctx, onAction }: Props) {
  const [msgs, setMsgs] = useState<Msg[]>([{ id: 0, from: 'bot', text: GREETING.text }]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const mem = useRef<LuizMemory>({});
  const idRef = useRef(1);
  const end = useRef<HTMLDivElement>(null);
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [msgs, typing]);

  const send = async (text: string) => {
    const t = text.trim();
    if (!t || typing) return;
    setInput('');
    setMsgs((m) => [...m, { id: idRef.current++, from: 'user', text: t }]);
    setTyping(true);
    let reply: LuizReply;
    try {
      reply = await luizAnswer(t, ctxRef.current, mem.current);
    } catch {
      reply = { text: 'Tive um problema para responder agora. Tente de novo em instantes.' };
    }
    await new Promise((r) => setTimeout(r, 350));
    setTyping(false);
    setMsgs((m) => [...m, { id: idRef.current++, from: 'bot', text: reply.text, actions: reply.actions }]);
  };

  const act = (a: LuizAction) => (a.kind === 'ask' ? void send(a.payload ?? a.label) : onAction(a));

  return (
    <div className="flex flex-col h-full">
      <div className="pt-safe shrink-0 bg-ink-950 border-b border-ink-700">
        <div className="flex items-center gap-3 px-4 h-16">
          <LuizAvatar size={42} />
          <div>
            <h1 className="font-sign text-2xl font-semibold leading-none">Luiz</h1>
            <div className="text-xs text-go mt-1 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-go" /> Assistente virtual · funciona no aparelho
            </div>
          </div>
        </div>
      </div>

      <div className="scroll-y flex-1 px-3 py-4 space-y-3">
        {msgs.map((m) => (
          <div key={m.id} className={`flex gap-2 ${m.from === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.from === 'bot' && (
              <div className="shrink-0 mt-1">
                <LuizAvatar size={28} />
              </div>
            )}
            <div className={`max-w-[82%] ${m.from === 'user' ? '' : 'space-y-2'}`}>
              <div
                className={`rounded-2xl px-3.5 py-2.5 text-[15px] leading-snug whitespace-pre-line ${
                  m.from === 'user'
                    ? 'bg-route text-ink-950 rounded-br-md font-medium'
                    : 'bg-ink-800 border border-ink-700 rounded-bl-md'
                }`}
              >
                {m.text}
              </div>
              {m.actions && m.actions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {m.actions.map((a, i) => (
                    <button
                      key={i}
                      onClick={() => act(a)}
                      className="h-9 px-3.5 rounded-full border border-route/60 text-route text-sm font-medium active:bg-route-soft"
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {typing && (
          <div className="flex gap-2 items-center">
            <LuizAvatar size={28} />
            <div className="bg-ink-800 border border-ink-700 rounded-2xl rounded-bl-md px-4 py-3 flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-2 w-2 rounded-full bg-slate-400 animate-pulse"
                  style={{ animationDelay: `${i * 150}ms` }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={end} />
      </div>

      <div className="shrink-0 bg-ink-900 border-t border-ink-700">
        <div className="flex gap-2 overflow-x-auto scroll-y px-3 pt-2">
          {QUICK_MESSAGES.map((q) => (
            <button
              key={q}
              onClick={() => void send(q)}
              className="shrink-0 h-9 px-3.5 rounded-full bg-ink-800 border border-ink-600 text-sm text-slate-200 active:bg-ink-700"
            >
              {q}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
          className="flex items-center gap-2 p-3"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pergunte ao Luiz…"
            className="flex-1 h-12 rounded-full bg-ink-800 border border-ink-600 px-4 outline-none focus:border-route placeholder:text-slate-500"
          />
          <button
            type="submit"
            disabled={!input.trim() || typing}
            className="h-12 w-12 rounded-full bg-route text-ink-950 grid place-items-center disabled:opacity-40"
            aria-label="Enviar"
          >
            <Send size={20} />
          </button>
        </form>
      </div>
    </div>
  );
}
