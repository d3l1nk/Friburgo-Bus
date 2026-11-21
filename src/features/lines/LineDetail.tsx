import { useState } from 'react';
import { ArrowLeft, Bell, Download, Info, Star } from 'lucide-react';
import OriginalTableSheet from '../../components/ui/OriginalTableSheet';
import { AlertBanner, Header, IconBtn } from '../../components/ui/ui';
import { CIRCULAR_MAIN, CIRCULAR_NOTE, REGION_LABEL } from '../../data/faolLines';
import { faolTableUrl } from '../../services/faol';
import type { FaolAlert, FaolLine, MerusVehicle } from '../../types';
import LiveCard from './components/LiveCard';
import NextCards from './components/NextCards';
import ScheduleSection from './components/ScheduleSection';
import { useLineSchedule } from './hooks/useLineSchedule';

interface Props {
  line: FaolLine;
  alerts: FaolAlert[];
  vehicles: MerusVehicle[];
  isFav: boolean;
  onToggleFav: () => void;
  onBack: () => void;
  onShowOnMap: () => void;
  onCacheChanged: () => void;
  onOpenLine: (code: string) => void;
  onCreateAlert: (code: string) => void;
}

export default function LineDetail(p: Props) {
  const schedule = useLineSchedule(p.line.code, p.onCacheChanged);
  const [showOriginal, setShowOriginal] = useState(false);

  return (
    <div className="flex flex-col h-full">
      <Header
        title={`Linha ${p.line.code}`}
        sub={`${p.line.name} · ${REGION_LABEL[p.line.region]}`}
        right={
          <>
            <IconBtn onClick={p.onToggleFav} label="Favoritar linha">
              <Star size={20} className={p.isFav ? 'fill-warn text-warn' : ''} />
            </IconBtn>
            <IconBtn onClick={p.onBack} label="Voltar">
              <ArrowLeft size={20} />
            </IconBtn>
          </>
        }
      />
      <div className="scroll-y flex-1 px-4 py-4 space-y-4">
        {p.alerts.map((a, i) => (
          <AlertBanner key={i} alert={a} />
        ))}
        {CIRCULAR_MAIN.has(p.line.code) && (
          <div className="flex gap-3 rounded-xl px-3 py-2.5 border border-route/40 bg-route-soft/60 text-sm">
            <Info size={18} className="shrink-0 mt-0.5 text-route" />
            <span className="text-slate-200">{CIRCULAR_NOTE}</span>
          </div>
        )}

        <LiveCard vehicles={p.vehicles} onShowOnMap={p.onShowOnMap} />

        <button
          onClick={() => p.onCreateAlert(p.line.code)}
          className="w-full h-12 rounded-xl border border-route/50 bg-route-soft/40 text-route font-semibold flex items-center justify-center gap-2 active:bg-route-soft"
        >
          <Bell size={18} /> Avisar-me sobre esta linha
        </button>

        <NextCards
          table={schedule.todayTable}
          loading={schedule.todayLoading}
          replacementText={schedule.todayReplacement?.text}
        />

        <ScheduleSection
          schedule={schedule}
          onOpenOriginal={() => setShowOriginal(true)}
          onOpenLine={p.onOpenLine}
        />

        <button
          onClick={() => void schedule.download()}
          disabled={schedule.downloading}
          className="w-full h-12 rounded-xl border border-ink-600 bg-ink-800 flex items-center justify-center gap-2 font-medium active:bg-ink-700 disabled:opacity-60"
        >
          <Download size={18} />{' '}
          {schedule.downloading ? 'Baixando…' : 'Baixar todas as tabelas para uso offline'}
        </button>
        {schedule.downloadMsg && (
          <div className="text-sm text-slate-300 text-center">{schedule.downloadMsg}</div>
        )}
      </div>

      {showOriginal && (
        <OriginalTableSheet
          lineCode={p.line.code}
          lineName={p.line.name}
          dayLabelKey={schedule.day}
          table={schedule.viewTable}
          siteUrl={schedule.viewTable?.sourceUrl ?? faolTableUrl(p.line.code, schedule.day)}
          onClose={() => setShowOriginal(false)}
        />
      )}
    </div>
  );
}
