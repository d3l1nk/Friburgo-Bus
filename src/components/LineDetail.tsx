import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Bus, Check, Download, ExternalLink, Info, MapPinned, RefreshCw, Star, WifiOff } from 'lucide-react';
import { AlertBanner, Header, IconBtn } from './ui';
import { DAY_LABEL, dayTypeOf, etaParts, minutesOfDay, useNow } from '../lib/time';
import { openExternal } from '../lib/openUrl';
import { CIRCULAR_MAIN, CIRCULAR_NOTE, REGION_LABEL, dayReplacement } from '../data/faolLines';
import { daysForLine, downloadAllDays, faolTableUrl, getTableUrl, getTimetable, nextByColumn, type NextByColumn } from '../services/faolScraper';
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
  onOpenLine: (code: string) => void;
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
  const [onlyUpcoming, setOnlyUpcoming] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [dlMsg, setDlMsg] = useState<string | null>(null);

  const load = useCallback(
    async (d: DayCode, force = false) => {
      if (dayReplacement(p.line.code, d)) return; // sem tabela própria
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
  const replacement = dayReplacement(p.line.code, day);
  const todayReplacement = dayReplacement(p.line.code, today);

  const openOriginal = async () => {
    const url = viewTable?.sourceUrl ?? (await getTableUrl(p.line.code, day).catch(() => faolTableUrl(p.line.code, day)));
    void openExternal(url);
  };

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
        {CIRCULAR_MAIN.has(p.line.code) && (
          <div className="flex gap-3 rounded-xl px-3 py-2.5 border border-route/40 bg-route-soft/60 text-sm">
            <Info size={18} className="shrink-0 mt-0.5 text-route" />
            <span className="text-slate-200">{CIRCULAR_NOTE}</span>
          </div>
        )}

        <LiveCard vehicles={p.vehicles} onShowOnMap={p.onShowOnMap} />

        <NextCards table={todayTable} loading={!todayRes || todayRes === 'loading'} replacementText={todayReplacement?.text} />

        <section>
          <div className="flex items-center justify-between mb-2 gap-2">
            <h2 className="font-sign text-xl font-semibold">Grade de horários</h2>
            <div className="flex items-center gap-1">
              <button onClick={openOriginal} className="h-9 px-3 rounded-full bg-ink-800 border border-ink-600 text-sm flex items-center gap-1.5 active:bg-ink-700">
                <ExternalLink size={14} /> Ver tabela original
              </button>
              <button onClick={() => load(day, true)} className="h-9 w-9 grid place-items-center rounded-full text-slate-300 active:bg-ink-700" aria-label="Atualizar tabela">
                <RefreshCw size={16} className={viewRes === 'loading' ? 'animate-spin' : ''} />
              </button>
            </div>
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

          {day === today && !replacement && (
            <button
              onClick={() => setOnlyUpcoming((v) => !v)}
              className={`mb-3 h-10 px-4 rounded-full text-sm font-medium border flex items-center gap-2 ${onlyUpcoming ? 'bg-go-soft border-go/60 text-go' : 'bg-ink-800 border-ink-600 text-slate-300'}`}
            >
              <span className={`h-4 w-4 rounded grid place-items-center border ${onlyUpcoming ? 'bg-go border-go text-ink-950' : 'border-slate-500'}`}>
                {onlyUpcoming && <Check size={12} strokeWidth={3} />}
              </span>
              Mostrar apenas próximos horários de hoje
            </button>
          )}

          {replacement ? (
            <div className="rounded-xl bg-warn-soft border border-warn/50 p-4 space-y-3">
              <div className="text-sm text-slate-100">{replacement.text}</div>
              <div className="flex gap-2">
                {replacement.related.map((c) => (
                  <button key={c} onClick={() => p.onOpenLine(c)} className="h-10 px-4 rounded-full bg-ink-800 border border-ink-600 num text-lg active:bg-ink-700">
                    Linha {c}
                  </button>
                ))}
              </div>
            </div>
          ) : viewRes === 'loading' || !viewRes ? (
            <div className="text-slate-400 text-sm py-6 text-center">Carregando tabela…</div>
          ) : !viewTable ? (
            <div className="rounded-xl bg-halt-soft border border-halt/40 text-sm p-3">{viewRes.error}</div>
          ) : (
            <Grid
              table={viewTable}
              fromCache={viewRes.fromCache}
              origin={origin}
              setOrigin={setOrigin}
              isToday={day === today}
              onlyUpcoming={onlyUpcoming}
              onShowAll={() => setOnlyUpcoming(false)}
              onOpenOriginal={openOriginal}
            />
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

const LiveCard = memo(function LiveCard({ vehicles, onShowOnMap }: { vehicles: MerusVehicle[]; onShowOnMap: () => void }) {
  const on = vehicles.length > 0;
  return (
    <section className={`rounded-2xl border p-4 ${on ? 'bg-go-soft/50 border-go/40' : 'bg-ink-800 border-ink-600'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bus className={on ? 'text-go' : 'text-slate-500'} size={26} />
          <div>
            <div className="num text-3xl leading-none font-semibold">{vehicles.length}</div>
            <div className="text-xs text-slate-400 mt-1">{on ? 'ônibus rodando agora (GPS)' : 'nenhum ônibus com GPS agora'}</div>
          </div>
        </div>
        <button
          onClick={onShowOnMap}
          disabled={!on}
          className="flex items-center gap-2 h-11 px-4 rounded-full bg-go text-ink-950 font-semibold disabled:bg-ink-700 disabled:text-slate-500"
        >
          <MapPinned size={18} /> Ver no mapa
        </button>
      </div>
      {on && (
        <div className="mt-3 flex flex-wrap gap-2">
          {vehicles.slice(0, 8).map((v, i) => (
            <span key={`${v.id}-${i}`} className="text-xs bg-ink-900/70 rounded-md px-2 py-1 text-slate-300">
              {v.id}{v.direction ? ` · ${v.direction}` : ''}
            </span>
          ))}
        </div>
      )}
    </section>
  );
});

function DepartureCard({ tag, row, tone }: { tag: string; row: NextByColumn; tone: 'route' | 'go' }) {
  const eta = row.minutesLeft !== undefined ? etaParts(row.minutesLeft) : null;
  const soon = row.minutesLeft !== undefined && row.minutesLeft <= 5;
  return (
    <div className={`rounded-2xl p-3 border ${tone === 'route' ? 'bg-route-soft/50 border-route/40' : 'bg-go-soft/40 border-go/40'}`}>
      <div className={`text-[10px] font-semibold uppercase tracking-wider ${tone === 'route' ? 'text-route' : 'text-go'}`}>{tag}</div>
      <div className="text-sm font-medium truncate mt-0.5">{row.origin}</div>
      <div className="mt-2 flex items-baseline gap-1">
        {eta ? (
          <>
            <span className={`num font-bold leading-none ${eta.big.length > 4 ? 'text-4xl' : 'text-6xl'} ${soon ? 'text-go' : 'text-slate-50'}`}>{eta.big}</span>
            <span className="text-base text-slate-300">{eta.unit}</span>
          </>
        ) : (
          <span className="num text-4xl text-slate-500">—</span>
        )}
      </div>
      <div className="text-xs text-slate-400 mt-2 num">
        {row.next ? <>às <b className="text-slate-100 text-base font-semibold">{row.next.time}</b>{row.after && <> · depois {row.after.time}</>}</> : 'sem mais saídas hoje'}
      </div>
    </div>
  );
}

/** Cartões lado a lado: Estação Livre x Bairro. Atualiza a cada 10 s, só este bloco re-renderiza. */
function NextCards({ table, loading, replacementText }: { table: Timetable | null; loading: boolean; replacementText?: string }) {
  const now = useNow(10000);
  const rows = useMemo(() => (table ? nextByColumn(table, minutesOfDay(now)) : []), [table, now]);
  const terminal = rows.find((r) => r.isTerminal);
  const bairros = rows.filter((r) => !r.isTerminal).sort((a, b) => (a.minutesLeft ?? 9999) - (b.minutesLeft ?? 9999));

  let cards: { tag: string; row: NextByColumn; tone: 'route' | 'go' }[] = [];
  if (terminal) cards.push({ tag: 'Saindo da Estação Livre', row: terminal, tone: 'route' });
  if (bairros[0]) cards.push({ tag: 'Saindo do bairro', row: bairros[0], tone: 'go' });
  if (cards.length === 1 && bairros[1]) cards.push({ tag: 'Saindo do bairro', row: bairros[1], tone: 'go' });
  if (!terminal && cards.length === 1) cards = [{ ...cards[0], tag: 'Próxima saída' }];

  return (
    <section>
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="font-sign text-xl font-semibold">Próxima saída</h2>
        <span className="text-xs text-slate-400">hoje · {DAY_LABEL[dayTypeOf()]}</span>
      </div>
      {replacementText && <div className="rounded-xl bg-warn-soft border border-warn/50 p-3 text-sm">{replacementText}</div>}
      {!replacementText && loading && <div className="rounded-xl bg-ink-800 border border-ink-600 p-4 text-sm text-slate-400">Carregando…</div>}
      {!replacementText && !loading && !table && <div className="rounded-xl bg-ink-800 border border-ink-600 p-4 text-sm text-slate-400">Tabela de hoje indisponível.</div>}
      {!replacementText && table && cards.length > 0 && (
        <>
          <div className={`grid gap-3 ${cards.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {cards.map((c) => <DepartureCard key={c.row.origin} {...c} />)}
          </div>
          {bairros.filter((b) => !cards.some((c) => c.row === b) && b.next).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-300">
              {bairros.filter((b) => !cards.some((c) => c.row === b) && b.next).map((b) => (
                <span key={b.origin} className="bg-ink-800 border border-ink-600 rounded-md px-2 py-1">
                  {b.origin} · <span className="num text-sm text-slate-100">{b.next!.time}</span>
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Grid(props: {
  table: Timetable;
  fromCache: boolean;
  origin: string | null;
  setOrigin: (o: string) => void;
  isToday: boolean;
  onlyUpcoming: boolean;
  onShowAll: () => void;
  onOpenOriginal: () => void;
}) {
  const { table, isToday } = props;
  const now = useNow(30000);
  const nowMin = minutesOfDay(now);
  const col = table.columns.find((c) => c.origin === props.origin) ?? table.columns[0];

  if (!col) {
    return (
      <div className="rounded-xl bg-warn-soft border border-warn/40 p-3 text-sm space-y-2">
        <div className="font-medium text-warn">Não consegui ler esta tabela automaticamente.</div>
        <div className="text-slate-300">O layout da página pode ter mudado. Abra a tabela original ou veja o conteúdo bruto na aba Diagnóstico.</div>
        <button onClick={props.onOpenOriginal} className="h-10 px-4 rounded-full bg-ink-800 border border-ink-600 flex items-center gap-2"><ExternalLink size={15} /> Ver tabela original</button>
        {table.rawText && <pre className="text-xs whitespace-pre-wrap max-h-48 overflow-auto text-slate-400">{table.rawText}</pre>}
      </div>
    );
  }

  const filtering = isToday && props.onlyUpcoming;
  const visible = filtering ? col.departures.filter((d) => d.minutes >= nowMin - 1) : col.departures;
  const nextMin = isToday ? col.departures.find((d) => d.minutes >= nowMin)?.minutes : undefined;
  const currentHour = Math.floor(nowMin / 60);
  const byHour = new Map<number, typeof visible>();
  visible.forEach((d) => {
    const h = Math.floor(d.minutes / 60);
    byHour.set(h, [...(byHour.get(h) ?? []), d]);
  });

  return (
    <div>
      {props.fromCache && (
        <div className="flex items-center gap-2 text-xs text-warn mb-2">
          <WifiOff size={13} /> Cópia offline de {new Date(table.fetchedAt).toLocaleDateString('pt-BR')}
        </div>
      )}
      {table.columns.length > 1 && (
        <div className="flex gap-2 mb-3 overflow-x-auto scroll-y">
          {table.columns.map((c) => (
            <button
              key={c.origin}
              onClick={() => props.setOrigin(c.origin)}
              className={`shrink-0 h-9 px-3 rounded-lg text-sm border ${c.origin === col.origin ? 'bg-ink-600 border-route text-white' : 'bg-ink-800 border-ink-600 text-slate-300'}`}
            >
              {c.isTerminal ? '' : 'Saindo de '}{c.origin}
            </button>
          ))}
        </div>
      )}

      {visible.length === 0 ? (
        <div className="rounded-xl bg-ink-800 border border-ink-600 p-4 text-sm text-slate-300 space-y-2">
          <div>Não há mais saídas hoje nesta origem.</div>
          <button onClick={props.onShowAll} className="h-9 px-3 rounded-full bg-ink-700 text-sm">Mostrar o dia todo</button>
        </div>
      ) : (
        <div className="rounded-2xl border border-ink-700 overflow-hidden">
          {[...byHour.entries()].map(([h, deps]) => (
            <div
              key={h}
              className={`flex items-start gap-3 px-3 py-2.5 border-b border-ink-800 last:border-0 ${isToday && h === currentHour ? 'bg-ink-800/70' : ''}`}
            >
              <div className={`num text-2xl w-10 leading-9 ${isToday && h === currentHour ? 'text-route' : 'text-slate-500'}`}>{String(h).padStart(2, '0')}</div>
              <div className="flex flex-wrap gap-2 flex-1">
                {deps.map((d) => {
                  const past = isToday && d.minutes < nowMin;
                  const next = d.minutes === nextMin;
                  return (
                    <span
                      key={d.time + (d.ramal ?? '')}
                      className={`num text-xl h-9 px-2.5 rounded-lg grid place-items-center min-w-[46px] ${
                        next ? 'bg-go text-ink-950 font-bold ring-2 ring-go/40' : past ? 'text-slate-600' : 'bg-ink-700 text-slate-50'
                      }`}
                    >
                      <span>
                        {d.time.slice(3)}
                        {d.ramal && (
                          <sup className="ml-0.5 text-[11px] font-bold" style={{ color: next ? '#04261c' : ramalColor(d.ramal) }}>{d.ramal}</sup>
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
            <div key={l.code} className="text-slate-300"><span className="num font-semibold text-route">{l.code}</span> {l.label}</div>
          ))}
        </div>
      )}
    </div>
  );
}
