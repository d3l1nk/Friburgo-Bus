import { useCallback, useEffect, useRef, useState } from 'react';
import { Clock, MessageCircle, Radar, Settings, Star } from 'lucide-react';
import RadarTab from './components/RadarTab';
import LinesTab from './components/LinesTab';
import FavoritesTab from './components/FavoritesTab';
import ChatTab from './components/ChatTab';
import SettingsTab from './components/SettingsTab';
import AppIcon from './components/AppIcon';
import { useAlertRules, useAlerts, useFavorites, useVehicles } from './hooks';
import { getPosition, type GeoFix } from './lib/geo';
import { openExternal } from './lib/openUrl';
import { listCachedTables } from './services/faolScraper';
import { evaluateLiveRules, hasLiveRules } from './services/notifications';
import type { LuizAction } from './services/luiz';
import { APP_NAME, FAOL_CHANNEL_URL } from './config';
import type { MerusStop, SettingsView, TabId } from './types';

const TABS: { id: TabId; label: string; Icon: typeof Radar }[] = [
  { id: 'radar', label: 'Radar', Icon: Radar },
  { id: 'lines', label: 'Linhas', Icon: Clock },
  { id: 'luiz', label: 'Luiz', Icon: MessageCircle },
  { id: 'favorites', label: 'Favoritos', Icon: Star },
  { id: 'settings', label: 'Ajustes', Icon: Settings },
];

export default function App() {
  const [tab, setTab] = useState<TabId>('radar');
  const [geo, setGeo] = useState<GeoFix | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [openCode, setOpenCode] = useState<string | null>(null);
  const [focusStop, setFocusStop] = useState<MerusStop | null>(null);
  const [cached, setCached] = useState<Set<string>>(new Set());
  const [settingsView, setSettingsView] = useState<SettingsView>('main');
  const [prefillLine, setPrefillLine] = useState<string | null>(null);
  const [splash, setSplash] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const { favs, toggleLine, toggleStop } = useFavorites();
  const { alerts } = useAlerts();
  const rulesApi = useAlertRules();
  const liveRules = hasLiveRules(rulesApi.rules);
  const veh = useVehicles(tab === 'radar' || tab === 'lines' || tab === 'luiz' || liveRules);

  // 1ª posição rápida (rede, até 3 s); o GPS preciso chega depois via onRefine
  const relocate = useCallback(() => {
    void getPosition((fix) => setGeo(fix)).then(setGeo);
  }, []);
  useEffect(relocate, [relocate]);

  const refreshCached = useCallback(() => {
    void listCachedTables().then((k) => setCached(new Set(k)));
  }, []);
  useEffect(refreshCached, [refreshCached]);

  useEffect(() => {
    const t = setTimeout(() => setSplash(false), 1100);
    return () => clearTimeout(t);
  }, []);

  // avisos por GPS: ônibus saiu do ponto final / passando no ponto
  const rulesRef = useRef(rulesApi.rules);
  rulesRef.current = rulesApi.rules;
  useEffect(() => {
    if (!veh.vehicles.length) return;
    const fired = evaluateLiveRules(rulesRef.current, veh.vehicles);
    if (fired.length) {
      setToast(fired[0]);
      setTimeout(() => setToast(null), 5000);
    }
  }, [veh.vehicles]);

  const showOnMap = (key: string) => {
    setHighlight(key);
    setTab('radar');
  };
  const createAlert = (code: string | null) => {
    setPrefillLine(code);
    setSettingsView('alerts');
    setTab('settings');
  };

  const onLuizAction = (a: LuizAction) => {
    switch (a.kind) {
      case 'line':
        setOpenCode(a.payload ?? null);
        setTab('lines');
        break;
      case 'map':
        if (a.payload) showOnMap(a.payload);
        break;
      case 'alert':
        createAlert(a.payload ?? null);
        break;
      case 'feedback':
        setPrefillLine(null);
        setSettingsView('feedback');
        setTab('settings');
        break;
      case 'about':
        setSettingsView('about');
        setTab('settings');
        break;
      case 'faol':
        void openExternal(FAOL_CHANNEL_URL);
        break;
      case 'tab':
        setTab((a.payload as TabId) ?? 'radar');
        break;
    }
  };

  const pos = geo?.pos ?? { lat: -22.2818, lng: -42.5311 };

  return (
    <div className="h-full flex flex-col bg-ink-950">
      <main className="flex-1 min-h-0 relative">
        {/* Radar e Luiz ficam montados para preservar o mapa e a conversa */}
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
            onOpenDiag={() => {
              setSettingsView('diag');
              setTab('settings');
            }}
          />
        </div>
        <div className={`absolute inset-0 ${tab === 'luiz' ? '' : 'hidden'}`}>
          <ChatTab ctx={{ pos, vehicles: veh.vehicles, alerts, favLines: favs.lines }} onAction={onLuizAction} />
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
              onCreateAlert={createAlert}
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
        {tab === 'settings' && (
          <div className="absolute inset-0">
            <SettingsTab
              view={settingsView}
              setView={setSettingsView}
              rules={rulesApi.rules}
              addRule={rulesApi.add}
              removeRule={rulesApi.remove}
              toggleRule={rulesApi.toggle}
              favStops={favs.stops}
              prefillLine={prefillLine}
              geo={geo}
            />
          </div>
        )}

        {toast && (
          <div className="glass absolute top-3 inset-x-3 z-[4000] rounded-xl px-4 py-3 text-sm shadow-lg" style={{ marginTop: 'env(safe-area-inset-top, 0px)' }}>
            🔔 {toast}
          </div>
        )}
      </main>

      <nav className="shrink-0 bg-ink-900 border-t border-ink-700 pb-safe">
        <div className="grid grid-cols-5">
          {TABS.map(({ id, label, Icon }) => {
            const on = tab === id;
            return (
              <button
                key={id}
                onClick={() => {
                  if (id === 'settings' && on) setSettingsView('main');
                  if (id === 'settings' && !on && settingsView !== 'diag') setPrefillLine(null);
                  setTab(id);
                }}
                className={`h-16 flex flex-col items-center justify-center gap-1 text-[11px] font-medium ${on ? 'text-route' : 'text-slate-400'}`}
              >
                <span className={`h-7 w-12 grid place-items-center rounded-full ${on ? 'bg-route-soft' : ''}`}>
                  <Icon size={20} />
                </span>
                {label}
              </button>
            );
          })}
        </div>
      </nav>

      {splash && (
        <div className="fixed inset-0 z-[5000] bg-[#1F6FEB] grid place-items-center animate-[fadeout_.4s_ease_.8s_forwards]" aria-hidden>
          <div className="flex flex-col items-center gap-4 text-white">
            <div className="rounded-[28px] overflow-hidden shadow-2xl"><AppIcon size={120} /></div>
            <div className="font-sign text-3xl font-semibold">{APP_NAME}</div>
          </div>
        </div>
      )}
    </div>
  );
}
