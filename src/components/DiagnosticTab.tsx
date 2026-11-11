import { useEffect, useState } from 'react';
import { Check, Copy, Play } from 'lucide-react';
import { Header } from './ui';
import { getDebug, subscribeDebug } from '../lib/debug';
import { ESTACAO_LIVRE, type GeoFix } from '../lib/geo';
import { normalizeArrivals, normalizeStops, normalizeVehicles, rawPanel, rawStops, rawVehicles } from '../services/merusApi';
import { getAlerts, getTimetable } from '../services/faolScraper';
import type { DayCode, DebugEntry } from '../types';

const MAX_CHARS = 40000;

function Section(props: {
  id: string;
  title: string;
  onRun: () => Promise<void>;
  normalize?: (raw: unknown) => unknown;
  children?: React.ReactNode;
}) {
  const [, force] = useState(0);
  const [running, setRunning] = useState(false);
  const [view, setView] = useState<'raw' | 'norm'>('raw');
  const [copied, setCopied] = useState(false);
  useEffect(() => subscribeDebug(() => force((n) => n + 1)), []);
  const e: DebugEntry | undefined = getDebug(props.id);

  const shown = (() => {
    if (!e) return '';
    const payload = view === 'norm' && props.normalize ? props.normalize(e.data) : e.data;
    let s: string;
    try {
      s = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
    } catch {
      s = String(payload);
    }
    return s.length > MAX_CHARS ? s.slice(0, MAX_CHARS) + `\n… (cortado, ${s.length} caracteres no total)` : s;
  })();

  const run = async () => {
    setRunning(true);
    await props.onRun();
    setRunning(false);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* sem permissão */
    }
  };

  return (
    <section className="rounded-2xl bg-ink-800 border border-ink-600 p-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-sign text-lg font-semibold leading-tight">{props.title}</h2>
        <button onClick={run} disabled={running} className="h-10 px-4 rounded-full bg-route text-ink-950 font-semibold text-sm flex items-center gap-2 disabled:opacity-60 shrink-0">
          <Play size={14} /> {running ? 'Testando…' : 'Testar'}
        </button>
      </div>
      {props.children}
      {e && (
        <div className="mt-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className={`num text-sm px-2 py-0.5 rounded ${e.ok ? 'bg-go-soft text-go' : 'bg-halt-soft text-halt'}`}>
              HTTP {e.status || 'falhou'}
            </span>
            <span className="num text-sm text-slate-300">{e.ms} ms</span>
            <span className="text-slate-500">{new Date(e.at).toLocaleTimeString('pt-BR')}</span>
            {e.error && <span className="text-halt">{e.error}</span>}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 break-all">{e.method} {e.url}</div>
          {e.requestBody !== undefined && <pre className="text-[11px] text-slate-400 mt-1 whitespace-pre-wrap break-all">{JSON.stringify(e.requestBody)}</pre>}
          <div className="flex gap-2 mt-2">
            {props.normalize && (
              <>
                <button onClick={() => setView('raw')} className={`h-8 px-3 rounded-md text-xs ${view === 'raw' ? 'bg-ink-600' : 'bg-ink-700 text-slate-400'}`}>JSON bruto</button>
                <button onClick={() => setView('norm')} className={`h-8 px-3 rounded-md text-xs ${view === 'norm' ? 'bg-ink-600' : 'bg-ink-700 text-slate-400'}`}>Normalizado</button>
              </>
            )}
            <button onClick={copy} className="h-8 px-3 rounded-md text-xs bg-ink-700 ml-auto flex items-center gap-1">
              {copied ? <Check size={13} /> : <Copy size={13} />} Copiar
            </button>
          </div>
          <pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-ink-950 p-2 text-[11px] leading-snug text-emerald-200/90 whitespace-pre-wrap break-all">{shown}</pre>
        </div>
      )}
    </section>
  );
}

const field = 'h-10 rounded-lg bg-ink-950 border border-ink-600 px-3 text-sm outline-none focus:border-route w-full';

export default function DiagnosticTab({ geo }: { geo: GeoFix | null }) {
  const pos = geo?.pos ?? ESTACAO_LIVRE;
  const [idCerca, setIdCerca] = useState('1627');
  const [code, setCode] = useState('58');
  const [day, setDay] = useState<DayCode>('U');

  return (
    <div className="flex flex-col h-full">
      <Header title="Diagnóstico" sub="Teste as rotas e veja o JSON bruto" />
      <div className="scroll-y flex-1 px-4 py-4 space-y-4">
        <div className="text-xs text-slate-400">
          Posição usada nos testes: <span className="num text-slate-200">{pos.lat.toFixed(5)}, {pos.lng.toFixed(5)}</span>
          {geo?.usingFallback ? ' (padrão: Estação Livre)' : ''}
        </div>

        <Section
          id="stops"
          title="Merus · getcercamaisproxima"
          onRun={async () => void (await rawStops(pos.lat, pos.lng))}
          normalize={(r) => normalizeStops(r).slice(0, 25)}
        />

        <Section
          id="panel"
          title="Merus · getveiculospainel"
          onRun={async () => void (await rawPanel(idCerca, pos.lat, pos.lng))}
          normalize={normalizeArrivals}
        >
          <label className="block mt-2 text-xs text-slate-400">
            id_cerca
            <input className={field} value={idCerca} onChange={(e) => setIdCerca(e.target.value)} inputMode="numeric" />
          </label>
        </Section>

        <Section
          id="vehicles"
          title="Merus · getveiculosconsultapassageiro"
          onRun={async () => void (await rawVehicles())}
          normalize={(r) => normalizeVehicles(r).slice(0, 25)}
        />

        <Section id="faol-alerts" title="FAOL · /horarios (alertas)" onRun={async () => void (await getAlerts())} />

        <Section
          id="faol-table"
          title="FAOL · tabela de horários"
          onRun={async () => void (await getTimetable(code.trim(), day, true))}
        >
          <div className="flex gap-2 mt-2">
            <input className={field} value={code} onChange={(e) => setCode(e.target.value)} placeholder="Linha (ex.: 58)" />
            <select className={field + ' w-28'} value={day} onChange={(e) => setDay(e.target.value as DayCode)}>
              <option value="U">U</option>
              <option value="S">S</option>
              <option value="D">D</option>
              <option value="C">C</option>
            </select>
          </div>
        </Section>
      </div>
    </div>
  );
}
