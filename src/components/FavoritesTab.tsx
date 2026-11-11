import { useState } from 'react';
import { CheckCircle2, Download, MapPin, Star, Trash2 } from 'lucide-react';
import { Empty, Header, LineBadge } from './ui';
import { DAY_LABEL } from '../lib/time';
import { findLine } from '../data/faolLines';
import { clearCachedTables, daysForLine, downloadAllDays } from '../services/faolScraper';
import type { Favorites, MerusStop } from '../types';

interface Props {
  favs: Favorites;
  cached: Set<string>;
  onOpenLine: (code: string) => void;
  onOpenStop: (s: MerusStop) => void;
  toggleLine: (code: string) => void;
  toggleStop: (s: MerusStop) => void;
  refreshCached: () => void;
}

export default function FavoritesTab(p: Props) {
  const [busy, setBusy] = useState<string | null>(null);

  const download = async (code: string) => {
    setBusy(code);
    await downloadAllDays(code);
    p.refreshCached();
    setBusy(null);
  };

  const clear = async () => {
    await clearCachedTables();
    p.refreshCached();
  };

  return (
    <div className="flex flex-col h-full">
      <Header title="Favoritos e offline" sub={`${p.cached.size} tabelas salvas no aparelho`} />
      <div className="scroll-y flex-1 px-4 py-4 space-y-6">
        <section>
          <h2 className="font-sign text-xl font-semibold mb-2">Linhas</h2>
          {!p.favs.lines.length && <Empty icon={<Star size={28} />} title="Nenhuma linha favorita" hint="Abra uma linha e toque na estrela." />}
          <div className="space-y-3">
            {p.favs.lines.map((code) => {
              const line = findLine(code);
              const days = daysForLine(code);
              const done = days.filter((d) => p.cached.has(`${code}-${d}`)).length;
              return (
                <div key={code} className="rounded-2xl bg-ink-800 border border-ink-600 p-3">
                  <button onClick={() => p.onOpenLine(code)} className="w-full flex items-center gap-3 text-left">
                    <LineBadge code={code} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{line?.name ?? 'Linha'}</div>
                      <div className="text-xs text-slate-400 flex gap-2 mt-0.5 flex-wrap">
                        {days.map((d) => (
                          <span key={d} className={`inline-flex items-center gap-1 ${p.cached.has(`${code}-${d}`) ? 'text-go' : 'text-slate-500'}`}>
                            {p.cached.has(`${code}-${d}`) && <CheckCircle2 size={12} />}
                            {DAY_LABEL[d]}
                          </span>
                        ))}
                      </div>
                    </div>
                  </button>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => download(code)}
                      disabled={busy === code}
                      className="flex-1 h-10 rounded-lg bg-ink-700 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                      <Download size={16} /> {busy === code ? 'Baixando…' : done === days.length ? 'Atualizar offline' : 'Baixar offline'}
                    </button>
                    <button onClick={() => p.toggleLine(code)} className="h-10 px-3 rounded-lg bg-ink-700 text-warn" aria-label="Remover favorito">
                      <Star size={18} className="fill-warn" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="font-sign text-xl font-semibold mb-2">Pontos</h2>
          {!p.favs.stops.length && <Empty icon={<MapPin size={28} />} title="Nenhum ponto favorito" hint="No Radar, escolha um ponto e toque na estrela." />}
          <div className="space-y-2">
            {p.favs.stops.map((s) => (
              <div key={s.id} className="flex items-center gap-2 rounded-xl bg-ink-800 border border-ink-600 pl-3">
                <button onClick={() => p.onOpenStop({ ...s, lines: [] })} className="flex-1 min-w-0 text-left py-3">
                  <div className="font-medium truncate">{s.name}</div>
                  <div className="text-xs text-slate-400">Ver ônibus chegando</div>
                </button>
                <button onClick={() => p.toggleStop({ ...s, lines: [] })} className="h-12 w-12 grid place-items-center text-warn" aria-label="Remover favorito">
                  <Star size={18} className="fill-warn" />
                </button>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="font-sign text-xl font-semibold mb-2">Tabelas salvas</h2>
          <div className="rounded-xl bg-ink-800 border border-ink-600 p-3 text-sm text-slate-300">
            {p.cached.size ? (
              <div className="flex flex-wrap gap-2 mb-3">
                {[...p.cached].sort().map((k) => (
                  <span key={k} className="num text-sm bg-ink-700 rounded px-2 py-0.5">{k}</span>
                ))}
              </div>
            ) : (
              <div className="mb-3 text-slate-400">Toda tabela que você abrir fica salva e funciona sem internet.</div>
            )}
            <button onClick={clear} disabled={!p.cached.size} className="h-10 px-4 rounded-lg bg-halt-soft text-halt text-sm font-medium flex items-center gap-2 disabled:opacity-40">
              <Trash2 size={16} /> Apagar cópias offline
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
