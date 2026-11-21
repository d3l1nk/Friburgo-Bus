import { Check, FileText, RefreshCw } from 'lucide-react';
import { DAY_LABEL } from '../../../lib/time';
import type { useLineSchedule } from '../hooks/useLineSchedule';
import TimetableGrid from './TimetableGrid';

type Schedule = ReturnType<typeof useLineSchedule>;

interface Props {
  schedule: Schedule;
  onOpenOriginal: () => void;
  onOpenLine: (code: string) => void;
}

/** "Grade de horários": dias, filtro de próximos, aviso de substituição e a grade da origem escolhida. */
export default function ScheduleSection({ schedule: s, onOpenOriginal, onOpenLine }: Props) {
  return (
    <section>
      <div className="flex items-center justify-between mb-2 gap-2">
        <h2 className="font-sign text-xl font-semibold">Grade de horários</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={onOpenOriginal}
            className="h-9 px-3 rounded-full bg-ink-800 border border-ink-600 text-sm flex items-center gap-1.5 active:bg-ink-700"
          >
            <FileText size={14} /> Tabela original
          </button>
          <button
            onClick={() => void s.reload(s.day, true)}
            className="h-9 w-9 grid place-items-center rounded-full text-slate-300 active:bg-ink-700"
            aria-label="Atualizar tabela"
          >
            <RefreshCw size={16} className={s.viewRes === 'loading' ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-3 overflow-x-auto scroll-y">
        {s.days.map((d) => (
          <button
            key={d}
            onClick={() => s.setDay(d)}
            className={`shrink-0 h-10 px-4 rounded-full text-sm font-medium border ${s.day === d ? 'bg-route text-ink-950 border-route' : 'bg-ink-800 border-ink-600 text-slate-300'}`}
          >
            {DAY_LABEL[d]}
            {d === s.today ? ' · hoje' : ''}
          </button>
        ))}
      </div>

      {s.day === s.today && !s.replacement && (
        <button
          onClick={s.toggleOnlyUpcoming}
          className={`mb-3 h-10 px-4 rounded-full text-sm font-medium border flex items-center gap-2 ${s.onlyUpcoming ? 'bg-go-soft border-go/60 text-go' : 'bg-ink-800 border-ink-600 text-slate-300'}`}
        >
          <span
            className={`h-4 w-4 rounded grid place-items-center border ${s.onlyUpcoming ? 'bg-go border-go text-ink-950' : 'border-slate-500'}`}
          >
            {s.onlyUpcoming && <Check size={12} strokeWidth={3} />}
          </span>
          Mostrar apenas próximos horários de hoje
        </button>
      )}

      {s.replacement ? (
        <div className="rounded-xl bg-warn-soft border border-warn/50 p-4 space-y-3">
          <div className="text-sm text-slate-100">{s.replacement.text}</div>
          <div className="flex gap-2">
            {s.replacement.related.map((c) => (
              <button
                key={c}
                onClick={() => onOpenLine(c)}
                className="h-10 px-4 rounded-full bg-ink-800 border border-ink-600 num text-lg active:bg-ink-700"
              >
                Linha {c}
              </button>
            ))}
          </div>
        </div>
      ) : s.viewLoading ? (
        <div className="text-slate-400 text-sm py-6 text-center">Carregando tabela…</div>
      ) : !s.viewTable ? (
        <div className="rounded-xl bg-halt-soft border border-halt/40 text-sm p-3">
          {s.viewRes && s.viewRes !== 'loading' ? s.viewRes.error : null}
        </div>
      ) : (
        <TimetableGrid
          table={s.viewTable}
          fromCache={s.viewRes !== 'loading' && !!s.viewRes?.fromCache}
          origin={s.origin}
          setOrigin={s.setOrigin}
          isToday={s.day === s.today}
          onlyUpcoming={s.onlyUpcoming}
          onShowAll={s.showAllToday}
          onOpenOriginal={onOpenOriginal}
        />
      )}
    </section>
  );
}
