import { useEffect, useRef, useState } from 'react';
import { evaluateLiveRules } from '../services/notifications';
import type { AlertRule, MerusVehicle } from '../types';

const TOAST_MS = 5000;

/** Avisos por GPS (ônibus saiu do ponto final / passando no ponto). Devolve a mensagem para exibir. */
export function useLiveAlertWatcher(rules: AlertRule[], vehicles: MerusVehicle[]): string | null {
  const [toast, setToast] = useState<string | null>(null);
  const rulesRef = useRef(rules);
  rulesRef.current = rules;
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!vehicles.length) return;
    const fired = evaluateLiveRules(rulesRef.current, vehicles);
    if (fired.length) {
      setToast(fired[0]);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setToast(null), TOAST_MS);
    }
  }, [vehicles]);

  useEffect(() => () => clearTimeout(timer.current), []);
  return toast;
}
