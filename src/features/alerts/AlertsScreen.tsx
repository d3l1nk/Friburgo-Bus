import { useEffect, useState } from 'react';
import { ArrowLeft, Bell, BellRing, Plus, Trash2 } from 'lucide-react';
import { Empty, Header, IconBtn } from '../../components/ui/ui';
import { FAOL_LINES } from '../../data/faolLines';
import { getJSON } from '../../lib/storage';
import { getTimetable } from '../../services/faol';
import { ESTACAO_LIVRE_STOP, describeRule } from '../../services/notifications';
import { dayTypeOf } from '../../lib/time';
import type { AlertRule, AlertRuleType, Favorites, StopsCache } from '../../types';

type NewRule = Omit<AlertRule, 'id' | 'nid' | 'createdAt' | 'enabled'>;

interface Props {
  rules: AlertRule[];
  add: (p: NewRule) => Promise<{ count: number; granted: boolean }>;
  remove: (id: string) => Promise<void>;
  toggle: (id: string) => Promise<void>;
  favStops: Favorites['stops'];
  prefillLine?: string | null;
  onBack: () => void;
}

const TYPES: { id: AlertRuleType; title: string; hint: string }[] = [
  {
    id: 'schedule',
    title: 'Horário de saída',
    hint: 'Avisa antes de cada saída da tabela. Funciona mesmo com o app fechado.',
  },
  {
    id: 'depart',
    title: 'Ônibus saiu do ponto final',
    hint: 'Avisa quando um ônibus da linha deixa o ponto (GPS, app aberto).',
  },
  {
    id: 'pass',
    title: 'Ônibus passando no meu ponto',
    hint: 'Avisa quando um ônibus da linha chega perto do ponto escolhido (GPS, app aberto).',
  },
];

const sel =
  'h-11 w-full rounded-lg bg-ink-950 border border-ink-600 px-3 text-sm outline-none focus:border-route';

