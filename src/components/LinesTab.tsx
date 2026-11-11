import { useMemo, useState } from 'react';
import { AlertTriangle, Search, Star, Bus } from 'lucide-react';
import { Header, LineBadge, Empty } from './ui';
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

  const liveCount = useMemo(() => {
    const m = new Map<string, number>();
    p.vehicles.forEach((v) => m.set(v.lineKey, (m.get(v.lineKey) ?? 0) + 1));
    return m;
  }, [p.vehicles]);

  const list = useMemo(() => {
    const nq = norm(q.trim());
    return FAOL_LINES.filter((l) => {
      if (region !== 'all' && l.region !== region) return false;
      if (!nq) return true;
      return norm(l.code).startsWith(nq) || norm(l.name).includes(nq) || norm(REGION_LABEL[l.region]).includes(nq);
    });
  }, [q, region]);

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
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Linhas e horários" sub={`${FAOL_LINES.length} linhas da FAOL`} />
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
          {[{ id: 'all' as const, label: 'Todas' }, ...REGIONS].map((r) => (
            <button
              key={r.id}
              onClick={() => setRegion(r.id)}
              className={`shrink-0 h-9 px-4 rounded-full text-sm font-medium border ${
                region === r.id ? 'bg-route text-ink-950 border-route' : 'bg-ink-800 text-slate-300 border-ink-600'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="scroll-y flex-1 px-2 pb-4">
        {!list.length && <Empty icon={<Search size={28} />} title="Nenhuma linha encontrada" hint="Tente o número ou parte do nome do bairro." />}
        {list.map((l) => {
          const key = lineKey(l.code);
          const hasAlert = p.alerts.some((a) => a.lineKey === key);
          const live = liveCount.get(key) ?? 0;
          const fav = p.favLines.includes(l.code);
          return (
            <button
              key={l.code}
              onClick={() => p.setOpenCode(l.code)}
              className="w-full flex items-center gap-3 px-2 py-3 border-b border-ink-800 text-left active:bg-ink-800"
            >
              <div className="w-[52px] flex justify-center"><LineBadge code={l.code} /></div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{l.name}</div>
                <div className="text-xs text-slate-400">{REGION_LABEL[l.region]}</div>
              </div>
              {hasAlert && <AlertTriangle size={18} className="text-warn shrink-0" />}
              {live > 0 && (
                <span className="flex items-center gap-1 text-go text-sm num shrink-0">
                  <Bus size={15} /> {live}
                </span>
              )}
              {fav && <Star size={16} className="text-warn fill-warn shrink-0" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
