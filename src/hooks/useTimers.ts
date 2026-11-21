import { useEffect, useRef, useState } from 'react';

/** Relógio que só atualiza o componente que o usa (pausa com a tela em segundo plano). */
export function useNow(intervalMs = 10000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => {
      if (!document.hidden) setNow(new Date());
    };
    const id = setInterval(tick, intervalMs);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [intervalMs]);
  return now;
}

/** Executa fn já e a cada `ms` enquanto `enabled` e o app estiver visível. Limpa timers e listeners ao sair. */
export function usePolling(
  fn: () => void | Promise<void>,
  ms: number,
  enabled: boolean,
  deps: unknown[] = [],
) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!enabled) return;
    void ref.current();
    const id = setInterval(() => {
      if (!document.hidden) void ref.current();
    }, ms);
    const onVisible = () => {
      if (!document.hidden) void ref.current();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
    // `deps` é repassado pelo chamador de propósito (ex.: reiniciar o polling ao trocar de ponto).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ms, ...deps]);
}
