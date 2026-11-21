import { X } from 'lucide-react';
import { IconBtn, LineBadge } from '../../../components/ui/ui';
import { findLine } from '../../../data/faolLines';
import type { MerusVehicle } from '../../../types';
import { busCode } from '../mapIcons';

/** Cartão do ônibus tocado no mapa: linha + sentido. */
export default function BusInfoCard({
  bus,
  expanded,
  onClose,
}: {
  bus: MerusVehicle;
  expanded: boolean;
  onClose: () => void;
}) {
  return (
    <div
      className="glass absolute inset-x-3 z-[1000] rounded-2xl p-3 shadow-lg shadow-black/40"
      style={{ bottom: `calc(${expanded ? '70%' : '36%'} + 12px)` }}
    >
      <div className="flex items-center gap-3">
        <LineBadge code={busCode(bus)} size="lg" />
        <div className="flex-1 min-w-0">
          <div className="text-xs text-slate-400 truncate">
            {findLine(bus.lineKey)?.name ?? bus.lineName ?? 'Linha'}
          </div>
          <div className="font-sign text-2xl font-semibold leading-tight truncate">
            {bus.direction || 'Sentido não informado'}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            Veículo {bus.id}
            {bus.speed !== null && ` · ${Math.round(bus.speed)} km/h`}
          </div>
        </div>
        <IconBtn onClick={onClose} label="Fechar">
          <X size={20} />
        </IconBtn>
      </div>
    </div>
  );
}
