import type { FaolAlert, LatLng, MerusVehicle } from '../../types';

export interface LuizAction {
  label: string;
  kind: 'line' | 'map' | 'alert' | 'feedback' | 'about' | 'faol' | 'tab' | 'ask';
  payload?: string;
}

export interface LuizReply {
  text: string;
  actions?: LuizAction[];
}

export interface LuizContext {
  pos: LatLng;
  vehicles: MerusVehicle[];
  alerts: FaolAlert[];
  favLines: string[];
}

export interface LuizMemory {
  lastLine?: string;
  pending?: 'next' | 'live' | 'alert' | 'desvio';
}