export default function AlertsScreen(p: Props) {
  const [creating, setCreating] = useState(!!p.prefillLine);
  const [type, setType] = useState<AlertRuleType>('schedule');
  const [lineCode, setLineCode] = useState(p.prefillLine ?? '58');
  const [origins, setOrigins] = useState<string[]>([]);
  const [origin, setOrigin] = useState('');
  const [lead, setLead] = useState(5);
  const [stopId, setStopId] = useState(ESTACAO_LIVRE_STOP.id);
  const [radius, setRadius] = useState(300);
  const [cached, setCached] = useState<Favorites['stops']>([]);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    getJSON<StopsCache>('merus:stops:v1').then((c) => c && setCached(c.stops.slice(0, 30)));
  }, []);

  useEffect(() => {
    if (type !== 'schedule') return;
    let alive = true;
    getTimetable(lineCode, dayTypeOf()).then(({ table }) => {
      if (!alive) return;
      const names = table?.columns.map((c) => c.origin) ?? [];
      setOrigins(names);
      setOrigin((o) => (names.includes(o) ? o : (names[0] ?? '')));
    });
    return () => {
      alive = false;
    };
  }, [lineCode, type]);

  const stopOptions = [
    ESTACAO_LIVRE_STOP,
    ...p.favStops,
    ...cached.filter((c) => !p.favStops.some((f) => f.id === c.id)),
  ];

  const save = async () => {
    const stop = stopOptions.find((s) => s.id === stopId) ?? ESTACAO_LIVRE_STOP;
    const base: NewRule = { type, lineCode };
    const rule: NewRule =
      type === 'schedule'
        ? { ...base, originName: origin || undefined, leadMin: lead }
        : {
            ...base,
            stop: type === 'depart' && stopId === ESTACAO_LIVRE_STOP.id ? ESTACAO_LIVRE_STOP : stop,
            radius: type === 'depart' ? 150 : radius,
          };
    const r = await p.add(rule);
    setCreating(false);
    setMsg(
      !r.granted
        ? 'Alerta criado, mas as notificações estão bloqueadas. Ative-as nas configurações do Android.'
        : type === 'schedule'
          ? r.count > 0
            ? `${r.count} avisos agendados para hoje e amanhã. Abra o app uma vez por dia para renovar.`
            : 'Alerta criado, mas não há tabela salva para agendar. Conecte-se à internet e abra a linha.'
          : 'Alerta criado. Mantenha o app aberto para receber os avisos por GPS.',
    );
  };

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Meus alertas"
        sub={`${p.rules.filter((r) => r.enabled).length} ativos`}
        right={
          <IconBtn onClick={p.onBack} label="Voltar">
            <ArrowLeft size={20} />
          </IconBtn>
        }
      />
      <div className="scroll-y flex-1 px-4 py-4 space-y-4">
        {msg && <div className="rounded-xl bg-go-soft border border-go/40 text-sm p-3">{msg}</div>}

        {!creating && (
          <button
            onClick={() => {
              setCreating(true);
              setMsg(null);
            }}
            className="w-full h-12 rounded-xl bg-route text-ink-950 font-semibold flex items-center justify-center gap-2"
          >
            <Plus size={20} /> Novo alerta
          </button>
        )}

        {creating && (
          <section className="rounded-2xl bg-ink-800 border border-ink-600 p-4 space-y-4">
            <div className="space-y-2">
              {TYPES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setType(t.id)}
                  className={`w-full text-left rounded-xl border p-3 ${type === t.id ? 'border-route bg-route-soft/50' : 'border-ink-600 bg-ink-900'}`}
                >
                  <div className="font-medium">{t.title}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{t.hint}</div>
                </button>
              ))}
            </div>

            <label className="block text-xs text-slate-400">
              Linha
              <select className={sel} value={lineCode} onChange={(e) => setLineCode(e.target.value)}>
                {FAOL_LINES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.code} · {l.name}
                  </option>
                ))}
              </select>
            </label>

            {type === 'schedule' && (
              <>
                <label className="block text-xs text-slate-400">
                  Saindo de
                  <select
                    className={sel}
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    disabled={!origins.length}
                  >
                    {origins.length === 0 && <option>Sem tabela salva (abra a linha com internet)</option>}
                    {origins.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </label>
                <div>
                  <div className="text-xs text-slate-400 mb-1">Avisar</div>
                  <div className="flex gap-2">
                    {[0, 5, 10, 15].map((m) => (
                      <button
                        key={m}
                        onClick={() => setLead(m)}
                        className={`flex-1 h-10 rounded-lg text-sm border ${lead === m ? 'bg-route text-ink-950 border-route' : 'bg-ink-900 border-ink-600'}`}
                      >
                        {m === 0 ? 'Na hora' : `${m} min antes`}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {type !== 'schedule' && (
              <>
                <label className="block text-xs text-slate-400">
                  {type === 'depart' ? 'Ponto final' : 'Ponto'}
                  <select className={sel} value={stopId} onChange={(e) => setStopId(e.target.value)}>
                    {stopOptions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                {type === 'pass' && (
                  <div>
                    <div className="text-xs text-slate-400 mb-1">Distância do aviso</div>
                    <div className="flex gap-2">
                      {[200, 300, 500].map((m) => (
                        <button
                          key={m}
                          onClick={() => setRadius(m)}
                          className={`flex-1 h-10 rounded-lg text-sm border ${radius === m ? 'bg-route text-ink-950 border-route' : 'bg-ink-900 border-ink-600'}`}
                        >
                          {m} m
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="text-xs text-warn">
                  Este tipo usa o GPS dos ônibus e só funciona com o app aberto ou recém-minimizado. Para
                  avisos garantidos, use "Horário de saída".
                </div>
              </>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setCreating(false)}
                className="flex-1 h-11 rounded-xl bg-ink-700 font-medium"
              >
                Cancelar
              </button>
              <button onClick={save} className="flex-1 h-11 rounded-xl bg-route text-ink-950 font-semibold">
                Criar alerta
              </button>
            </div>
          </section>
        )}

        {!p.rules.length && !creating && (
          <Empty
            icon={<Bell size={30} />}
            title="Nenhum alerta"
            hint="Crie um alerta para ser avisado sobre saídas ou passagem de ônibus."
          />
        )}

        <div className="space-y-2">
          {p.rules.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-3 rounded-xl bg-ink-800 border border-ink-600 p-3"
            >
              <BellRing size={20} className={r.enabled ? 'text-go' : 'text-slate-600'} />
              <div className="flex-1 min-w-0">
                <div className="font-medium">Linha {r.lineCode}</div>
                <div className="text-xs text-slate-400">{describeRule(r)}</div>
              </div>
              <button
                onClick={() => void p.toggle(r.id)}
                className={`h-8 w-14 rounded-full p-1 transition-colors ${r.enabled ? 'bg-go' : 'bg-ink-600'}`}
                aria-label="Ativar ou desativar"
              >
                <span
                  className={`block h-6 w-6 rounded-full bg-white transition-transform ${r.enabled ? 'translate-x-6' : ''}`}
                />
              </button>
              <button
                onClick={() => void p.remove(r.id)}
                className="h-10 w-10 grid place-items-center text-halt"
                aria-label="Excluir"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
