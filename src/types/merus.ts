import type { LatLng } from './common';

export interface MerusStop {
  id: string;
  name: string;
  lat: number;
  lng: number;
  lines: string[];
  /** metros, calculado no cliente */
  distance?: number;
}

export interface MerusArrival {
  key: string;
  lineLabel: string;
  lineKey: string;
  destination: string;
  prefix: string;
  etaMin: number | null;
  etaText: string;
  raw: unknown;
}

export interface MerusVehicle {
  id: string;
  lineLabel: string;
  lineName: string;
  lineKey: string;
  lat: number;
  lng: number;
  heading: number | null;
  direction: string;
  speed: number | null;
  updatedAt: string;
  raw: unknown;
}

export interface StopsCache {
  center: LatLng;
  radius: number;
  savedAt: number;
  stops: MerusStop[];
}
