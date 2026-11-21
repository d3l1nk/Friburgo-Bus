import { memo } from 'react';
import { Bus } from 'lucide-react';
import { Empty, LineBadge } from '../../../components/ui/ui';
import { formatDistance, haversine } from '../../../lib/geo';
import type { LatLng, MerusVehicle } from '../../../types';
import type { BusGroup } from '../hooks/useBusRadar';

interface Props {
  groups: BusGroup[];
  vehicleCount: number;
  error: string | null;
  pos: LatLng;
  highlight: string | null;
  onPick: (key: string, vs: MerusVehicle[]) => void;
}

function LiveBusList(p: Props) {
  return (
    <div className="scroll-y flex-1 px-3 pb-3">
      {p.error && <div className="text-halt text-sm px-1 py-2">{p.error}</div>}
      {!p.vehicleCount && !p.error && (
        <Empty
          icon={<Bus size={28} />}
          title="Nenhum ônibus com GPS agora"
          hint="A lista atualiza a cada 15 segundos."
        />
      )}
      {p.groups.map(({ key, vs, line }) => {
        const dirs = [...new Set(vs.map((v) => v.direction).filter(Boolean))].slice(0, 2).join(' · ');
        const near = Math.min(...vs.map((v) => haversine(p.pos, v)));
        const on = p.highlight === key;
        return (
          <button
            key={key}
            onClick={() => p.onPick(key, vs)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 mb-2 rounded-xl border text-left ${on ? 'bg-go-soft border-go/60' : 'bg-ink-800/70 border-white/5'}`}
          >
            <LineBadge code={line?.code ?? key} />
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{line?.name ?? 'Linha não identificada'}</div>
              <div className="text-xs text-slate-400 truncate">
                {dirs || `mais próximo: ${formatDistance(near)}`}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="num text-2xl leading-none text-go">{vs.length}</div>
              <div className="text-[10px] text-slate-400 uppercase">ônibus</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export default memo(LiveBusList);
