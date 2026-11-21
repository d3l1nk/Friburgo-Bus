import { ChevronDown, ChevronUp } from 'lucide-react';
import type { LatLng, MerusStop, MerusVehicle } from '../../../types';
import type { BusGroup, useBusRadar } from '../hooks/useBusRadar';
import ArrivalBoard from './ArrivalBoard';
import LiveBusList from './LiveBusList';
import StopsList from './StopsList';

type Radar = ReturnType<typeof useBusRadar>;

interface Props {
  pos: LatLng;
  expanded: boolean;
  onToggleExpanded: () => void;
  sheetTab: 'stops' | 'live';
  onSheetTab: (t: 'stops' | 'live') => void;
  stopsApi: Radar['stopsApi'];
  arrivalsApi: Radar['arrivalsApi'];
  favIds: Set<string>;
  onToggleFav: (s: MerusStop) => void;
  onSelectStop: (s: MerusStop) => void;
  onBack: () => void;
  onPickLine: (key: string) => void;
  vehicleCount: number;
  vehiclesError: string | null;
  groups: BusGroup[];
  highlight: string | null;
  onPickGroup: (key: string, vs: MerusVehicle[]) => void;
}

/** Painel inferior: abas "Paradas próximas" / "Ônibus ao vivo" ou o painel de chegadas de um ponto. */
export default function RadarSheet(p: Props) {
  const { selected, arrivals, loading, error, refresh } = p.arrivalsApi;
  const tabs = [
    ['stops', 'Paradas próximas', p.stopsApi.stops.length],
    ['live', 'Ônibus ao vivo', p.vehicleCount],
  ] as const;

  return (
    <div
      className="glass-strong absolute inset-x-0 bottom-0 z-[1000] rounded-t-3xl flex flex-col transition-[height] duration-200"
      style={{ height: p.expanded ? '70%' : '36%' }}
    >
      <button
        onClick={p.onToggleExpanded}
        className="h-7 grid place-items-center text-slate-500 shrink-0"
        aria-label="Expandir painel"
      >
        {p.expanded ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
      </button>

      {!selected && (
        <div className="px-4 pb-2 shrink-0">
          <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-ink-950/70">
            {tabs.map(([id, label, n]) => (
              <button
                key={id}
                onClick={() => p.onSheetTab(id)}
                className={`h-10 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 ${p.sheetTab === id ? 'bg-ink-600 text-white' : 'text-slate-400'}`}
              >
                {label}
                <span
                  className={`num text-sm px-1.5 rounded ${p.sheetTab === id ? 'bg-route text-ink-950' : 'bg-ink-700'}`}
                >
                  {n}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {selected ? (
        <ArrivalBoard
          stop={selected}
          arrivals={arrivals}
          loading={loading}
          error={error}
          fav={p.favIds.has(selected.id)}
          onFav={() => p.onToggleFav(selected)}
          onBack={p.onBack}
          onRefresh={refresh}
          onPickLine={p.onPickLine}
        />
      ) : p.sheetTab === 'stops' ? (
        <StopsList
          stops={p.stopsApi.stops}
          fromCache={p.stopsApi.fromCache}
          loading={p.stopsApi.loading}
          error={p.stopsApi.error}
          favIds={p.favIds}
          onSelect={p.onSelectStop}
          onRefresh={() => void p.stopsApi.reload(true)}
        />
      ) : (
        <LiveBusList
          groups={p.groups}
          vehicleCount={p.vehicleCount}
          error={p.vehiclesError}
          pos={p.pos}
          highlight={p.highlight}
          onPick={p.onPickGroup}
        />
      )}
    </div>
  );
}
