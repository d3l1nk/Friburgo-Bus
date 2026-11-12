import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { ArrowLeft, Bug, Bus, ChevronDown, ChevronUp, Crosshair, Layers, MapPin, RefreshCw, Star, WifiOff, X } from 'lucide-react';
import { Empty, IconBtn, LineBadge } from './ui';
import { ESTACAO_LIVRE, formatDistance, haversine, type GeoFix } from '../lib/geo';
import { getJSON, setJSON } from '../lib/storage';
import { usePolling } from '../lib/time';
import { findLine, resolveLineKey } from '../data/faolLines';
import { getNearbyStops, getStopArrivals } from '../services/merusApi';
import type { Favorites, MerusArrival, MerusStop, MerusVehicle } from '../types';

// =====================================================================
// Provedores de tiles (nenhum exige chave e todos funcionam no WebView Android)
// =====================================================================
type MapStyle = 'voyager' | 'dark' | 'satellite';

const TILES: Record<MapStyle, { label: string; url: string; attribution: string; subdomains: string; maxZoom: number }> = {
  voyager: {
    label: 'Ruas',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 20,
  },
  dark: {
    label: 'Escuro',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 20,
  },
  satellite: {
    label: 'Satélite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
    subdomains: 'abc',
    maxZoom: 19,
  },
};
const STYLE_ORDER: MapStyle[] = ['voyager', 'dark', 'satellite'];
const FALLBACK_NEXT: Record<MapStyle, MapStyle> = { voyager: 'dark', dark: 'satellite', satellite: 'voyager' };
const STYLE_KEY = 'map:style:v1';

// =====================================================================
// Ícones (criados uma única vez)
// =====================================================================
const ICON_STOP = L.divIcon({ className: '', html: '<div class="stop-dot"></div>', iconSize: [14, 14], iconAnchor: [7, 7] });
const ICON_STOP_SEL = L.divIcon({ className: '', html: '<div class="stop-dot sel"></div>', iconSize: [18, 18], iconAnchor: [9, 9] });
const ICON_ME = L.divIcon({ className: '', html: '<div class="me-dot"></div>', iconSize: [16, 16], iconAnchor: [8, 8] });
const busIcons = new Map<string, L.DivIcon>();
function busIcon(code: string, mode: '' | 'dim' | 'hi'): L.DivIcon {
  const k = `${mode}|${code}`;
  let icon = busIcons.get(k);
  if (!icon) {
    icon = L.divIcon({ className: '', html: `<div class="bus-pin ${mode}">${code}</div>`, iconSize: [30, 22], iconAnchor: [15, 11] });
    busIcons.set(k, icon);
  }
  return icon;
}
const busCode = (v: MerusVehicle) => findLine(v.lineKey)?.code ?? (v.lineLabel.match(/\d{1,3}[A-Za-z]?/)?.[0] ?? '?');

type Target = { lat: number; lng: number; zoom?: number; n: number };

function MapController({ active, target }: { active: boolean; target: Target | null }) {
  const map = useMap();
  useEffect(() => {
    const c = map.getContainer();
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(c);
    if (c.parentElement) ro.observe(c.parentElement);
    const t = setTimeout(() => map.invalidateSize(), 120);
    return () => {
      ro.disconnect();
      clearTimeout(t);
    };
  }, [map]);
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => map.invalidateSize(), 60);
    return () => clearTimeout(t);
  }, [active, map]);
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], target.zoom ?? map.getZoom(), { duration: 0.6 });
  }, [target, map]);
  return null;
}

interface Props {
  active: boolean;
  geo: GeoFix | null;
  onRelocate: () => void;
  vehicles: MerusVehicle[];
  vehiclesAt: number;
  vehiclesError: string | null;
  highlight: string | null;
  setHighlight: (k: string | null) => void;
  favs: Favorites;
  toggleFavStop: (s: MerusStop) => void;
  focusStop: MerusStop | null;
  onFocusConsumed: () => void;
  onOpenDiag: () => void;
}

