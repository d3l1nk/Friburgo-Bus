import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Bus, Download, MapPinned, RefreshCw, Star, WifiOff } from 'lucide-react';
import { AlertBanner, Header, IconBtn, LineBadge } from './ui';
import { DAY_LABEL, dayTypeOf, formatCountdown, minutesOfDay, useNow } from '../lib/time';
import { REGION_LABEL } from '../data/faolLines';
import { daysForLine, downloadAllDays, getTimetable, nextByColumn } from '../services/faolScraper';
import type { DayCode, FaolAlert, FaolLine, MerusVehicle, Timetable, TimetableResult } from '../types';

interface Props {
  line: FaolLine;
  alerts: FaolAlert[];
  vehicles: MerusVehicle[];
  isFav: boolean;
  onToggleFav: () => void;
  onBack: () => void;
  onShowOnMap: () => void;
  onCacheChanged: () => void;
}

const RAMAL_COLORS = ['#3b9cff', '#2dd4a0', '#fbbf24', '#f472b6', '#a78bfa', '#fb923c'];
const ramalColor = (r?: string) => (r ? RAMAL_COLORS[(r.charCodeAt(0) - 65 + RAMAL_COLORS.length * 4) % RAMAL_COLORS.length] : undefined);

type Loaded = Record<string, TimetableResult | 'loading'>;

