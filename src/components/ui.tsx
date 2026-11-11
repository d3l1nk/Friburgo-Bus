import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { FaolAlert } from '../types';

export function LineBadge({ code, size = 'md' }: { code: string; size?: 'sm' | 'md' | 'lg' }) {
  const cls = size === 'lg' ? 'text-3xl min-w-[64px] h-12' : size === 'sm' ? 'text-base min-w-[38px] h-6' : 'text-xl min-w-[48px] h-9';
  return (
    <span className={`num inline-flex items-center justify-center rounded-md bg-route text-ink-950 font-bold px-2 ${cls}`}>
      {code}
    </span>
  );
}

export function AlertBanner({ alert }: { alert: FaolAlert }) {
  const red = alert.kind === 'ALTERAÇÃO';
  return (
    <div className={`flex gap-3 rounded-xl px-3 py-2.5 border ${red ? 'bg-halt-soft border-halt/50' : 'bg-warn-soft border-warn/50'}`}>
      <AlertTriangle className={`shrink-0 mt-0.5 ${red ? 'text-halt' : 'text-warn'}`} size={20} />
      <div className="text-sm leading-snug">
        <div className={`font-semibold ${red ? 'text-halt' : 'text-warn'}`}>{alert.kind === 'ALTERAÇÃO' ? 'Alteração no itinerário' : 'Atenção'}</div>
        <div className="text-slate-200">{alert.text}</div>
      </div>
    </div>
  );
}

export function Header({ title, right, sub }: { title: string; right?: ReactNode; sub?: string }) {
  return (
    <div className="pt-safe shrink-0 bg-ink-950 border-b border-ink-700">
      <div className="flex items-center justify-between px-4 h-14">
        <div>
          <h1 className="font-sign text-2xl font-semibold leading-none">{title}</h1>
          {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
        </div>
        <div className="flex items-center gap-1">{right}</div>
      </div>
    </div>
  );
}

export function IconBtn({ onClick, children, label, active }: { onClick: () => void; children: ReactNode; label: string; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`h-10 w-10 grid place-items-center rounded-full active:bg-ink-700 ${active ? 'text-go' : 'text-slate-300'}`}
    >
      {children}
    </button>
  );
}

export function Empty({ icon, title, hint }: { icon: ReactNode; title: string; hint?: string }) {
  return (
    <div className="grid place-items-center text-center px-8 py-12 text-slate-400">
      <div className="mb-3 text-slate-500">{icon}</div>
      <div className="font-medium text-slate-200">{title}</div>
      {hint && <div className="text-sm mt-1">{hint}</div>}
    </div>
  );
}