export default function RadarTab(p: Props) {
  const pos = p.geo?.pos ?? ESTACAO_LIVRE;
  const [stops, setStops] = useState<MerusStop[]>([]);
  const [stopsInfo, setStopsInfo] = useState<{ fromCache: boolean } | null>(null);
  const [loadingStops, setLoadingStops] = useState(false);
  const [stopsErr, setStopsErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<MerusStop | null>(null);
  const [arrivals, setArrivals] = useState<MerusArrival[]>([]);
  const [arrErr, setArrErr] = useState<string | null>(null);
  const [arrLoading, setArrLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [sheetTab, setSheetTab] = useState<'stops' | 'live'>('stops');
  const [target, setTarget] = useState<Target | null>(null);

  // mapa: estilo + fallback automático
  const [style, setStyle] = useState<MapStyle>('voyager');
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const tileErr = useRef({ count: 0, switches: 0 });
  useEffect(() => {
    getJSON<MapStyle>(STYLE_KEY).then((s) => s && TILES[s] && setStyle(s));
  }, []);
  const pickStyle = (s: MapStyle) => {
    tileErr.current = { count: 0, switches: 0 };
    setStyle(s);
    setMenuOpen(false);
    void setJSON(STYLE_KEY, s);
  };
  const onTileError = () => {
    const e = tileErr.current;
    e.count++;
    if (e.count >= 4 && e.switches < 3) {
      e.count = 0;
      e.switches++;
      const next = FALLBACK_NEXT[style];
      setToast(`O mapa "${TILES[style].label}" não carregou. Usando "${TILES[next].label}".`);
      setStyle(next);
      setTimeout(() => setToast(null), 4500);
    }
  };

  const loadStops = async (force: boolean) => {
    setLoadingStops(true);
    setStopsErr(null);
    try {
      const r = await getNearbyStops(pos, force);
      setStops(r.stops);
      setStopsInfo({ fromCache: r.fromCache });
    } catch (e: any) {
      setStopsErr(e?.message ?? 'Falha ao carregar pontos');
    } finally {
      setLoadingStops(false);
    }
  };

  const centered = useRef(false);
  useEffect(() => {
    if (!p.geo) return;
    void loadStops(false);
    if (!centered.current) {
      centered.current = true;
      setTarget({ lat: p.geo.pos.lat, lng: p.geo.pos.lng, zoom: 16, n: Date.now() });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.geo?.pos.lat, p.geo?.pos.lng]);

  useEffect(() => {
    if (p.focusStop) {
      selectStop(p.focusStop);
      p.onFocusConsumed();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.focusStop]);

  const selectStop = (s: MerusStop) => {
    setSelected(s);
    setArrivals([]);
    setArrErr(null);
    setArrLoading(true);
    setSheetTab('stops');
    setExpanded(true);
    setTarget({ lat: s.lat, lng: s.lng, zoom: 17, n: Date.now() });
  };

  const loadArrivals = async () => {
    if (!selected) return;
    try {
      setArrivals(await getStopArrivals(selected.id, pos));
      setArrErr(null);
    } catch (e: any) {
      setArrErr(e?.message ?? 'Falha ao buscar previsões');
    } finally {
      setArrLoading(false);
    }
  };
  usePolling(loadArrivals, 15000, p.active && !!selected, [selected?.id]);

  // marcadores memoizados: selecionar um ponto não recria todos os ícones
  const stopMarkers = useMemo(
    () =>
      stops.map((s) => (
        <Marker key={s.id} position={[s.lat, s.lng]} icon={selected?.id === s.id ? ICON_STOP_SEL : ICON_STOP} eventHandlers={{ click: () => selectStop(s) }} />
      )),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stops, selected?.id],
  );
  const busMarkers = useMemo(
    () =>
      p.vehicles.map((v, i) => {
        const mode = p.highlight ? (v.lineKey === p.highlight ? 'hi' : 'dim') : '';
        return <Marker key={`${v.id}-${i}`} position={[v.lat, v.lng]} icon={busIcon(busCode(v), mode)} zIndexOffset={mode === 'hi' ? 900 : 500} />;
      }),
    [p.vehicles, p.highlight],
  );

  const groups = useMemo(() => {
    const m = new Map<string, MerusVehicle[]>();
    p.vehicles.forEach((v) => m.set(v.lineKey || '?', [...(m.get(v.lineKey || '?') ?? []), v]));
    return [...m.entries()]
      .map(([key, vs]) => ({ key, vs, line: findLine(key) }))
      .sort((a, b) => b.vs.length - a.vs.length || a.key.localeCompare(b.key, undefined, { numeric: true }));
  }, [p.vehicles]);

  const pickGroup = (key: string, vs: MerusVehicle[]) => {
    if (p.highlight === key) return p.setHighlight(null);
    p.setHighlight(key);
    const nearest = [...vs].sort((a, b) => haversine(pos, a) - haversine(pos, b))[0];
    if (nearest) setTarget({ lat: nearest.lat, lng: nearest.lng, zoom: 16, n: Date.now() });
    setExpanded(false);
  };

  const isFav = (id: string) => p.favs.stops.some((s) => s.id === id);
  const highlightLine = p.highlight ? findLine(p.highlight) : undefined;
  const fresh = p.vehiclesAt > 0 && !p.vehiclesError;
  const t = TILES[style];

  return (
    <div className="relative h-full w-full overflow-hidden">
      <MapContainer
        center={[pos.lat, pos.lng]}
        zoom={16}
        zoomControl={false}
        attributionControl
        className="absolute inset-0 w-full h-full isolate"
      >
        <TileLayer
          key={style}
          url={t.url}
          attribution={t.attribution}
          subdomains={t.subdomains}
          maxZoom={t.maxZoom}
          eventHandlers={{ tileerror: onTileError }}
        />
        <MapController active={p.active} target={target} />
        <Marker position={[pos.lat, pos.lng]} icon={ICON_ME} interactive={false} />
        {stopMarkers}
        {busMarkers}
      </MapContainer>

      {/* HUD flutuante */}
      <div className="absolute inset-x-0 top-0 z-[1000] px-3 pointer-events-none" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}>
        <div className="glass pointer-events-auto flex items-center gap-1 rounded-2xl h-14 pl-4 pr-1 shadow-lg shadow-black/30">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="relative grid place-items-center">
                <Bus size={20} className={fresh ? 'text-go' : 'text-slate-500'} />
                {fresh && <span className="absolute -top-0.5 -right-1 h-2 w-2 rounded-full bg-go animate-pulse" />}
              </span>
              <div className="leading-none">
                <div className="num text-2xl font-semibold">{p.vehicles.length}</div>
                <div className="text-[10px] uppercase tracking-wide text-slate-400 mt-0.5">no GPS</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <MapPin size={20} className="text-route" />
              <div className="leading-none">
                <div className="num text-2xl font-semibold">{stops.length}</div>
                <div className="text-[10px] uppercase tracking-wide text-slate-400 mt-0.5">paradas</div>
              </div>
            </div>
          </div>
          <IconBtn onClick={() => setMenuOpen((o) => !o)} label="Estilo do mapa" active={menuOpen}><Layers size={20} /></IconBtn>
          <IconBtn
            onClick={() => {
              p.onRelocate();
              setTarget({ lat: pos.lat, lng: pos.lng, zoom: 16, n: Date.now() });
            }}
            label="Minha localização"
          >
            <Crosshair size={20} />
          </IconBtn>
          <IconBtn onClick={p.onOpenDiag} label="Inspecionar JSON"><Bug size={19} /></IconBtn>
        </div>

        {menuOpen && (
          <div className="glass pointer-events-auto mt-2 ml-auto w-40 rounded-xl p-1 shadow-lg shadow-black/30">
            {STYLE_ORDER.map((s) => (
              <button
                key={s}
                onClick={() => pickStyle(s)}
                className={`w-full text-left h-10 px-3 rounded-lg text-sm font-medium ${style === s ? 'bg-route text-ink-950' : 'text-slate-200 active:bg-ink-700'}`}
              >
                {TILES[s].label}
              </button>
            ))}
          </div>
        )}

        <div className="mt-2 flex flex-col items-start gap-2">
          {p.geo?.usingFallback && (
            <div className="pointer-events-auto glass text-warn text-xs rounded-lg px-3 py-1.5">GPS indisponível. Usando a Estação Livre como referência.</div>
          )}
          {highlightLine && (
            <button onClick={() => p.setHighlight(null)} className="pointer-events-auto glass flex items-center gap-2 text-go rounded-full pl-3 pr-2 py-1 text-sm font-medium">
              Destacando linha {highlightLine.code} <X size={16} />
            </button>
          )}
          {toast && <div className="pointer-events-auto glass text-slate-100 text-xs rounded-lg px-3 py-1.5">{toast}</div>}
        </div>
      </div>

      {/* Bottom sheet */}
      <div
        className="glass-strong absolute inset-x-0 bottom-0 z-[1000] rounded-t-3xl flex flex-col transition-[height] duration-200"
        style={{ height: expanded ? '70%' : '36%' }}
      >
        <button onClick={() => setExpanded((e) => !e)} className="h-7 grid place-items-center text-slate-500 shrink-0" aria-label="Expandir painel">
          {expanded ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
        </button>

        {!selected && (
          <div className="px-4 pb-2 shrink-0">
            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-ink-950/70">
              {(
                [
                  ['stops', `Paradas próximas`, stops.length],
                  ['live', `Ônibus ao vivo`, p.vehicles.length],
                ] as const
              ).map(([id, label, n]) => (
                <button
                  key={id}
                  onClick={() => setSheetTab(id)}
                  className={`h-10 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 ${sheetTab === id ? 'bg-ink-600 text-white' : 'text-slate-400'}`}
                >
                  {label}
                  <span className={`num text-sm px-1.5 rounded ${sheetTab === id ? 'bg-route text-ink-950' : 'bg-ink-700'}`}>{n}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {selected ? (
          <ArrivalBoard
            stop={selected}
            arrivals={arrivals}
            loading={arrLoading}
            error={arrErr}
            fav={isFav(selected.id)}
            onFav={() => p.toggleFavStop(selected)}
            onBack={() => {
              setSelected(null);
              setExpanded(false);
            }}
            onRefresh={loadArrivals}
            onPickLine={(k) => p.setHighlight(k)}
          />
        ) : sheetTab === 'stops' ? (
          <div className="flex flex-col flex-1 min-h-0">
            <div className="flex items-center justify-between px-4 pb-2 shrink-0 text-xs text-slate-400">
              <span className="flex items-center gap-1">
                Ordenadas por distância
                {stopsInfo?.fromCache && (
                  <span className="inline-flex items-center gap-1 text-warn ml-2">
                    <WifiOff size={11} /> cópia local
                  </span>
                )}
              </span>
              <button
                onClick={() => loadStops(true)}
                disabled={loadingStops}
                className="flex items-center gap-2 h-9 px-3 rounded-full bg-ink-700 text-sm font-medium text-slate-100 active:bg-ink-600 disabled:opacity-60"
              >
                <RefreshCw size={15} className={loadingStops ? 'animate-spin' : ''} />
                Atualizar pontos
              </button>
            </div>
            <div className="scroll-y flex-1 px-3 pb-3">
              {stopsErr && <div className="text-halt text-sm px-1 py-2">{stopsErr}</div>}
              {!stopsErr && !stops.length && !loadingStops && (
                <Empty icon={<MapPin size={28} />} title="Nenhum ponto por perto" hint="Toque em Atualizar pontos ou confira a aba Diagnóstico." />
              )}
              {stops.slice(0, 60).map((s) => (
                <button key={s.id} onClick={() => selectStop(s)} className="w-full text-left flex items-center gap-3 px-2 py-3 border-b border-white/5 active:bg-ink-800/70">
                  <div className="num text-lg text-route w-14 shrink-0">{formatDistance(s.distance)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{s.name}</div>
                    {s.lines.length > 0 && (
                      <div className="text-xs text-slate-400 truncate">{s.lines.slice(0, 8).map((l) => findLine(resolveLineKey(l))?.code ?? l).join('  ')}</div>
                    )}
                  </div>
                  {isFav(s.id) && <Star size={16} className="text-warn fill-warn" />}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="scroll-y flex-1 px-3 pb-3">
            {p.vehiclesError && <div className="text-halt text-sm px-1 py-2">{p.vehiclesError}</div>}
            {!p.vehicles.length && !p.vehiclesError && <Empty icon={<Bus size={28} />} title="Nenhum ônibus com GPS agora" hint="A lista atualiza a cada 15 segundos." />}
            {groups.map(({ key, vs, line }) => {
              const dirs = [...new Set(vs.map((v) => v.direction).filter(Boolean))].slice(0, 2).join(' · ');
              const near = Math.min(...vs.map((v) => haversine(pos, v)));
              const on = p.highlight === key;
              return (
                <button
                  key={key}
                  onClick={() => pickGroup(key, vs)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 mb-2 rounded-xl border text-left ${on ? 'bg-go-soft border-go/60' : 'bg-ink-800/70 border-white/5'}`}
                >
                  <LineBadge code={line?.code ?? key} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{line?.name ?? 'Linha não identificada'}</div>
                    <div className="text-xs text-slate-400 truncate">{dirs || `mais próximo: ${formatDistance(near)}`}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="num text-2xl leading-none text-go">{vs.length}</div>
                    <div className="text-[10px] text-slate-400 uppercase">{vs.length === 1 ? 'ônibus' : 'ônibus'}</div>
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

function ArrivalBoard(props: {
  stop: MerusStop;
  arrivals: MerusArrival[];
  loading: boolean;
  error: string | null;
  fav: boolean;
  onFav: () => void;
  onBack: () => void;
  onRefresh: () => void;
  onPickLine: (k: string) => void;
}) {
  const { stop, arrivals } = props;
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center gap-1 px-2 pb-2 shrink-0">
        <IconBtn onClick={props.onBack} label="Voltar"><ArrowLeft size={20} /></IconBtn>
        <div className="flex-1 min-w-0">
          <div className="font-sign text-xl font-semibold leading-tight truncate">{stop.name}</div>
          <div className="text-xs text-slate-400">Atualiza a cada 15 s</div>
        </div>
        <IconBtn onClick={props.onFav} label="Favoritar ponto" active={props.fav}>
          <Star size={20} className={props.fav ? 'fill-warn text-warn' : ''} />
        </IconBtn>
        <IconBtn onClick={props.onRefresh} label="Atualizar"><RefreshCw size={18} className={props.loading ? 'animate-spin' : ''} /></IconBtn>
      </div>
      <div className="scroll-y flex-1 px-3 pb-3">
        {props.error && <div className="text-halt text-sm px-1 py-2">{props.error}</div>}
        {!props.loading && !props.error && !arrivals.length && <Empty icon={<MapPin size={28} />} title="Nenhum ônibus a caminho" hint="Quando houver previsão, ela aparece aqui." />}
        {arrivals.length > 0 && (
          <div className="rounded-2xl overflow-hidden border border-white/10 bg-ink-950/80">
            {arrivals.map((a) => {
              const code = findLine(a.lineKey)?.code ?? a.lineLabel.slice(0, 4);
              const soon = a.etaMin !== null && a.etaMin <= 2;
              return (
                <button key={a.key} onClick={() => a.lineKey && props.onPickLine(a.lineKey)} className="w-full flex items-center gap-3 px-3 py-3 border-b border-white/5 last:border-0 text-left">
                  <LineBadge code={code} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{a.destination || findLine(a.lineKey)?.name || a.lineLabel}</div>
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
