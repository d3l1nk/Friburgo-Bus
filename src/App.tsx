import BottomNav from './components/BottomNav';
import SplashScreen from './components/SplashScreen';
import ChatTab from './features/chat/ChatTab';
import FavoritesTab from './features/favorites/FavoritesTab';
import LinesTab from './features/lines/LinesTab';
import RadarTab from './features/radar/RadarTab';
import SettingsTab from './features/settings/SettingsTab';
import {
  useAlertRules,
  useAlerts,
  useAppNavigation,
  useCachedTables,
  useFavorites,
  useGeoPosition,
  useLiveAlertWatcher,
  useSplash,
  useVehicles,
} from './hooks';
import { ESTACAO_LIVRE } from './lib/geo';
import { hasLiveRules } from './services/notifications';

export default function App() {
  const nav = useAppNavigation();
  const { geo, relocate } = useGeoPosition();
  const { favs, toggleLine, toggleStop } = useFavorites();
  const { alerts } = useAlerts();
  const rulesApi = useAlertRules();
  const { cached, refresh: refreshCached } = useCachedTables();
  const splash = useSplash();

  const liveRules = hasLiveRules(rulesApi.rules);
  const veh = useVehicles(nav.tab === 'radar' || nav.tab === 'lines' || nav.tab === 'luiz' || liveRules);
  const toast = useLiveAlertWatcher(rulesApi.rules, veh.vehicles);

  const pos = geo?.pos ?? ESTACAO_LIVRE;

  return (
    <div className="h-full flex flex-col bg-ink-950">
      <main className="flex-1 min-h-0 relative">
        {/* Radar e Luiz ficam montados para preservar o mapa e a conversa */}
        <div className={`absolute inset-0 ${nav.tab === 'radar' ? '' : 'hidden'}`}>
          <RadarTab
            active={nav.tab === 'radar'}
            geo={geo}
            onRelocate={relocate}
            vehicles={veh.vehicles}
            vehiclesAt={veh.at}
            vehiclesError={veh.error}
            highlight={nav.highlight}
            setHighlight={nav.setHighlight}
            favs={favs}
            toggleFavStop={toggleStop}
            focusStop={nav.focusStop}
            onFocusConsumed={nav.clearFocusStop}
            onOpenDiag={() => nav.openSettings('diag')}
          />
        </div>
        <div className={`absolute inset-0 ${nav.tab === 'luiz' ? '' : 'hidden'}`}>
          <ChatTab
            ctx={{ pos, vehicles: veh.vehicles, alerts, favLines: favs.lines }}
            onAction={nav.onLuizAction}
          />
        </div>
        {nav.tab === 'lines' && (
          <div className="absolute inset-0">
            <LinesTab
              openCode={nav.openCode}
              setOpenCode={nav.setOpenCode}
              alerts={alerts}
              vehicles={veh.vehicles}
              favLines={favs.lines}
              toggleFavLine={toggleLine}
              onShowOnMap={nav.showOnMap}
              onCacheChanged={refreshCached}
              onCreateAlert={(code) => nav.openSettings('alerts', code)}
            />
          </div>
        )}
        {nav.tab === 'favorites' && (
          <div className="absolute inset-0">
            <FavoritesTab
              favs={favs}
              cached={cached}
              onOpenLine={nav.openLine}
              onOpenStop={nav.openStop}
              toggleLine={toggleLine}
              toggleStop={toggleStop}
              refreshCached={refreshCached}
            />
          </div>
        )}
        {nav.tab === 'settings' && (
          <div className="absolute inset-0">
            <SettingsTab
              view={nav.settingsView}
              setView={nav.setSettingsView}
              rules={rulesApi.rules}
              addRule={rulesApi.add}
              removeRule={rulesApi.remove}
              toggleRule={rulesApi.toggle}
              favStops={favs.stops}
              prefillLine={nav.prefillLine}
              geo={geo}
            />
          </div>
        )}

        {toast && (
          <div
            className="glass absolute top-3 inset-x-3 z-[4000] rounded-xl px-4 py-3 text-sm shadow-lg"
            style={{ marginTop: 'env(safe-area-inset-top, 0px)' }}
          >
            🔔 {toast}
          </div>
        )}
      </main>

      <BottomNav tab={nav.tab} onPress={nav.onTabPress} />
      {splash && <SplashScreen />}
    </div>
  );
}
