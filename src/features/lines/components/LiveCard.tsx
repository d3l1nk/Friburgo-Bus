import { memo } from 'react';
import { Bus, MapPinned } from 'lucide-react';
import type { MerusVehicle } from '../../../types';

function LiveCard({ vehicles, onShowOnMap }: { vehicles: MerusVehicle[]; onShowOnMap: () => void }) {
  const on = vehicles.length > 0;
  return (
    <section
      className={`rounded-2xl border p-4 ${on ? 'bg-go-soft/50 border-go/40' : 'bg-ink-800 border-ink-600'}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bus className={on ? 'text-go' : 'text-slate-500'} size={26} />
          <div>
            <div className="num text-3xl leading-none font-semibold">{vehicles.length}</div>
            <div className="text-xs text-slate-400 mt-1">
              {on ? 'ônibus rodando agora (GPS)' : 'nenhum ônibus com GPS agora'}
            </div>
          </div>
        </div>
        <button
          onClick={onShowOnMap}
          disabled={!on}
          className="flex items-center gap-2 h-11 px-4 rounded-full bg-go text-ink-950 font-semibold disabled:bg-ink-700 disabled:text-slate-500"
        >
          <MapPinned size={18} /> Ver no mapa
        </button>
      </div>
      {on && (
        <div className="mt-3 flex flex-wrap gap-2">
          {vehicles.slice(0, 8).map((v, i) => (
            <span key={`${v.id}-${i}`} className="text-xs bg-ink-900/70 rounded-md px-2 py-1 text-slate-300">
              {v.id}
              {v.direction ? ` · ${v.direction}` : ''}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

export default memo(LiveCard);
