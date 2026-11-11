import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Bus,
  Clock,
  Download,
  ExternalLink,
  MapPinned,
  RefreshCw,
  Star,
} from 'lucide-react';
import { AlertBanner, Header, IconBtn, LineBadge } from './ui';
import { DAY_LABEL, dayTypeOf, formatCountdown, minutesOfDay, useNow } from '../lib/time';
import { REGION_LABEL } from '../data/faolLines';
import {
  daysForLine,
  downloadAllDays,
  faolTableUrl,
  getTimetable,
  nextByColumn,
} from '../services/faolScraper';
import type {
  DayCode,
  FaolAlert,
  FaolLine,
  MerusVehicle,
  Timetable,
  TimetableResult,
} from '../types';

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
const ramalColor = (r?: string) =>
  r ? RAMAL_COLORS[(r.charCodeAt(0) - 65 + RAMAL_COLORS.length * 4) % RAMAL_COLORS.length] : undefined;

type Loaded = Partial<Record<DayCode, TimetableResult | 'loading'>>;

export default function LineDetail(p: Props) {
  const today = dayTypeOf();
  const days = daysForLine(p.line.code);
  const [day, setDay] = useState<DayCode>(days.includes(today) ? today : days[0]);
  const [tables, setTables] = useState<Loaded>({});
  const [origin, setOrigin] = useState<string | null>(null);
  const [onlyUpcoming, setOnlyUpcoming] = useState(false);
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
    setDlMsg(`${r.ok} de ${r.total} tabelas salvas no aparelho para uso offline.`);
    for (const d of days) await load(d);
    setDownloading(false);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-ink-950">
      <Header
        title={`${p.line.code} · ${p.line.name}`}
        sub={`Região ${REGION_LABEL[p.line.region]}`}
        right={
          <div className="flex items-center gap-1.5">
            <IconBtn onClick={p.onBack} label="Voltar">
              <ArrowLeft className="w-5 h-5" />
            </IconBtn>
            <IconBtn onClick={p.onToggleFav} label="Favoritar linha" active={p.isFav}>
              <Star className={`w-5 h-5 ${p.isFav ? 'fill-warn text-warn' : ''}`} />
            </IconBtn>
          </div>
        }
      />

      <div className="flex-1 scroll-y px-3 py-3 space-y-3.5">
        {p.alerts.map((a, i) => (
          <AlertBanner key={i} alert={a} />
        ))}

        {/* Card de Rastreamento em Tempo Real (Merus) */}
        <div className="bg-ink-900 border border-ink-700 rounded-2xl p-3.5 space-y-2.5 shadow-md">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div
                className={`h-9 w-9 rounded-xl grid place-items-center ${
                  p.vehicles.length > 0 ? 'bg-go-soft text-go' : 'bg-ink-800 text-slate-400'
                }`}
              >
                <Bus className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">
                  {p.vehicles.length}{' '}
                  {p.vehicles.length === 1 ? 'ônibus no GPS agora' : 'ônibus no GPS agora'}
                </div>
                <div className="text-xs text-slate-400">
                  {p.vehicles.length > 0
                    ? 'Rastreamento ao vivo Merus Tracker'
                    : 'Sem sinal de GPS ativo nesta linha agora'}
                </div>
              </div>
            </div>

            {p.vehicles.length > 0 && (
              <button
                onClick={p.onShowOnMap}
                className="h-9 px-3.5 rounded-xl bg-go text-ink-950 text-xs font-bold flex items-center gap-1.5 shadow active:scale-95 transition"
              >
                <MapPinned className="w-4 h-4" />
                Ver no Mapa
              </button>
            )}
          </div>

          {p.vehicles.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {p.vehicles.slice(0, 8).map((v) => (
                <span
                  key={v.id}
                  className="text-xs bg-ink-800 border border-ink-600 text-slate-200 px-2.5 py-1 rounded-lg"
                >
                  Carro <b>{v.id}</b>
                  {v.direction ? ` · ${v.direction}` : ''}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Painel Inteligente de Próximas Saídas (Estação Livre vs Bairro) */}
        <NextDeparture
          table={todayTable}
          loading={todayRes === 'loading' || !todayRes}
          today={today}
        />

        {/* Seletor de Grade de Horários */}
        <div className="bg-ink-900 border border-ink-700 rounded-2xl p-3.5 space-y-3 shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-route" />
              <h3 className="font-semibold text-sm text-white">Grade Programada (FAOL)</h3>
            </div>
            <div className="flex items-center gap-1">
              <a
                href={faolTableUrl(p.line.code, day)}
                target="_blank"
                rel="noreferrer"
                className="h-8 px-2.5 rounded-lg bg-ink-800 border border-ink-600 text-xs text-slate-300 flex items-center gap-1"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Original
              </a>
              <button
                onClick={() => load(day, true)}
                className="h-8 w-8 grid place-items-center rounded-lg bg-ink-800 border border-ink-600 text-slate-300 active:bg-ink-700"
                aria-label="Atualizar tabela"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Abas de Dia da Semana */}
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {days.map((d) => (
              <button
                key={d}
                onClick={() => setDay(d)}
                className={`shrink-0 h-9 px-3.5 rounded-xl text-xs font-semibold border transition ${
                  day === d
                    ? 'bg-route text-ink-950 border-route shadow'
                    : 'bg-ink-800 border-ink-600 text-slate-300'
                }`}
              >
                {DAY_LABEL[d]}
                {d === today ? ' (Hoje)' : ''}
              </button>
            ))}
          </div>

          {viewRes === 'loading' || !viewRes ? (
            <div className="py-8 text-center text-sm text-slate-400 animate-pulse">
              Consultando horários da linha {p.line.code}…
            </div>
          ) : !viewTable ? (
            <div className="p-3.5 rounded-xl bg-warn-soft/60 border border-warn/40 text-xs text-amber-200 space-y-2">
              <div>{viewRes.error}</div>
            </div>
          ) : (
            <Grid
              table={viewTable}
              fromCache={viewRes.fromCache}
              origin={origin}
              setOrigin={setOrigin}
              isToday={day === today}
              onlyUpcoming={onlyUpcoming}
              setOnlyUpcoming={setOnlyUpcoming}
            />
          )}
        </div>

        {/* Botão Offline */}
        <button
          onClick={download}
          disabled={downloading}
          className="w-full h-11 rounded-2xl bg-ink-800 border border-ink-600 text-sm font-semibold text-slate-200 flex items-center justify-center gap-2 active:bg-ink-700 disabled:opacity-50"
        >
          <Download className="w-4 h-4 text-route" />
          {downloading ? 'Salvando tabelas…' : 'Salvar todas as tabelas para uso Offline'}
        </button>
        {dlMsg && <div className="text-xs text-center text-go">{dlMsg}</div>}

        <LineBadge code={p.line.code} size="sm" />
      </div>
    </div>
  );
}

function NextDeparture({
  table,
  loading,
  today,
}: {
  table: Timetable | null;
  loading: boolean;
  today: DayCode;
}) {
  const now = useNow(5000);
  const rows = useMemo(() => (table ? nextByColumn(table, minutesOfDay(now)) : []), [table, now]);

  return (
    <div className="bg-ink-900 border border-ink-700 rounded-2xl p-3.5 space-y-2.5 shadow-md">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-route">
          Próximas Saídas · {DAY_LABEL[today]}
        </span>
      </div>

      {loading && <div className="text-xs text-slate-400 py-2">Calculando próximas partidas…</div>}
      {!loading && !table && (
        <div className="text-xs text-slate-400 py-1">
          Selecione Dias Úteis ou Sábado abaixo para consultar a grade.
        </div>
      )}

      {table && rows.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {rows.map((r) => (
            <div
              key={r.origin}
              className="bg-ink-950/90 border border-ink-800 rounded-xl p-3 flex items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-wide text-slate-400 truncate">
                  Saída: <b className="text-slate-200">{r.origin}</b>
                </div>
                {r.next ? (
                  <div className="mt-0.5 flex items-baseline gap-2">
                    <span className="num text-2xl font-bold text-white">{r.next.time}</span>
                    {r.after && (
                      <span className="text-xs text-slate-400">depois {r.after.time}</span>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 mt-1">Sem horários</div>
                )}
              </div>

              {r.minutesLeft !== undefined && (
                <div className="shrink-0 text-right">
                  <div className="text-[10px] text-slate-400 uppercase">Daqui a</div>
                  <div className="num text-base font-bold text-go bg-go-soft px-2.5 py-1 rounded-lg">
                    {formatCountdown(r.minutesLeft)}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Grid({
  table,
  fromCache,
  origin,
  setOrigin,
  isToday,
  onlyUpcoming,
  setOnlyUpcoming,
}: {
  table: Timetable;
  fromCache: boolean;
  origin: string | null;
  setOrigin: (o: string) => void;
  isToday: boolean;
  onlyUpcoming: boolean;
  setOnlyUpcoming: (fn: (prev: boolean) => boolean) => void;
}) {
  const now = useNow(30000);
  const nowMin = minutesOfDay(now);
  const col = table.columns.find((c) => c.origin === origin) ?? table.columns[0];

  if (!col) {
    return (
      <div className="text-xs text-slate-400 py-4">
        Toque no botão "Original" acima para abrir a tabela diretamente no site da FAOL.
      </div>
    );
  }

  const nextMin = isToday ? col.departures.find((d) => d.minutes >= nowMin)?.minutes : undefined;

  const filteredDeps =
    isToday && onlyUpcoming
      ? col.departures.filter((d) => d.minutes >= nowMin - 5)
      : col.departures;

  const byHour = new Map<number, typeof col.departures>();
  filteredDeps.forEach((d) => {
    const h = Math.floor(d.minutes / 60);
    byHour.set(h, [...(byHour.get(h) ?? []), d]);
  });

  const usedRamais = [...new Set(col.departures.map((d) => d.ramal).filter(Boolean))] as string[];

  return (
    <div className="space-y-3">
      {/* Seletor de Ponto de Partida (Estação Livre vs Bairros/Sub-rotas) */}
      {table.columns.length > 1 && (
        <div className="space-y-1">
          <div className="text-[11px] text-slate-400 font-medium">Sentido / Ponto de Partida:</div>
          <div className="flex flex-wrap gap-1.5">
            {table.columns.map((c) => (
              <button
                key={c.origin}
                onClick={() => setOrigin(c.origin)}
                className={`h-9 px-3 rounded-xl text-xs font-semibold border transition ${
                  c.origin === col.origin
                    ? 'bg-ink-700 border-route text-white'
                    : 'bg-ink-950 border-ink-700 text-slate-400'
                }`}
              >
                {c.origin} ({c.departures.length})
              </button>
            ))}
          </div>
        </div>
      )}

      {isToday && (
        <div className="flex items-center justify-between text-xs pt-1">
          <span className="text-slate-400">
            {fromCache ? `Salvo offline` : `Sincronizado com a FAOL`}
          </span>
          <button
            onClick={() => setOnlyUpcoming((prev) => !prev)}
            className={`px-2.5 py-1 rounded-lg border font-medium ${
              onlyUpcoming
                ? 'bg-go-soft border-go/50 text-go'
                : 'bg-ink-800 border-ink-600 text-slate-300'
            }`}
          >
            {onlyUpcoming ? 'Mostrando só próximos' : 'Filtrar só próximos'}
          </button>
        </div>
      )}

      {/* Linhas por Faixa Horária */}
      <div className="divide-y divide-ink-800 border border-ink-800 rounded-xl overflow-hidden">
        {[...byHour.entries()].map(([h, deps]) => (
          <div key={h} className="flex items-center gap-2.5 px-3 py-2 bg-ink-950/60">
            <div className="num w-9 text-sm font-bold text-route shrink-0">
              {String(h).padStart(2, '0')}h
            </div>
            <div className="flex flex-wrap gap-1.5">
              {deps.map((d) => {
                const past = isToday && d.minutes < nowMin;
                const next = d.minutes === nextMin;
                return (
                  <span
                    key={`${d.time}${d.ramal ?? ''}`}
                    className={`num px-2.5 py-1 rounded-lg text-sm font-semibold flex items-center gap-1 ${
                      next
                        ? 'bg-go text-ink-950 font-bold ring-2 ring-go/50'
                        : past
                        ? 'bg-ink-900 text-slate-500'
                        : 'bg-ink-800 text-slate-100'
                    }`}
                  >
                    {d.time}
                    {d.ramal && (
                      <b
                        style={{ color: next ? '#04261c' : ramalColor(d.ramal) }}
                        className="text-xs"
                      >
                        -{d.ramal}
                      </b>
                    )}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Legenda de Ramais */}
      {(table.legend.length > 0 || usedRamais.length > 0) && (
        <div className="bg-ink-950 border border-ink-800 rounded-xl p-3 space-y-1">
          <div className="text-[11px] font-bold uppercase text-slate-400">Legenda de Ramais</div>
          {table.legend.map((l) => (
            <div key={l.code} className="text-xs text-slate-300 flex items-center gap-2">
              <span className="font-bold text-route">{l.code}:</span>
              <span>{l.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
