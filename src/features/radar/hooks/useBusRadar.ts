import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { findLine } from '../../../data/faolLines';
import { ESTACAO_LIVRE, haversine, type GeoFix } from '../../../lib/geo';
import type { LatLng, MerusStop, MerusVehicle } from '../../../types';
import type { FlyTarget } from '../components/MapControllers';
import { useNearbyStops } from './useNearbyStops';
import { useStopArrivals } from './useStopArrivals';

export interface BusGroup {
  key: string;
  vs: MerusVehicle[];
  line: ReturnType<typeof findLine>;
}

interface Params {
  active: boolean;
  geo: GeoFix | null;
  vehicles: MerusVehicle[];
  highlight: string | null;
  setHighlight: (k: string | null) => void;
  focusStop: MerusStop | null;
  onFocusConsumed: () => void;
  onRelocate: () => void;
}

/** Estado e ações da tela Radar: pontos, previsões, seleção, painel, destino do mapa. */
export function useBusRadar(p: Params) {
  const pos: LatLng = p.geo?.pos ?? ESTACAO_LIVRE;
  const stopsApi = useNearbyStops(pos);
  const arrivalsApi = useStopArrivals(pos, p.active);
  const { select: selectArrivalsStop, clear: clearArrivals } = arrivalsApi;
  const { reload: reloadStops } = stopsApi;

  const [expanded, setExpanded] = useState(false);
  const [sheetTab, setSheetTab] = useState<'stops' | 'live'>('stops');
  const [target, setTarget] = useState<FlyTarget | null>(null);
  const [zoom, setZoom] = useState(16);
  const [busSel, setBusSel] = useState<MerusVehicle | null>(null);

  const flyTo = useCallback(
    (c: LatLng, z: number) => setTarget({ lat: c.lat, lng: c.lng, zoom: z, n: Date.now() }),
    [],
  );

  const selectStop = useCallback(
    (s: MerusStop) => {
      selectArrivalsStop(s);
      setSheetTab('stops');
      setExpanded(true);
      flyTo(s, 17);
    },
    [selectArrivalsStop, flyTo],
  );

  const deselectStop = useCallback(() => {
    clearArrivals();
    setExpanded(false);
  }, [clearArrivals]);

  // carrega pontos quando a posição muda (usa cache se andou < 400 m) e centraliza só na 1ª posição
  const centered = useRef(false);
  const geoLat = p.geo?.pos.lat;
  const geoLng = p.geo?.pos.lng;
  useEffect(() => {
    if (geoLat === undefined || geoLng === undefined) return;
    void reloadStops(false);
    if (!centered.current) {
      centered.current = true;
      flyTo({ lat: geoLat, lng: geoLng }, 16);
    }
  }, [geoLat, geoLng, reloadStops, flyTo]);

  // ponto vindo dos favoritos
  const { focusStop, onFocusConsumed } = p;
  useEffect(() => {
    if (focusStop) {
      selectStop(focusStop);
      onFocusConsumed();
    }
  }, [focusStop, onFocusConsumed, selectStop]);

  const { onRelocate } = p;
  const recenter = useCallback(() => {
    onRelocate();
    flyTo(pos, 16);
  }, [onRelocate, pos, flyTo]);

  const groups = useMemo<BusGroup[]>(() => {
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
    if (nearest) flyTo(nearest, 16);
    setExpanded(false);
  };

  const busNow = busSel ? (p.vehicles.find((v) => v.id === busSel.id) ?? busSel) : null;

  return {
    pos,
    stopsApi,
    arrivalsApi,
    expanded,
    setExpanded,
    sheetTab,
    setSheetTab,
    target,
    zoom,
    setZoom,
    setBusSel,
    busNow,
    groups,
    pickGroup,
    selectStop,
    deselectStop,
    recenter,
  };
}