export default function LineDetail(p: Props) {
  const today = dayTypeOf();
  const days = daysForLine(p.line.code);
  const [day, setDay] = useState<DayCode>(today);
  const [tables, setTables] = useState<Loaded>({});
  const [origin, setOrigin] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [dlMsg, setDlMsg] = useState<string | null>(null);

  const load = useCallback(
    async (d: DayCode, force = false) => {
      setTables((t) => ({ ...t, [d]: 'loading' }));
      const r = await getTimetable(p.line.code, d, force);
      setTables((t) => ({ ...t, [d]: r }));
      p.onCacheChanged();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [p.line.code],
  );

  useEffect(() => {
    if (!tables[today]) void load(today);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today]);
  useEffect(() => {
    if (!tables[day]) void load(day);
    setOrigin(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day]);

  const todayRes = tables[today];
  const viewRes = tables[day];
  const todayTable = todayRes && todayRes !== 'loading' ? todayRes.table : null;
  const viewTable = viewRes && viewRes !== 'loading' ? viewRes.table : null;

  const download = async () => {
    setDownloading(true);
    setDlMsg(null);
    const r = await downloadAllDays(p.line.code);
    setDlMsg(`${r.ok} de ${r.total} tabelas baixadas para uso offline.`);
    for (const d of days) await load(d);
    setDownloading(false);
  };

  return (
    <div className="flex flex-col h-full">
      <Header
        title={`Linha ${p.line.code}`}
        sub={`${p.line.name} · ${REGION_LABEL[p.line.region]}`}
        right={
          <>
            <IconBtn onClick={p.onToggleFav} label="Favoritar linha"><Star size={20} className={p.isFav ? 'fill-warn text-warn' : ''} /></IconBtn>
            <IconBtn onClick={p.onBack} label="Voltar"><ArrowLeft size={20} /></IconBtn>
          </>
        }
      />
      <div className="scroll-y flex-1 px-4 py-4 space-y-4">
        {p.alerts.map((a, i) => <AlertBanner key={i} alert={a} />)}

        {/* Tempo real */}
        <section className="rounded-2xl bg-ink-800 border border-ink-600 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bus className={p.vehicles.length ? 'text-go' : 'text-slate-500'} size={24} />
              <div>
                <div className="num text-3xl leading-none font-semibold">{p.vehicles.length}</div>
                <div className="text-xs text-slate-400 mt-1">{p.vehicles.length === 1 ? 'ônibus rodando agora' : 'ônibus rodando agora'}</div>
              </div>
            </div>
            <button
              onClick={p.onShowOnMap}
              disabled={!p.vehicles.length}
              className="flex items-center gap-2 h-11 px-4 rounded-full bg-go text-ink-950 font-semibold disabled:bg-ink-700 disabled:text-slate-500"
            >
              <MapPinned size={18} /> Ver no mapa
            </button>
          </div>
          {p.vehicles.length === 0 && <div className="text-sm text-slate-400 mt-3">Nenhum ônibus desta linha com GPS ativo neste momento.</div>}
          {p.vehicles.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {p.vehicles.slice(0, 8).map((v) => (
                <span key={v.id} className="text-xs bg-ink-700 rounded-md px-2 py-1 text-slate-300">
                  {v.id}{v.direction ? ` · ${v.direction}` : ''}
                </span>
              ))}
            </div>
          )}
        </section>

        {/* Próxima saída */}
        <NextDeparture table={todayTable} loading={todayRes === 'loading' || !todayRes} today={today} />

        {/* Grade */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-sign text-xl font-semibold">Grade de horários</h2>
            <button onClick={() => load(day, true)} className="h-9 w-9 grid place-items-center rounded-full text-slate-300 active:bg-ink-700" aria-label="Atualizar tabela">
              <RefreshCw size={16} className={viewRes === 'loading' ? 'animate-spin' : ''} />
            </button>
          </div>
          <div className="flex gap-2 mb-3 overflow-x-auto scroll-y">
            {days.map((d) => (
              <button
                key={d}
                onClick={() => setDay(d)}
                className={`shrink-0 h-10 px-4 rounded-full text-sm font-medium border ${day === d ? 'bg-route text-ink-950 border-route' : 'bg-ink-800 border-ink-600 text-slate-300'}`}
              >
                {DAY_LABEL[d]}{d === today ? ' · hoje' : ''}
              </button>
            ))}
          </div>

          {viewRes === 'loading' || !viewRes ? (
            <div className="text-slate-400 text-sm py-6 text-center">Carregando tabela…</div>
          ) : !viewTable ? (
            <div className="rounded-xl bg-halt-soft border border-halt/40 text-sm p-3">{viewRes.error}</div>
          ) : (
            <Grid table={viewTable} fromCache={viewRes.fromCache} origin={origin} setOrigin={setOrigin} isToday={day === today} />
          )}
        </section>

        <button
          onClick={download}
          disabled={downloading}
          className="w-full h-12 rounded-xl border border-ink-600 bg-ink-800 flex items-center justify-center gap-2 font-medium active:bg-ink-700 disabled:opacity-60"
        >
          <Download size={18} /> {downloading ? 'Baixando…' : 'Baixar todas as tabelas para uso offline'}
        </button>
        {dlMsg && <div className="text-sm text-slate-300 text-center">{dlMsg}</div>}
      </div>
    </div>
  );
}

function NextDeparture({ table, loading, today }: { table: Timetable | null; loading: boolean; today: DayCode }) {
  const now = useNow(1000);
  const rows = useMemo(() => (table ? nextByColumn(table, minutesOfDay(now)) : []), [table, now]);
  const terminal = rows.filter((r) => r.isTerminal);
  const bairros = rows.filter((r) => !r.isTerminal);

  return (
    <section className="rounded-2xl bg-ink-800 border border-ink-600 p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="font-sign text-xl font-semibold">Próxima saída</h2>
        <span className="text-xs text-slate-400">{DAY_LABEL[today]}</span>
      </div>
      {loading && <div className="text-sm text-slate-400">Carregando…</div>}
      {!loading && !table && <div className="text-sm text-slate-400">Tabela de hoje indisponível.</div>}
      {table && !rows.some((r) => r.next) && <div className="text-sm text-slate-300">Não há mais saídas hoje.</div>}
      {table && rows.some((r) => r.next) && (
        <div className="grid grid-cols-1 gap-3">
          {[...terminal, ...bairros].map((r) => (
            <div key={r.origin} className="flex items-center justify-between rounded-xl bg-ink-950 px-4 py-3">
              <div className="min-w-0">
                <div className="text-xs text-slate-400">Saindo de</div>
                <div className="font-medium truncate">{r.origin}</div>
                {r.next && (
                  <div className="text-sm text-slate-400 mt-0.5">
                    às <span className="num text-slate-200">{r.next.time}</span>
                    {r.after && <> · depois <span className="num">{r.after.time}</span></>}
                  </div>
                )}
              </div>
              <div className={`num text-4xl font-semibold ${r.minutesLeft !== undefined && r.minutesLeft <= 5 ? 'text-go' : 'text-warn'}`}>
                {r.minutesLeft !== undefined ? formatCountdown(r.minutesLeft) : '—'}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Grid({ table, fromCache, origin, setOrigin, isToday }: { table: Timetable; fromCache: boolean; origin: string | null; setOrigin: (o: string) => void; isToday: boolean }) {
  const now = useNow(30000);
  const nowMin = minutesOfDay(now);
  const col = table.columns.find((c) => c.origin === origin) ?? table.columns[0];

  if (!col) {
    return (
      <div className="rounded-xl bg-warn-soft border border-warn/40 p-3 text-sm space-y-2">
        <div className="font-medium text-warn">Não consegui ler esta tabela automaticamente.</div>
        <div className="text-slate-300">O layout da página pode ter mudado. Veja o conteúdo bruto na aba Diagnóstico.</div>
        {table.rawText && <pre className="text-xs whitespace-pre-wrap max-h-48 overflow-auto text-slate-400">{table.rawText}</pre>}
      </div>
    );
  }

  const nextMin = isToday ? col.departures.find((d) => d.minutes >= nowMin)?.minutes : undefined;
  const byHour = new Map<number, typeof col.departures>();
  col.departures.forEach((d) => {
    const h = Math.floor(d.minutes / 60);
    byHour.set(h, [...(byHour.get(h) ?? []), d]);
  });
  const usedRamais = [...new Set(col.departures.map((d) => d.ramal).filter(Boolean))] as string[];

  return (
    <div>
      {fromCache && (
        <div className="flex items-center gap-2 text-xs text-warn mb-2">
          <WifiOff size={13} /> Cópia offline de {new Date(table.fetchedAt).toLocaleDateString('pt-BR')}
        </div>
      )}
      {table.columns.length > 1 && (
        <div className="flex gap-2 mb-3 overflow-x-auto scroll-y">
          {table.columns.map((c) => (
            <button
              key={c.origin}
              onClick={() => setOrigin(c.origin)}
              className={`shrink-0 h-9 px-3 rounded-lg text-sm border ${c.origin === col.origin ? 'bg-ink-600 border-route text-white' : 'bg-ink-800 border-ink-600 text-slate-300'}`}
            >
              {c.isTerminal ? '' : 'Saindo de '}{c.origin}
            </button>
          ))}
        </div>
      )}
      <div className="rounded-xl border border-ink-700 overflow-hidden">
        {[...byHour.entries()].map(([h, deps]) => (
          <div key={h} className="flex items-start gap-3 px-3 py-2 border-b border-ink-800 last:border-0">
            <div className="num text-xl text-slate-400 w-9 pt-0.5">{String(h).padStart(2, '0')}</div>
            <div className="flex flex-wrap gap-2 flex-1">
              {deps.map((d) => {
                const past = isToday && d.minutes < nowMin;
                const next = d.minutes === nextMin;
                return (
                  <span
                    key={d.time + (d.ramal ?? '')}
                    className={`num text-lg px-2 rounded-md min-w-[40px] text-center ${next ? 'bg-go text-ink-950 font-bold' : past ? 'text-slate-600' : 'bg-ink-700 text-slate-100'}`}
                  >
                    {d.time.slice(3)}
                    {d.ramal && <sup className="ml-0.5 text-[11px] font-bold" style={{ color: next ? '#04261c' : ramalColor(d.ramal) }}>{d.ramal}</sup>}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {(table.legend.length > 0 || usedRamais.length > 0) && (
        <div className="mt-3 text-sm space-y-1">
          <div className="text-xs text-slate-400">Ramais</div>
          {table.legend.map((l) => (
            <div key={l.code} className="text-slate-300">
              <span className="num font-semibold text-route">{l.code}</span> {l.label}
            </div>
          ))}
        </div>
      )}
      <div className="mt-2"><LineBadgeHidden code={table.code} /></div>
    </div>
  );
}

// mantém o import do LineBadge usado de forma discreta (mostra o código da tabela no rodapé)
function LineBadgeHidden({ code }: { code: string }) {
  return <div className="flex items-center gap-2 text-xs text-slate-500"><LineBadge code={code} size="sm" /> fonte: faol.com.br</div>;
}
