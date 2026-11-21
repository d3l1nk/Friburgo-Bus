import { memo } from 'react';
import { MapPin, RefreshCw, Star, WifiOff } from 'lucide-react';
import { Empty } from '../../../components/ui/ui';
import { findLine, resolveLineKey } from '../../../data/faolLines';
import { formatDistance } from '../../../lib/geo';
import type { MerusStop } from '../../../types';

interface Props {
  stops: MerusStop[];
  fromCache: boolean;
  loading: boolean;
  error: string | null;
  favIds: Set<string>;
  onSelect: (s: MerusStop) => void;
  onRefresh: () => void;
}

function StopsList(p: Props) {
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center justify-between px-4 pb-2 shrink-0 text-xs text-slate-400">
        <span className="flex items-center gap-1">
          Ordenadas por distância
          {p.fromCache && (
            <span className="inline-flex items-center gap-1 text-warn ml-2">
              <WifiOff size={11} /> cópia local
            </span>
          )}
        </span>
        <button
          onClick={p.onRefresh}
          disabled={p.loading}
          className="flex items-center gap-2 h-9 px-3 rounded-full bg-ink-700 text-sm font-medium text-slate-100 active:bg-ink-600 disabled:opacity-60"
        >
          <RefreshCw size={15} className={p.loading ? 'animate-spin' : ''} />
          Atualizar pontos
        </button>
      </div>
      <div className="scroll-y flex-1 px-3 pb-3">
        {p.error && <div className="text-halt text-sm px-1 py-2">{p.error}</div>}
        {!p.error && !p.stops.length && !p.loading && (
          <Empty
            icon={<MapPin size={28} />}
            title="Nenhum ponto por perto"
            hint="Toque em Atualizar pontos ou confira a aba Diagnóstico."
          />
        )}
        {p.stops.slice(0, 60).map((s) => (
          <button
            key={s.id}
            onClick={() => p.onSelect(s)}
            className="w-full text-left flex items-center gap-3 px-2 py-3 border-b border-white/5 active:bg-ink-800/70"
          >
            <div className="num text-lg text-route w-14 shrink-0">{formatDistance(s.distance)}</div>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{s.name}</div>
              {s.lines.length > 0 && (
                <div className="text-xs text-slate-400 truncate">
                  {s.lines
                    .slice(0, 8)
                    .map((l) => findLine(resolveLineKey(l))?.code ?? l)
                    .join('  ')}
                </div>
              )}
            </div>
            {p.favIds.has(s.id) && <Star size={16} className="text-warn fill-warn" />}
          </button>
        ))}
      </div>
    </div>
  );
}

export default memo(StopsList);
