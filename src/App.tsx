import { useCallback, useEffect, useState } from 'react';
import { Bug, Clock, Radar, Star } from 'lucide-react';
import RadarTab from './components/RadarTab';
import LinesTab from './components/LinesTab';
import FavoritesTab from './components/FavoritesTab';
import DiagnosticTab from './components/DiagnosticTab';
import { useAlerts, useFavorites, useVehicles } from './hooks';
import { getPosition, type GeoFix } from './lib/geo';
import { listCachedTables } from './services/faolScraper';
import type { MerusStop, TabId } from './types';

const TABS: { id: TabId; label: string; Icon: typeof Radar }[] = [
  { id: 'radar', label: 'Radar', Icon: Radar },
  { id: 'lines', label: 'Linhas', Icon: Clock },
  { id: 'favorites', label: 'Favoritos', Icon: Star },
  { id: 'diag', label: 'Diagnóstico', Icon: Bug },
];

export default function App() {
  const [tab, setTab] = useState<TabId>('radar');
  const [geo, setGeo] = useState<GeoFix | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [openCode, setOpenCode] = useState<string | null>(null);
  const [focusStop, setFocusStop] = useState<MerusStop | null>(null);
  const [cached, setCached] = useState<Set<string>>(new Set());

  const { favs, toggleLine, toggleStop } = useFavorites();
  const { alerts } = useAlerts();
  const veh = useVehicles(tab === 'radar' || tab === 'lines');

  const relocate = useCallback(() => {
    void getPosition().then(setGeo);
  }, []);
  useEffect(relocate, [relocate]);

  const refreshCached = useCallback(() => {
    void listCachedTables().then((k) => setCached(new Set(k)));
  }, []);
  useEffect(refreshCached, [refreshCached]);

  const showOnMap = (key: string) => {
    setHighlight(key);
    setTab('radar');
  };

  return (
    <div className="h-full flex flex-col bg-ink-950">
      <main className="flex-1 min-h-0 relative">
        {/* Radar fica montado para preservar o mapa */}
        <div className={`absolute inset-0 ${tab === 'radar' ? '' : 'hidden'}`}>
          <RadarTab
            active={tab === 'radar'}
            geo={geo}
            onRelocate={relocate}
            vehicles={veh.vehicles}
            vehiclesAt={veh.at}
            vehiclesError={veh.error}
            highlight={highlight}
            setHighlight={setHighlight}
            favs={favs}
            toggleFavStop={toggleStop}
            focusStop={focusStop}
            onFocusConsumed={() => setFocusStop(null)}
            onOpenDiag={() => setTab('diag')}
          />
        </div>
        {tab === 'lines' && (
          <div className="absolute inset-0">
            <LinesTab
              openCode={openCode}
              setOpenCode={setOpenCode}
              alerts={alerts}
              vehicles={veh.vehicles}
              favLines={favs.lines}
              toggleFavLine={toggleLine}
              onShowOnMap={showOnMap}
              onCacheChanged={refreshCached}
            />
          </div>
        )}
        {tab === 'favorites' && (
          <div className="absolute inset-0">
            <FavoritesTab
              favs={favs}
              cached={cached}
              onOpenLine={(c) => {
                setOpenCode(c);
                setTab('lines');
              }}
              onOpenStop={(s) => {
                setFocusStop(s);
                setTab('radar');
              }}
              toggleLine={toggleLine}
              toggleStop={toggleStop}
              refreshCached={refreshCached}
            />
          </div>
        )}
        {tab === 'diag' && (
          <div className="absolute inset-0">
            <DiagnosticTab geo={geo} />
          </div>
        )}
      </main>

      <nav className="shrink-0 bg-ink-900 border-t border-ink-700 pb-safe">
        <div className="grid grid-cols-4">
          {TABS.map(({ id, label, Icon }) => {
            const on = tab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`h-16 flex flex-col items-center justify-center gap-1 text-xs font-medium ${on ? 'text-route' : 'text-slate-400'}`}
              >
                <span className={`h-7 w-14 grid place-items-center rounded-full ${on ? 'bg-route-soft' : ''}`}>
                  <Icon size={20} />
                </span>
                {label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
