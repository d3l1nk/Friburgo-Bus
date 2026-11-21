import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useNow, usePolling } from './useTimers';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLElement;
beforeEach(() => {
  vi.useFakeTimers();
  host = document.createElement('div');
  document.body.appendChild(host);
});
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  vi.useRealTimers();
});

function mount(el: ReturnType<typeof createElement>) {
  root = createRoot(host);
  act(() => root!.render(el));
}

describe('usePolling', () => {
  const Poller = ({ fn, enabled }: { fn: () => void; enabled: boolean }) => {
    usePolling(fn, 1000, enabled);
    return null;
  };

  it('chama na hora e a cada intervalo', () => {
    const fn = vi.fn();
    mount(createElement(Poller, { fn, enabled: true }));
    expect(fn).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(3000);
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it('não faz nada quando desativado', () => {
    const fn = vi.fn();
    mount(createElement(Poller, { fn, enabled: false }));
    vi.advanceTimersByTime(5000);
    expect(fn).not.toHaveBeenCalled();
  });

  it('não vaza: ao desmontar para o timer e remove o listener de visibilidade', () => {
    const add = vi.spyOn(document, 'addEventListener');
    const remove = vi.spyOn(document, 'removeEventListener');
    const fn = vi.fn();
    mount(createElement(Poller, { fn, enabled: true }));
    const added = add.mock.calls.filter((c) => c[0] === 'visibilitychange').length;
    act(() => root!.unmount());
    root = null;
    vi.advanceTimersByTime(10_000);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(remove.mock.calls.filter((c) => c[0] === 'visibilitychange')).toHaveLength(added);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('pausa enquanto o app está em segundo plano', () => {
    const fn = vi.fn();
    mount(createElement(Poller, { fn, enabled: true }));
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    vi.advanceTimersByTime(5000);
    expect(fn).toHaveBeenCalledTimes(1);
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
  });
});

describe('useNow', () => {
  it('atualiza no intervalo e limpa timers ao desmontar', () => {
    let seen = 0;
    const Clock = () => {
      useNow(1000);
      seen++;
      return null;
    };
    mount(createElement(Clock));
    const first = seen;
    act(() => void vi.advanceTimersByTime(2000));
    expect(seen).toBeGreaterThan(first);
    act(() => root!.unmount());
    root = null;
    expect(vi.getTimerCount()).toBe(0);
  });
});
