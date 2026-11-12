import { useMemo, useState } from 'react';
import { AlertTriangle, Bus, Search, Star } from 'lucide-react';
import { Empty, Header, LineBadge } from './ui';
import LineDetail from './LineDetail';
import { FAOL_LINES, REGIONS, REGION_LABEL, findLine, lineKey } from '../data/faolLines';
import type { FaolAlert, MerusVehicle, RegionId } from '../types';

interface Props {
  openCode: string | null;
  setOpenCode: (c: string | null) => void;
  alerts: FaolAlert[];
  vehicles: MerusVehicle[];
  favLines: string[];
  toggleFavLine: (code: string) => void;
  onShowOnMap: (key: string) => void;
  onCacheChanged: () => void;
}

const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export default function LinesTab(p: Props) {
  const [q, setQ] = useState('');
  const [region, setRegion] = useState<RegionId | 'all'>('all');
  const [liveOnly, setLiveOnly] = useState(false);
  const [alertOnly, setAlertOnly] = useState(false);

  const liveCount = useMemo(() => {
    const m = new Map<string, number>();
    p.vehicles.forEach((v) => m.set(v.lineKey, (m.get(v.lineKey) ?? 0) + 1));
    return m;
  }, [p.vehicles]);

  // severidade por linha: ALTERAÇÃO (vermelho) > ATENÇÃO (âmbar)
  const severity = useMemo(() => {
    const m = new Map<string, 'ALTERAÇÃO' | 'ATENÇÃO'>();
    p.alerts.forEach((a) => {
      if (a.kind === 'ALTERAÇÃO' || !m.has(a.lineKey)) m.set(a.lineKey, a.kind);
    });
    return m;
  }, [p.alerts]);

  const liveLines = FAOL_LINES.filter((l) => liveCount.has(lineKey(l.code))).length;
  const alertLines = FAOL_LINES.filter((l) => severity.has(lineKey(l.code))).length;

  const list = useMemo(() => {
    const nq = norm(q.trim());
    return FAOL_LINES.filter((l) => {
      const k = lineKey(l.code);
      if (region !== 'all' && l.region !== region) return false;
      if (liveOnly && !liveCount.has(k)) return false;
      if (alertOnly && !severity.has(k)) return false;
      if (!nq) return true;
      return norm(l.code).startsWith(nq) || norm(l.name).includes(nq) || norm(REGION_LABEL[l.region]).includes(nq);
    });
  }, [q, region, liveOnly, alertOnly, liveCount, severity]);

  const open = p.openCode ? findLine(p.openCode) : undefined;
  if (open) {
    const key = lineKey(open.code);
    return (
      <LineDetail
        line={open}
        alerts={p.alerts.filter((a) => a.lineKey === key)}
        vehicles={p.vehicles.filter((v) => v.lineKey === key)}
        isFav={p.favLines.includes(open.code)}
        onToggleFav={() => p.toggleFavLine(open.code)}
        onBack={() => p.setOpenCode(null)}
        onShowOnMap={() => p.onShowOnMap(key)}
        onCacheChanged={p.onCacheChanged}
        onOpenLine={p.setOpenCode}
      />
    );
  }

  const chip = (on: boolean, tone: 'route' | 'go' | 'warn') =>
    `shrink-0 h-9 px-4 rounded-full text-sm font-medium border flex items-center gap-1.5 ${
      on
        ? tone === 'go'
          ? 'bg-go text-ink-950 border-go'
          : tone === 'warn'
            ? 'bg-warn text-ink-950 border-warn'
            : 'bg-route text-ink-950 border-route'
        : 'bg-ink-800 text-slate-300 border-ink-600'
    }`;

  return (
    <div className="flex flex-col h-full">
      <Header title="Linhas e horários" sub={`${liveLines} ao vivo agora · ${alertLines} com alerta`} />
      <div className="px-4 pt-3 pb-2 shrink-0 bg-ink-950">
        <div className="flex items-center gap-2 h-12 rounded-xl bg-ink-800 border border-ink-600 px-3 focus-within:border-route">
          <Search size={18} className="text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Número da linha ou bairro"
            className="flex-1 bg-transparent outline-none text-base placeholder:text-slate-500"
            inputMode="search"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto scroll-y pt-3 -mx-4 px-4">
          <button onClick={() => setLiveOnly((v) => !v)} className={chip(liveOnly, 'go')}>
            <span className="h-2 w-2 rounded-full bg-current" /> Ao vivo ({liveLines})
          </button>
          <button onClick={() => setAlertOnly((v) => !v)} className={chip(alertOnly, 'warn')}>
            <AlertTriangle size={14} /> Com alerta ({alertLines})
          </button>
          {[{ id: 'all' as const, label: 'Todas' }, ...REGIONS].map((r) => (
            <button key={r.id} onClick={() => setRegion(r.id)} className={chip(region === r.id, 'route')}>{r.label}</button>
          ))}
        </div>
      </div>

      <div className="scroll-y flex-1 px-3 pt-1 pb-4">
        {!list.length && <Empty icon={<Search size={28} />} title="Nenhuma linha encontrada" hint="Ajuste a busca ou os filtros." />}
        {list.map((l) => {
          const key = lineKey(l.code);
          const sev = severity.get(key);
          const live = liveCount.get(key) ?? 0;
          const fav = p.favLines.includes(l.code);
          return (
            <button
              key={l.code}
              onClick={() => p.setOpenCode(l.code)}
              className={`relative w-full flex items-center gap-3 pl-4 pr-3 py-3 mb-2 rounded-xl border text-left active:brightness-110 ${
                live ? 'bg-go-soft/40 border-go/40' : 'bg-ink-800 border-ink-700'
              }`}
            >
              {sev && <span className={`absolute left-0 top-2 bottom-2 w-1 rounded-full ${sev === 'ALTERAÇÃO' ? 'bg-halt' : 'bg-warn'}`} />}
              <LineBadge code={l.code} />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{l.name}</div>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-xs text-slate-400">{REGION_LABEL[l.region]}</span>
                  {live > 0 && (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-go bg-go-soft rounded-full pl-1.5 pr-2 py-0.5">
                      <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full rounded-full bg-go opacity-60 animate-ping" /><span className="relative inline-flex h-2 w-2 rounded-full bg-go" /></span>
                      AO VIVO · {live} <Bus size={12} />
                    </span>
                  )}
                  {sev && (
                    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold rounded-full px-2 py-0.5 ${sev === 'ALTERAÇÃO' ? 'bg-halt-soft text-halt' : 'bg-warn-soft text-warn'}`}>
                      <AlertTriangle size={11} /> {sev === 'ALTERAÇÃO' ? 'DESVIO DE ROTA' : 'ATENÇÃO'}
                    </span>
                  )}
                </div>
              </div>
              {fav && <Star size={16} className="text-warn fill-warn shrink-0" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
