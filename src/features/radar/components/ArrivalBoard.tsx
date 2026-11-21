import { memo } from 'react';
import { ArrowLeft, MapPin, RefreshCw, Star } from 'lucide-react';
import { Empty, IconBtn, LineBadge } from '../../../components/ui/ui';
import { findLine } from '../../../data/faolLines';
import type { MerusArrival, MerusStop } from '../../../types';

interface Props {
  stop: MerusStop;
  arrivals: MerusArrival[];
  loading: boolean;
  error: string | null;
  fav: boolean;
  onFav: () => void;
  onBack: () => void;
  onRefresh: () => void;
  onPickLine: (k: string) => void;
}

/** Painel estilo aeroporto: próximos ônibus chegando ao ponto selecionado. */
function ArrivalBoard(p: Props) {
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center gap-1 px-2 pb-2 shrink-0">
        <IconBtn onClick={p.onBack} label="Voltar">
          <ArrowLeft size={20} />
        </IconBtn>
        <div className="flex-1 min-w-0">
          <div className="font-sign text-xl font-semibold leading-tight truncate">{p.stop.name}</div>
          <div className="text-xs text-slate-400">Atualiza a cada 15 s</div>
        </div>
        <IconBtn onClick={p.onFav} label="Favoritar ponto" active={p.fav}>
          <Star size={20} className={p.fav ? 'fill-warn text-warn' : ''} />
        </IconBtn>
        <IconBtn onClick={p.onRefresh} label="Atualizar">
          <RefreshCw size={18} className={p.loading ? 'animate-spin' : ''} />
        </IconBtn>
      </div>
      <div className="scroll-y flex-1 px-3 pb-3">
        {p.error && <div className="text-halt text-sm px-1 py-2">{p.error}</div>}
        {!p.loading && !p.error && !p.arrivals.length && (
          <Empty
            icon={<MapPin size={28} />}
            title="Nenhum ônibus a caminho"
            hint="Quando houver previsão, ela aparece aqui."
          />
        )}
        {p.arrivals.length > 0 && (
          <div className="rounded-2xl overflow-hidden border border-white/10 bg-ink-950/80">
            {p.arrivals.map((a) => {
              const code = findLine(a.lineKey)?.code ?? a.lineLabel.slice(0, 4);
              const soon = a.etaMin !== null && a.etaMin <= 2;
              return (
                <button
                  key={a.key}
                  onClick={() => a.lineKey && p.onPickLine(a.lineKey)}
                  className="w-full flex items-center gap-3 px-3 py-3 border-b border-white/5 last:border-0 text-left"
                >
                  <LineBadge code={code} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {a.destination || findLine(a.lineKey)?.name || a.lineLabel}
                    </div>
                    {a.prefix && <div className="text-xs text-slate-500">Veículo {a.prefix}</div>}
                  </div>
                  <div className={`num text-3xl font-semibold text-right ${soon ? 'text-go' : 'text-warn'}`}>
                    {a.etaMin === null ? a.etaText || '—' : a.etaMin <= 0 ? 'Agora' : `${a.etaMin} min`}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(ArrivalBoard);
