import { memo, useState } from 'react';
import { Bug, Bus, Crosshair, Layers, MapPin, X } from 'lucide-react';
import AppIcon from '../../../components/ui/AppIcon';
import { IconBtn } from '../../../components/ui/ui';
import { DIAGNOSTICS_ENABLED } from '../../../config';
import type { FaolLine } from '../../../types';
import { STYLES, STYLE_ORDER, type MapStyle } from '../mapStyles';

interface Props {
  busCount: number;
  stopCount: number;
  fresh: boolean;
  usingFallbackGps: boolean;
  showZoomHint: boolean;
  highlightLine?: FaolLine;
  onClearHighlight: () => void;
  mapStyle: MapStyle;
  onPickStyle: (s: MapStyle) => void;
  mapToast: string | null;
  onRecenter: () => void;
  onOpenDiag: () => void;
}

/** HUD flutuante (glassmorphism): contadores, estilo do mapa, localização e avisos. */
function RadarHud(p: Props) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      className="absolute inset-x-0 top-0 z-[1000] px-3 pointer-events-none"
      style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
    >
      <div className="glass pointer-events-auto flex items-center gap-1 rounded-2xl h-14 pl-4 pr-1 shadow-lg shadow-black/30">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <AppIcon size={30} />
          <div className="flex items-center gap-2">
            <span className="relative grid place-items-center">
              <Bus size={20} className={p.fresh ? 'text-go' : 'text-slate-500'} />
              {p.fresh && (
                <span className="absolute -top-0.5 -right-1 h-2 w-2 rounded-full bg-go animate-pulse" />
              )}
            </span>
            <div className="leading-none">
              <div className="num text-2xl font-semibold">{p.busCount}</div>
              <div className="text-[10px] uppercase tracking-wide text-slate-400 mt-0.5">no GPS</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <MapPin size={20} className="text-route" />
            <div className="leading-none">
              <div className="num text-2xl font-semibold">{p.stopCount}</div>
              <div className="text-[10px] uppercase tracking-wide text-slate-400 mt-0.5">paradas</div>
            </div>
          </div>
        </div>
        <IconBtn onClick={() => setMenuOpen((o) => !o)} label="Estilo do mapa" active={menuOpen}>
          <Layers size={20} />
        </IconBtn>
        <IconBtn onClick={p.onRecenter} label="Minha localização">
          <Crosshair size={20} />
        </IconBtn>
        {DIAGNOSTICS_ENABLED && (
          <IconBtn onClick={p.onOpenDiag} label="Inspecionar JSON">
            <Bug size={19} />
          </IconBtn>
        )}
      </div>

      {menuOpen && (
        <div className="glass pointer-events-auto mt-2 ml-auto w-40 rounded-xl p-1 shadow-lg shadow-black/30">
          {STYLE_ORDER.map((s) => (
            <button
              key={s}
              onClick={() => {
                p.onPickStyle(s);
                setMenuOpen(false);
              }}
              className={`w-full text-left h-10 px-3 rounded-lg text-sm font-medium ${p.mapStyle === s ? 'bg-route text-ink-950' : 'text-slate-200 active:bg-ink-700'}`}
            >
              {STYLES[s].label}
            </button>
          ))}
        </div>
      )}

      <div className="mt-2 flex flex-col items-start gap-2">
        {p.usingFallbackGps && (
          <div className="pointer-events-auto glass text-warn text-xs rounded-lg px-3 py-1.5">
            GPS indisponível. Usando a Estação Livre como referência.
          </div>
        )}
        {p.showZoomHint && (
          <div className="pointer-events-auto glass text-slate-300 text-xs rounded-lg px-3 py-1.5">
            Aproxime o mapa para ver os pontos.
          </div>
        )}
        {p.highlightLine && (
          <button
            onClick={p.onClearHighlight}
            className="pointer-events-auto glass flex items-center gap-2 text-go rounded-full pl-3 pr-2 py-1 text-sm font-medium"
          >
            Destacando linha {p.highlightLine.code} <X size={16} />
          </button>
        )}
        {p.mapToast && (
          <div className="pointer-events-auto glass text-slate-100 text-xs rounded-lg px-3 py-1.5">
            {p.mapToast}
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(RadarHud);
