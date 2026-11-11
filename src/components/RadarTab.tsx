import { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Bug, ChevronDown, ChevronUp, Crosshair, MapPin, RefreshCw, Star, WifiOff, X, ArrowLeft } from 'lucide-react';
import { Header, IconBtn, LineBadge, Empty } from './ui';
import { formatDistance, ESTACAO_LIVRE, type GeoFix } from '../lib/geo';
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

const stopIcon = (sel: boolean) =>
  L.divIcon({ className: '', html: `<div class="stop-dot ${sel ? 'sel' : ''}"></div>`, iconSize: sel ? [18, 18] : [14, 14], iconAnchor: sel ? [9, 9] : [7, 7] });
const meIcon = L.divIcon({ className: '', html: '<div class="me-dot"></div>', iconSize: [16, 16], iconAnchor: [8, 8] });

function busCode(v: MerusVehicle): string {
  return findLine(v.lineKey)?.code ?? (v.lineLabel.match(/\d{1,3}[A-Za-z]?/)?.[0] ?? '?');
}

function MapController({ active, target }: { active: boolean; target: { lat: number; lng: number; zoom?: number; n: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (active) setTimeout(() => map.invalidateSize(), 60);
  }, [active, map]);
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], target.zoom ?? map.getZoom(), { duration: 0.6 });
  }, [target, map]);
  return null;
}

export default function RadarTab(p: Props) {
  const pos = p.geo?.pos ?? ESTACAO_LIVRE;
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

  // carrega pontos quando a posição muda (usa cache se andou < 400 m)
  useEffect(() => {
    if (p.geo) void loadStops(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.geo?.pos.lat, p.geo?.pos.lng]);

  // ponto vindo dos favoritos
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
            html: `<div class="bus-pin ${hi ? 'hi' : dim ? 'dim' : ''}">${code}</div>`,
            iconSize: [30, 22],
            iconAnchor: [15, 11],
          }),
        };
      }),
    [p.vehicles, p.highlight],
  );

  const isFav = (id: string) => p.favs.stops.some((s) => s.id === id);
  const highlightLine = p.highlight ? findLine(p.highlight) : undefined;
  const sheetH = expanded ? '62%' : selected ? '40%' : '30%';

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Radar"
        sub={p.vehiclesError ? 'Sem sinal do GPS dos ônibus' : p.vehicles.length ? `${p.vehicles.length} ônibus no ar` : 'Procurando ônibus…'}
        right={<IconBtn onClick={p.onOpenDiag} label="Inspecionar JSON"><Bug size={20} /></IconBtn>}
      />
      <div className="relative flex-1 min-h-0">
        <MapContainer center={[pos.lat, pos.lng]} zoom={16} zoomControl={false} className="absolute inset-0" attributionControl>
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; OpenStreetMap &copy; CARTO'
            subdomains="abcd"
            maxZoom={19}
          />
          <MapController active={p.active} target={target} />
          <Marker position={[pos.lat, pos.lng]} icon={meIcon} interactive={false} />
          {stops.map((s) => (
            <Marker
              key={s.id}
              position={[s.lat, s.lng]}
              icon={stopIcon(selected?.id === s.id)}
              eventHandlers={{ click: () => selectStop(s) }}
            />
          ))}
          {busIcons.map(({ v, icon }) => (
            <Marker key={v.id} position={[v.lat, v.lng]} icon={icon} zIndexOffset={500} />
          ))}
        </MapContainer>

        <div className="absolute top-3 right-3 z-[500] flex flex-col gap-2">
          <button
            onClick={() => {
              p.onRelocate();
              setTarget({ lat: pos.lat, lng: pos.lng, zoom: 16, n: Date.now() });
            }}
            aria-label="Minha localização"
            className="h-11 w-11 rounded-full bg-ink-900/95 border border-ink-600 grid place-items-center text-route"
          >
            <Crosshair size={22} />
          </button>
        </div>

        <div className="absolute top-3 left-3 right-16 z-[500] flex flex-col gap-2 items-start">
          {p.geo?.usingFallback && (
            <div className="bg-warn-soft border border-warn/50 text-warn text-xs rounded-lg px-3 py-1.5">
              GPS indisponível. Usando a Estação Livre como referência.
            </div>
          )}
          {highlightLine && (
            <button
              onClick={() => p.setHighlight(null)}
              className="flex items-center gap-2 bg-go-soft border border-go/60 text-go rounded-full pl-3 pr-2 py-1 text-sm font-medium"
            >
              Destacando linha {highlightLine.code} <X size={16} />
            </button>
          )}
        </div>

        {/* Bottom sheet */}
        <div
          className="absolute inset-x-0 bottom-0 z-[600] bg-ink-900 border-t border-ink-600 rounded-t-2xl flex flex-col transition-[height] duration-200"
          style={{ height: sheetH }}
        >
          <button onClick={() => setExpanded((e) => !e)} className="h-6 grid place-items-center text-slate-500 shrink-0" aria-label="Expandir painel">
            {expanded ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
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
            <>
              <div className="flex items-center justify-between px-4 pb-2 shrink-0">
                <div>
                  <div className="font-sign text-xl font-semibold leading-none">Pontos perto de você</div>
                  <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                    {stops.length} pontos
                    {stopsInfo?.fromCache && (
                      <span className="inline-flex items-center gap-1 text-warn">
                        <WifiOff size={11} /> cópia local
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => loadStops(true)}
                  disabled={loadingStops}
                  className="flex items-center gap-2 h-10 px-3 rounded-full bg-ink-700 text-sm font-medium active:bg-ink-600 disabled:opacity-60"
                >
                  <RefreshCw size={16} className={loadingStops ? 'animate-spin' : ''} />
                  Atualizar pontos
                </button>
              </div>
              <div className="scroll-y flex-1 px-3 pb-3">
                {stopsErr && <div className="text-halt text-sm px-1 py-2">{stopsErr}</div>}
                {!stopsErr && !stops.length && !loadingStops && (
                  <Empty icon={<MapPin size={28} />} title="Nenhum ponto por perto" hint="Toque em Atualizar pontos ou confira a aba Diagnóstico." />
                )}
                {stops.slice(0, 60).map((s) => (
                  <button
                    key={s.id}
                    onClick={() => selectStop(s)}
                    className="w-full text-left flex items-center gap-3 px-2 py-3 border-b border-ink-700 active:bg-ink-800"
                  >
                    <div className="num text-lg text-route w-14 shrink-0">{formatDistance(s.distance)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{s.name}</div>
                      {s.lines.length > 0 && (
                        <div className="text-xs text-slate-400 truncate">
                          {s.lines.slice(0, 8).map((l) => findLine(resolveLineKey(l))?.code ?? l).join('  ')}
                        </div>
                      )}
                    </div>
                    {isFav(s.id) && <Star size={16} className="text-warn fill-warn" />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
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
        {!props.loading && !props.error && !arrivals.length && (
          <Empty icon={<MapPin size={28} />} title="Nenhum ônibus a caminho" hint="Quando houver previsão, ela aparece aqui." />
        )}
        <div className="rounded-xl overflow-hidden border border-ink-700 bg-ink-950">
          {arrivals.map((a) => {
            const code = findLine(a.lineKey)?.code ?? a.lineLabel.slice(0, 4);
            const soon = a.etaMin !== null && a.etaMin <= 2;
            return (
              <button
                key={a.key}
                onClick={() => a.lineKey && props.onPickLine(a.lineKey)}
                className="w-full flex items-center gap-3 px-3 py-3 border-b border-ink-800 last:border-0 text-left"
              >
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
      </div>
    </div>
  );
}
