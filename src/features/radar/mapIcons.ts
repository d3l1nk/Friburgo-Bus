import L from 'leaflet';
import { findLine } from '../../data/faolLines';
import type { MerusVehicle } from '../../types';

export const ICON_STOP = L.divIcon({
  className: '',
  html: '<div class="stop-dot"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});
export const ICON_STOP_SEL = L.divIcon({ className: '', html: '<div class="stop-dot sel"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }); // prettier-ignore
export const ICON_ME = L.divIcon({
  className: '',
  html: '<div class="me-dot"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

export type BusMode = '' | 'dim' | 'hi';

const busIcons = new Map<string, L.DivIcon>();

/** Ícones de ônibus são criados uma única vez por combinação (código, modo). */
export function busIcon(code: string, mode: BusMode): L.DivIcon {
  const k = `${mode}|${code}`;
  let icon = busIcons.get(k);
  if (!icon) {
    icon = L.divIcon({
      className: '',
      html: `<div class="bus-pin ${mode}">${code}</div>`,
      iconSize: [30, 22],
      iconAnchor: [15, 11],
    });
    busIcons.set(k, icon);
  }
  return icon;
}

export const busCode = (v: MerusVehicle): string =>
  findLine(v.lineKey)?.code ?? v.lineLabel.match(/\d{1,3}[A-Za-z]?/)?.[0] ?? '?';
