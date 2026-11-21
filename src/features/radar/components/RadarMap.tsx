import { memo, useMemo } from 'react';
import { MapContainer, Marker, TileLayer } from 'react-leaflet';
import type { LatLng, MerusStop, MerusVehicle } from '../../../types';
import { ICON_ME, ICON_STOP, ICON_STOP_SEL, busCode, busIcon } from '../mapIcons';
import { isStopVisible, type TileSource } from '../mapStyles';
import { MapController, ZoomWatcher, type FlyTarget } from './MapControllers';

interface Props {
  pos: LatLng;
  active: boolean;
  target: FlyTarget | null;
  tileKey: string;
  source: TileSource;
  onTileError: () => void;
  zoom: number;
  onZoom: (z: number) => void;
  stops: MerusStop[];
  selectedId: string | null;
  onSelectStop: (s: MerusStop) => void;
  vehicles: MerusVehicle[];
  highlight: string | null;
  onSelectBus: (v: MerusVehicle) => void;
}

/** Mapa Leaflet: camadas de tiles, posição do usuário, pontos e ônibus. */
function RadarMap(p: Props) {
  const { stops, zoom, selectedId, onSelectStop, vehicles, highlight, onSelectBus } = p;

  // marcadores memoizados: selecionar um ponto não recria todos os ícones
  const stopMarkers = useMemo(
    () =>
      stops
        .filter((s) => isStopVisible(s.id, zoom, selectedId))
        .map((s) => (
          <Marker
            key={s.id}
            position={[s.lat, s.lng]}
            icon={selectedId === s.id ? ICON_STOP_SEL : ICON_STOP}
            eventHandlers={{ click: () => onSelectStop(s) }}
          />
        )),
    [stops, zoom, selectedId, onSelectStop],
  );

  const busMarkers = useMemo(
    () =>
      vehicles.map((v, i) => {
        const mode = highlight ? (v.lineKey === highlight ? 'hi' : 'dim') : '';
        return (
          <Marker
            key={`${v.id}-${i}`}
            position={[v.lat, v.lng]}
            icon={busIcon(busCode(v), mode)}
            zIndexOffset={mode === 'hi' ? 900 : 500}
            eventHandlers={{ click: () => onSelectBus(v) }}
          />
        );
      }),
    [vehicles, highlight, onSelectBus],
  );

  return (
    <MapContainer
      center={[p.pos.lat, p.pos.lng]}
      zoom={16}
      zoomControl={false}
      attributionControl
      maxZoom={19}
      className="absolute inset-0 w-full h-full isolate"
    >
      <TileLayer
        key={p.tileKey}
        url={p.source.url}
        attribution={p.source.attribution}
        subdomains={p.source.subdomains ?? 'abc'}
        maxNativeZoom={p.source.maxNativeZoom}
        maxZoom={19}
        eventHandlers={{ tileerror: p.onTileError }}
      />
      {p.source.overlay && (
        <TileLayer
          key={`ov-${p.tileKey}`}
          url={p.source.overlay}
          maxNativeZoom={16}
          maxZoom={19}
          zIndex={5}
        />
      )}
      <ZoomWatcher onZoom={p.onZoom} />
      <MapController active={p.active} target={p.target} />
      <Marker position={[p.pos.lat, p.pos.lng]} icon={ICON_ME} interactive={false} />
      {stopMarkers}
      {busMarkers}
    </MapContainer>
  );
}

export default memo(RadarMap);
