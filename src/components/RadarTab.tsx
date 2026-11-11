import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  ArrowLeft,
  Bus,
  ChevronDown,
  ChevronUp,
  Crosshair,
  Layers,
  MapPin,
  RefreshCw,
  Star,
  WifiOff,
  X,
} from 'lucide-react';
import { Empty, IconBtn, LineBadge } from './ui';
import { ESTACAO_LIVRE, formatDistance, type GeoFix } from '../lib/geo';
import { usePolling } from '../lib/time';
import { findLine, resolveLineKey } from '../data/faolLines';
import { getNearbyStops, getStopArrivals } from '../services/merusApi';
import type { Favorites, MerusArrival, MerusStop, MerusVehicle } from '../types';

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

type MapStyleId = 'dark' | 'streets' | 'satellite';

const MAP_STYLES: Record<MapStyleId, { label: string; url: string; subdomains?: string }> = {
  dark: {
    label: 'Escuro',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    subdomains: 'abcd',
  },
  streets: {
    label: 'Ruas',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    subdomains: 'abcd',
  },
  satellite: {
    label: 'Satélite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  },
};

const stopIcon = (sel: boolean) =>
  L.divIcon({
    className: '',
    html: `<div class="stop-dot ${sel ? 'sel' : ''}"></div>`,
    iconSize: sel ? [18, 18] : [14, 14],
    iconAnchor: sel ? [9, 9] : [7, 7],
  });

const meIcon = L.divIcon({
  className: '',
  html: '<div class="me-dot"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

function busCode(v: MerusVehicle): string {
  return findLine(v.lineKey)?.code ?? v.lineLabel.match(/\d{1,3}[A-Za-z]?/)?.[0] ?? '?';
}

function MapController({
  active,
  target,
}: {
  active: boolean;
  target: { lat: number; lng: number; zoom?: number; n: number } | null;
}) {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    const ro = new ResizeObserver(() => {
      map.invalidateSize({ animate: false });
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [map]);

  useEffect(() => {
    if (active) {
      const id = setTimeout(() => map.invalidateSize(), 80);
      return () => clearTimeout(id);
    }
  }, [active, map]);

  useEffect(() => {
    if (target) {
      map.flyTo([target.lat, target.lng], target.zoom ?? map.getZoom(), { duration: 0.65 });
    }
  }, [target, map]);

  return null;
}

export default function RadarTab(p: Props) {
  const pos = p.geo?.pos ?? ESTACAO_LIVRE;
  const [mapStyle, setMapStyle] = useState<MapStyleId>('streets');
  const [sheetMode, setSheetMode] = useState<'stops' | 'buses'>('stops');
  const [stops, setStops] = useState<MerusStop[]>([]);
  const [stopsInfo, setStopsInfo] = useState<{ fromCache: boolean; savedAt: number } | null>(null);
  const [loadingStops, setLoadingStops] = useState(false);
  const [stopsErr, setStopsErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<MerusStop | null>(null);
  const [arrivals, setArrivals] = useState<MerusArrival[]>([]);
  const [arrErr, setArrErr] = useState<string | null>(null);
  const [arrLoading, setArrLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [target, setTarget] = useState<{ lat: number; lng: number; zoom?: number; n: number } | null>(null);
  const tileErrors = useRef(0);

  const cycleMapStyle = () => {
    setMapStyle((prev) =>
      prev === 'streets' ? 'dark' : prev === 'dark' ? 'satellite' : 'streets',
    );
  };

  const loadStops = async (force: boolean) => {
    setLoadingStops(true);
    setStopsErr(null);
    try {
      const r = await getNearbyStops(pos, force);
      setStops(r.stops);
      setStopsInfo({ fromCache: r.fromCache, savedAt: r.savedAt });
    } catch (e: any) {
      setStopsErr(e?.message ?? 'Falha ao carregar pontos');
    } finally {
      setLoadingStops(false);
    }
  };

  useEffect(() => {
    if (p.geo) void loadStops(false);
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

  const busIcons = useMemo(
    () =>
      p.vehicles.map((v) => {
        const hi = p.highlight && v.lineKey === p.highlight;
        const dim = p.highlight && !hi;
        const code = busCode(v);
        return {
          v,
          icon: L.divIcon({
            className: '',
            html: `<div class="bus-pin ${hi ? 'hi' : ''} ${dim ? 'dim' : ''}">${code}</div>`,
            iconSize: [34, 24],
            iconAnchor: [17, 12],
          }),
        };
      }),
    [p.vehicles, p.highlight],
  );

  const isFav = (id: string) => p.favs.stops.some((s) => s.id === id);
  const highlightLine = p.highlight ? findLine(p.highlight) : undefined;
  const sheetH = expanded ? '62%' : selected ? '44%' : '36%';
  const styleCfg = MAP_STYLES[mapStyle];

  return (
    <div className="relative flex-1 flex flex-col overflow-hidden bg-ink-950">
      {/* Área do Mapa com posicionamento garantido */}
      <div className="relative flex-1 w-full min-h-[240px]">
        <MapContainer
          center={[pos.lat, pos.lng]}
          zoom={15}
          zoomControl={false}
          className="absolute inset-0 w-full h-full z-0"
          style={{ width: '100%', height: '100%' }}
        >
          <TileLayer
            key={mapStyle}
            url={styleCfg.url}
            subdomains={styleCfg.subdomains ?? 'abc'}
            maxZoom={19}
            eventHandlers={{
              tileerror: () => {
                tileErrors.current += 1;
                if (tileErrors.current > 6 && mapStyle === 'dark') {
                  setMapStyle('streets');
                }
              },
            }}
          />
          <MapController active={p.active} target={target} />

          <Marker position={[pos.lat, pos.lng]} icon={meIcon} />

          {stops.map((s) => (
            <Marker
              key={s.id}
              position={[s.lat, s.lng]}
              icon={stopIcon(selected?.id === s.id)}
              eventHandlers={{ click: () => selectStop(s) }}
            />
          ))}

          {busIcons.map(({ v, icon }) => (
            <Marker key={v.id} position={[v.lat, v.lng]} icon={icon}>
              <Popup>
                <div className="text-slate-900 text-xs space-y-1 min-w-[150px]">
                  <div className="font-bold text-sm">
                    Linha {busCode(v)} · {findLine(v.lineKey)?.name ?? v.lineName}
                  </div>
                  {v.direction && <div>Sentido: {v.direction}</div>}
                  <div>Prefixo: {v.id}</div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* HUD Superior Flutuante (Glassmorphism) */}
        <div className="absolute top-3 left-3 right-3 z-[400] flex flex-col gap-2 pointer-events-none">
          <div className="flex items-center justify-between gap-2">
            <div className="pointer-events-auto flex items-center gap-2.5 bg-ink-900/90 backdrop-blur-md border border-ink-600/80 rounded-2xl px-3.5 py-2 shadow-lg">
              <span className="h-2.5 w-2.5 rounded-full bg-go animate-pulse" />
              <div>
                <div className="text-xs font-semibold text-white leading-tight">Friburgo Bus</div>
                <div className="text-[11px] text-slate-300 leading-tight">
                  {p.vehicles.length} ônibus no GPS · {stops.length} paradas
                </div>
              </div>
            </div>

            <div className="pointer-events-auto flex items-center gap-2">
              <button
                onClick={cycleMapStyle}
                className="h-10 px-3 rounded-2xl bg-ink-900/90 backdrop-blur-md border border-ink-600/80 flex items-center gap-1.5 text-xs font-medium text-slate-200 shadow-lg active:scale-95 transition"
              >
                <Layers className="w-4 h-4 text-route" />
                {styleCfg.label}
              </button>

              <button
                onClick={() => {
                  p.onRelocate();
                  setTarget({ lat: pos.lat, lng: pos.lng, zoom: 16, n: Date.now() });
                }}
                aria-label="Minha localização"
                className="h-10 w-10 rounded-2xl bg-ink-900/90 backdrop-blur-md border border-ink-600/80 grid place-items-center text-route shadow-lg active:scale-95 transition"
              >
                <Crosshair className="w-5 h-5" />
              </button>
            </div>
          </div>

          {p.geo?.usingFallback && (
            <div className="pointer-events-auto self-start flex items-center gap-1.5 bg-warn-soft/95 border border-warn/40 text-warn text-xs px-3 py-1.5 rounded-xl shadow">
              <WifiOff className="w-3.5 h-3.5 shrink-0" />
              GPS desativado · Centro na Estação Livre
            </div>
          )}

          {highlightLine && (
            <button
              onClick={() => p.setHighlight(null)}
              className="pointer-events-auto self-start flex items-center gap-2 bg-go-soft/95 border border-go/60 text-go rounded-full pl-3 pr-2.5 py-1 text-xs font-semibold shadow-lg"
            >
              Filtrando linha {highlightLine.code} ({highlightLine.name})
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Painel Inferior Deslizante (Bottom Sheet) */}
      <div
        style={{ height: sheetH }}
        className="bg-ink-900 border-t border-ink-700 rounded-t-3xl flex flex-col transition-all duration-200 shadow-2xl z-20"
      >
        <button
          onClick={() => setExpanded((e) => !e)}
          className="h-7 w-full flex flex-col items-center justify-center text-slate-400 shrink-0"
          aria-label="Expandir painel"
        >
          <div className="w-10 h-1 rounded-full bg-ink-600 mb-0.5" />
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>

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
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden px-3 pb-2">
            {/* Abas do Painel Inferior: Pontos vs Ônibus Ativos */}
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-ink-800">
              <div className="flex bg-ink-950 p-1 rounded-xl border border-ink-800">
                <button
                  onClick={() => setSheetMode('stops')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    sheetMode === 'stops' ? 'bg-route text-ink-950' : 'text-slate-400'
                  }`}
                >
                  Paradas ({stops.length})
                </button>
                <button
                  onClick={() => setSheetMode('buses')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    sheetMode === 'buses' ? 'bg-route text-ink-950' : 'text-slate-400'
                  }`}
                >
                  Ônibus ao vivo ({p.vehicles.length})
                </button>
              </div>

              <button
                onClick={() => loadStops(true)}
                disabled={loadingStops}
                className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-ink-800 border border-ink-600 text-xs font-medium text-slate-200 active:bg-ink-700 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingStops ? 'animate-spin' : ''}`} />
                Atualizar
              </button>
            </div>

            {stopsErr && <div className="text-xs text-halt py-2">{stopsErr}</div>}

            <div className="flex-1 scroll-y divide-y divide-ink-800/80">
              {sheetMode === 'stops' ? (
                <>
                  {!stopsErr && !stops.length && !loadingStops && (
                    <Empty
                      icon={<MapPin className="w-8 h-8 text-slate-500" />}
                      title="Nenhum ponto por perto"
                      hint="Toque em Atualizar ou mova o mapa."
                    />
                  )}
                  {stops.slice(0, 60).map((s) => (
                    <button
                      key={s.id}
                      onClick={() => selectStop(s)}
                      className="w-full text-left flex items-center gap-3 py-3 px-1 active:bg-ink-800/60 transition"
                    >
                      <div className="h-10 w-10 rounded-xl bg-route/15 border border-route/30 grid place-items-center text-route shrink-0">
                        <MapPin className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-white truncate">{s.name}</div>
                        <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                          <span className="text-go font-semibold">{formatDistance(s.distance)}</span>
                          {s.lines.length > 0 && (
                            <span className="truncate">
                              · Linhas:{' '}
                              {s.lines
                                .slice(0, 6)
                                .map((l) => findLine(resolveLineKey(l))?.code ?? l)
                                .join(', ')}
                            </span>
                          )}
                        </div>
                      </div>
                      {isFav(s.id) && <Star className="w-4 h-4 text-warn fill-warn shrink-0" />}
                    </button>
                  ))}
                </>
              ) : (
                <>
                  {!p.vehicles.length && (
                    <Empty
                      icon={<Bus className="w-8 h-8 text-slate-500" />}
                      title="Nenhum veículo retornado no momento"
                      hint="Aguarde a atualização automática de 15s."
                    />
                  )}
                  {p.vehicles.map((v) => {
                    const code = busCode(v);
                    const line = findLine(v.lineKey);
                    return (
                      <button
                        key={v.id}
                        onClick={() => {
                          p.setHighlight(v.lineKey || null);
                          setTarget({ lat: v.lat, lng: v.lng, zoom: 16, n: Date.now() });
                        }}
                        className="w-full text-left flex items-center gap-3 py-2.5 px-1 active:bg-ink-800/60"
                      >
                        <LineBadge code={code} size="sm" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-white truncate">
                            {line?.name ?? (v.lineName || v.lineLabel || 'Em trânsito')}
                          </div>
                          <div className="text-xs text-slate-400 truncate">
                            Carro {v.id} {v.direction ? `· ${v.direction}` : ''}
                          </div>
                        </div>
                        <span className="text-xs font-semibold text-go bg-go-soft px-2.5 py-1 rounded-lg">
                          Localizar
                        </span>
                      </button>
                    );
                  })}
                </>
              )}
            </div>
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
    <div className="flex-1 flex flex-col overflow-hidden px-3 pb-2">
      <div className="flex items-center gap-2 pb-2.5 border-b border-ink-800">
        <IconBtn onClick={props.onBack} label="Voltar">
          <ArrowLeft className="w-5 h-5" />
        </IconBtn>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-white truncate">{stop.name}</div>
          <div className="text-[11px] text-go flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-go animate-pulse" />
            Previsão no ponto · atualiza a cada 15 s
          </div>
        </div>
        <IconBtn onClick={props.onFav} label="Favoritar ponto" active={props.fav}>
          <Star className={`w-5 h-5 ${props.fav ? 'fill-warn text-warn' : ''}`} />
        </IconBtn>
        <IconBtn onClick={props.onRefresh} label="Atualizar">
          <RefreshCw className={`w-4 h-4 ${props.loading ? 'animate-spin' : ''}`} />
        </IconBtn>
      </div>

      {props.error && <div className="text-xs text-halt py-2">{props.error}</div>}

      <div className="flex-1 scroll-y divide-y divide-ink-800">
        {!props.loading && !props.error && !arrivals.length && (
          <Empty
            icon={<Bus className="w-8 h-8 text-slate-500" />}
            title="Nenhum ônibus aproximando-se agora"
            hint="Consulte a aba Linhas para ver a tabela completa de saídas da FAOL."
          />
        )}
        {arrivals.map((a) => {
          const code = findLine(a.lineKey)?.code ?? a.lineLabel.slice(0, 4);
          const soon = a.etaMin !== null && a.etaMin <= 3;
          return (
            <button
              key={a.key}
              onClick={() => a.lineKey && props.onPickLine(a.lineKey)}
              className="w-full flex items-center gap-3 py-3 px-1 text-left active:bg-ink-800/60"
            >
              <LineBadge code={code} />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-white truncate">
                  {a.destination || findLine(a.lineKey)?.name || a.lineLabel}
                </div>
                {a.prefix && <div className="text-xs text-slate-400">Veículo {a.prefix}</div>}
              </div>
              <div
                className={`num px-3 py-1.5 rounded-xl font-bold text-sm ${
                  soon
                    ? 'bg-go text-ink-950 animate-pulse'
                    : 'bg-ink-800 text-route border border-ink-700'
                }`}
              >
                {a.etaMin === null
                  ? a.etaText || '—'
                  : a.etaMin <= 0
                  ? 'Chegando'
                  : `${a.etaMin} min`}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
