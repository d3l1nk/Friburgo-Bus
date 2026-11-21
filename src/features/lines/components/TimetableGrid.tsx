import { FileText, WifiOff } from 'lucide-react';
import { useNow } from '../../../hooks/useTimers';
import { minutesOfDay } from '../../../lib/time';
import type { Timetable } from '../../../types';
import { filterUpcoming, groupByHour, nextMinute, ramalColor } from '../scheduleView';

interface Props {
  table: Timetable;
  fromCache: boolean;
  origin: string | null;
  setOrigin: (o: string) => void;
  isToday: boolean;
  onlyUpcoming: boolean;
  onShowAll: () => void;
  onOpenOriginal: () => void;
}

export default function TimetableGrid(p: Props) {
  const { table, isToday } = p;
  const now = useNow(30000);
  const nowMin = minutesOfDay(now);
  const col = table.columns.find((c) => c.origin === p.origin) ?? table.columns[0];

  if (!col) {
    return (
      <div className="rounded-xl bg-warn-soft border border-warn/40 p-3 text-sm space-y-2">
        <div className="font-medium text-warn">Não consegui ler esta tabela automaticamente.</div>
        <div className="text-slate-300">
          O layout da página pode ter mudado. Abra a tabela original ou veja o conteúdo bruto na aba
          Diagnóstico.
        </div>
        <button
          onClick={p.onOpenOriginal}
          className="h-10 px-4 rounded-full bg-ink-800 border border-ink-600 flex items-center gap-2"
        >
          <FileText size={15} /> Ver tabela original
        </button>
        {table.rawText && (
          <pre className="text-xs whitespace-pre-wrap max-h-48 overflow-auto text-slate-400">
            {table.rawText}
          </pre>
        )}
      </div>
    );
  }

  const visible = filterUpcoming(col.departures, nowMin, isToday && p.onlyUpcoming);
  const nextMin = isToday ? nextMinute(col.departures, nowMin) : undefined;
  const currentHour = Math.floor(nowMin / 60);

  return (
    <div>
      {p.fromCache && (
        <div className="flex items-center gap-2 text-xs text-warn mb-2">
          <WifiOff size={13} /> Cópia offline de {new Date(table.fetchedAt).toLocaleDateString('pt-BR')}
        </div>
      )}
      {table.columns.length > 1 && (
        <div className="flex gap-2 mb-3 overflow-x-auto scroll-y">
          {table.columns.map((c) => (
            <button
              key={c.origin}
              onClick={() => p.setOrigin(c.origin)}
              className={`shrink-0 h-9 px-3 rounded-lg text-sm border ${c.origin === col.origin ? 'bg-ink-600 border-route text-white' : 'bg-ink-800 border-ink-600 text-slate-300'}`}
            >
              {c.isTerminal ? '' : 'Saindo de '}
              {c.origin}
            </button>
          ))}
        </div>
      )}

      {visible.length === 0 ? (
        <div className="rounded-xl bg-ink-800 border border-ink-600 p-4 text-sm text-slate-300 space-y-2">
          <div>Não há mais saídas hoje nesta origem.</div>
          <button onClick={p.onShowAll} className="h-9 px-3 rounded-full bg-ink-700 text-sm">
            Mostrar o dia todo
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-ink-700 overflow-hidden">
          {groupByHour(visible).map(([h, deps]) => (
            <div
              key={h}
              className={`flex items-start gap-3 px-3 py-2.5 border-b border-ink-800 last:border-0 ${isToday && h === currentHour ? 'bg-ink-800/70' : ''}`}
            >
              <div
                className={`num text-2xl w-10 leading-9 ${isToday && h === currentHour ? 'text-route' : 'text-slate-500'}`}
              >
                {String(h).padStart(2, '0')}
              </div>
              <div className="flex flex-wrap gap-2 flex-1">
                {deps.map((d) => {
                  const past = isToday && d.minutes < nowMin;
                  const next = d.minutes === nextMin;
                  return (
                    <span
                      key={d.time + (d.ramal ?? '')}
                      className={`num text-xl h-9 px-2.5 rounded-lg grid place-items-center min-w-[46px] ${
                        next
                          ? 'bg-go text-ink-950 font-bold ring-2 ring-go/40'
                          : past
                            ? 'text-slate-600'
                            : 'bg-ink-700 text-slate-50'
                      }`}
                    >
                      <span>
                        {d.time.slice(3)}
                        {d.ramal && (
                          <sup
                            className="ml-0.5 text-[11px] font-bold"
                            style={{ color: next ? '#04261c' : ramalColor(d.ramal) }}
                          >
                            {d.ramal}
                          </sup>
                        )}
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {table.legend.length > 0 && (
        <div className="mt-3 text-sm space-y-1">
          <div className="text-xs text-slate-400">Ramais</div>
          {table.legend.map((l) => (
            <div key={l.code} className="text-slate-300">
              <span className="num font-semibold text-route">{l.code}</span> {l.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
