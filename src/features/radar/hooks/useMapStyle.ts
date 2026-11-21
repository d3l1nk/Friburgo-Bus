import { useCallback, useEffect, useRef, useState } from 'react';
import { getJSON, setJSON } from '../../../lib/storage';
import {
  MAX_FALLBACK_SWITCHES,
  STYLES,
  STYLE_KEY,
  TILE_ERRORS_BEFORE_FALLBACK,
  currentSource,
  nextFallback,
  type MapStyle,
} from '../mapStyles';

const TOAST_MS = 4500;

/** Estilo do mapa (persistido) + troca automática de servidor quando os tiles falham. */
export function useMapStyle() {
  const [style, setStyle] = useState<MapStyle>('ruas');
  const [srcIdx, setSrcIdx] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const errors = useRef({ count: 0, switches: 0 });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    getJSON<MapStyle>(STYLE_KEY).then((s) => {
      if (s && STYLES[s]) setStyle(s);
    });
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  const pick = useCallback((s: MapStyle) => {
    errors.current = { count: 0, switches: 0 };
    setStyle(s);
    setSrcIdx(0);
    void setJSON(STYLE_KEY, s);
  }, []);

  const onTileError = useCallback(() => {
    const e = errors.current;
    e.count++;
    if (e.count < TILE_ERRORS_BEFORE_FALLBACK || e.switches >= MAX_FALLBACK_SWITCHES) return;
    e.count = 0;
    e.switches++;
    const fb = nextFallback(style, srcIdx);
    setStyle(fb.style);
    setSrcIdx(fb.srcIdx);
    setToast(fb.message);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), TOAST_MS);
  }, [style, srcIdx]);

  return {
    style,
    source: currentSource(style, srcIdx),
    tileKey: `${style}-${srcIdx}`,
    toast,
    pick,
    onTileError,
  };
}
