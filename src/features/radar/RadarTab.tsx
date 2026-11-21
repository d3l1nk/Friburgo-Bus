import { useMemo } from 'react';
import { findLine } from '../../data/faolLines';
import type { GeoFix } from '../../lib/geo';
import type { Favorites, MerusStop, MerusVehicle } from '../../types';
import BusInfoCard from './components/BusInfoCard';
import RadarHud from './components/RadarHud';
import RadarMap from './components/RadarMap';
import RadarSheet from './components/RadarSheet';
import { useBusRadar } from './hooks/useBusRadar';
import { useMapStyle } from './hooks/useMapStyle';
import { MIN_STOP_ZOOM } from './mapStyles';

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
  const radar = useBusRadar(p);
  const map = useMapStyle();
  const { stopsApi, arrivalsApi } = radar;

  const favIds = useMemo(() => new Set(p.favs.stops.map((s) => s.id)), [p.favs.stops]);
  const fresh = p.vehiclesAt > 0 && !p.vehiclesError;
  const highlightLine = p.highlight ? findLine(p.highlight) : undefined;

  return (
    <div className="relative h-full w-full overflow-hidden">
      <RadarMap
        pos={radar.pos}
        active={p.active}
        target={radar.target}
        tileKey={map.tileKey}
        source={map.source}
        onTileError={map.onTileError}
        zoom={radar.zoom}
        onZoom={radar.setZoom}
        stops={stopsApi.stops}
        selectedId={arrivalsApi.selected?.id ?? null}
        onSelectStop={radar.selectStop}
        vehicles={p.vehicles}
        highlight={p.highlight}
        onSelectBus={radar.setBusSel}
      />

      <RadarHud
        busCount={p.vehicles.length}
        stopCount={stopsApi.stops.length}
        fresh={fresh}
        usingFallbackGps={!!p.geo?.usingFallback}
        showZoomHint={radar.zoom < MIN_STOP_ZOOM && stopsApi.stops.length > 0}
        highlightLine={highlightLine}
        onClearHighlight={() => p.setHighlight(null)}
        mapStyle={map.style}
        onPickStyle={map.pick}
        mapToast={map.toast}
        onRecenter={radar.recenter}
        onOpenDiag={p.onOpenDiag}
      />

      {radar.busNow && (
        <BusInfoCard bus={radar.busNow} expanded={radar.expanded} onClose={() => radar.setBusSel(null)} />
      )}

      <RadarSheet
        pos={radar.pos}
        expanded={radar.expanded}
        onToggleExpanded={() => radar.setExpanded((e) => !e)}
        sheetTab={radar.sheetTab}
        onSheetTab={radar.setSheetTab}
        stopsApi={stopsApi}
        arrivalsApi={arrivalsApi}
        favIds={favIds}
        onToggleFav={p.toggleFavStop}
        onSelectStop={radar.selectStop}
        onBack={radar.deselectStop}
        onPickLine={p.setHighlight}
        vehicleCount={p.vehicles.length}
        vehiclesError={p.vehiclesError}
        groups={radar.groups}
        highlight={p.highlight}
        onPickGroup={radar.pickGroup}
      />
    </div>
  );
}
