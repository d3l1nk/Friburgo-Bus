import { useMemo } from 'react';
import { useNow } from '../../../hooks/useTimers';
import { DAY_LABEL, dayTypeOf, etaParts, minutesOfDay } from '../../../lib/time';
import { nextByColumn } from '../../../services/faol';
import type { Timetable } from '../../../types';
import { pickDepartureCards, type DepartureCardModel } from '../scheduleView';

function DepartureCard({ tag, row, tone }: DepartureCardModel) {
  const eta = row.minutesLeft !== undefined ? etaParts(row.minutesLeft) : null;
  const soon = row.minutesLeft !== undefined && row.minutesLeft <= 5;
  return (
    <div
      className={`rounded-2xl p-3 border ${tone === 'route' ? 'bg-route-soft/50 border-route/40' : 'bg-go-soft/40 border-go/40'}`}
    >
      <div
        className={`text-[10px] font-semibold uppercase tracking-wider ${tone === 'route' ? 'text-route' : 'text-go'}`}
      >
        {tag}
      </div>
      <div className="text-sm font-medium truncate mt-0.5">{row.origin}</div>
      <div className="mt-2 flex items-baseline gap-1">
        {eta ? (
          <>
            <span
              className={`num font-bold leading-none ${eta.big.length > 4 ? 'text-4xl' : 'text-6xl'} ${soon ? 'text-go' : 'text-slate-50'}`}
            >
              {eta.big}
            </span>
            <span className="text-base text-slate-300">{eta.unit}</span>
          </>
        ) : (
          <span className="num text-4xl text-slate-500">—</span>
        )}
      </div>
      <div className="text-xs text-slate-400 mt-2 num">
        {row.next ? (
          <>
            às <b className="text-slate-100 text-base font-semibold">{row.next.time}</b>
            {row.after && <> · depois {row.after.time}</>}
          </>
        ) : (
          'sem mais saídas hoje'
        )}
      </div>
    </div>
  );
}

interface Props {
  table: Timetable | null;
  loading: boolean;
  replacementText?: string;
}

/** Cartões lado a lado: Estação Livre x Bairro. Atualiza a cada 10 s e só este bloco re-renderiza. */
export default function NextCards({ table, loading, replacementText }: Props) {
  const now = useNow(10000);
  const { cards, others } = useMemo(
    () => pickDepartureCards(table ? nextByColumn(table, minutesOfDay(now)) : []),
    [table, now],
  );

  return (
    <section>
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="font-sign text-xl font-semibold">Próxima saída</h2>
        <span className="text-xs text-slate-400">hoje · {DAY_LABEL[dayTypeOf()]}</span>
      </div>
      {replacementText && (
        <div className="rounded-xl bg-warn-soft border border-warn/50 p-3 text-sm">{replacementText}</div>
      )}
      {!replacementText && loading && (
        <div className="rounded-xl bg-ink-800 border border-ink-600 p-4 text-sm text-slate-400">
          Carregando…
        </div>
      )}
      {!replacementText && !loading && !table && (
        <div className="rounded-xl bg-ink-800 border border-ink-600 p-4 text-sm text-slate-400">
          Tabela de hoje indisponível.
        </div>
      )}
      {!replacementText && table && cards.length > 0 && (
        <>
          <div className={`grid gap-3 ${cards.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {cards.map((c) => (
              <DepartureCard key={c.row.origin} {...c} />
            ))}
          </div>
          {others.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-300">
              {others.map((b) => (
                <span key={b.origin} className="bg-ink-800 border border-ink-600 rounded-md px-2 py-1">
                  {b.origin} · <span className="num text-sm text-slate-100">{b.next?.time}</span>
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
