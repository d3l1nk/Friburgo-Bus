import { findLine, FAOL_LINES, REGION_LABEL, dayReplacement, lineKey } from '../data/faolLines';
import { DAY_LABEL, dayTypeOf, minutesOfDay } from '../lib/time';
import { formatDistance, haversine } from '../lib/geo';
import { getNearbyStops } from './merusApi';
import { getTimetable, nextByColumn } from './faolScraper';
import type { DayCode, FaolAlert, FaolLine, LatLng, MerusVehicle } from '../types';

export interface LuizAction {
  label: string;
  kind: 'line' | 'map' | 'alert' | 'feedback' | 'about' | 'faol' | 'tab' | 'ask';
  payload?: string;
}
export interface LuizReply {
  text: string;
  actions?: LuizAction[];
}
export interface LuizContext {
  pos: LatLng;
  vehicles: MerusVehicle[];
  alerts: FaolAlert[];
  favLines: string[];
}
export interface LuizMemory {
  lastLine?: string;
  pending?: 'next' | 'live' | 'alert' | 'desvio';
}

export const QUICK_MESSAGES = [
  'Próximo ônibus',
  'Ônibus ao vivo',
  'Pontos perto de mim',
  'Desvios hoje',
  'Criar alerta',
  'Reclamação ou sugestão',
  'Ajuda',
];

export const GREETING: LuizReply = {
  text: 'Oi! Eu sou o Luiz, assistente do Where is my bus?. Posso ver horários, ônibus ao vivo, pontos perto de você, desvios e criar alertas. Escolha uma opção abaixo ou escreva sua pergunta.',
};

const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

// ---------- detecção de linha / dia ----------
function detectLines(n: string): FaolLine[] {
  const byWord = n.match(/(?:linha|onibus|busao|circular)\s*(?:numero|n|no|num)?\s*(\d{1,3}[a-z]?)(?![a-z0-9])/);
  const byNum = n.match(/(?<![\d:])(\d{2,3}[a-z]?)(?![\d:a-z])/);
  const code = byWord?.[1] ?? byNum?.[1];
  if (code) {
    const l = findLine(code);
    if (l) return [l];
  }
  // por nome de bairro
  const hits = FAOL_LINES.map((l) => {
    const parts = norm(l.name).split('/').map((p) => p.trim()).filter((p) => p.length >= 4);
    const best = Math.max(0, ...parts.filter((p) => n.includes(p)).map((p) => p.length));
    return { l, best };
  }).filter((h) => h.best > 0);
  if (!hits.length) return [];
  const max = Math.max(...hits.map((h) => h.best));
  return hits.filter((h) => h.best === max).map((h) => h.l);
}

function detectDay(n: string): DayCode {
  if (/sabado/.test(n)) return 'S';
  if (/domingo/.test(n)) return 'D';
  if (/(dia util|dias uteis|semana)/.test(n)) return 'U';
  return dayTypeOf();
}

const lineName = (l: FaolLine) => `Linha ${l.code} · ${l.name}`;
const askLineActions = (ctx: LuizContext, verb: string): LuizAction[] =>
  ctx.favLines.slice(0, 4).map((c) => ({ label: `Linha ${c}`, kind: 'ask', payload: `${verb} da linha ${c}` }));

// ---------- respostas ----------
async function answerNext(line: FaolLine, day: DayCode, ctx: LuizContext): Promise<LuizReply> {
  const rep = dayReplacement(line.code, day);
  if (rep) {
    return { text: rep.text, actions: rep.related.map((c) => ({ label: `Linha ${c}`, kind: 'line' as const, payload: c })) };
  }
  const { table } = await getTimetable(line.code, day);
  const actions: LuizAction[] = [
    { label: 'Abrir horários', kind: 'line', payload: line.code },
    { label: 'Criar alerta', kind: 'alert', payload: line.code },
  ];
  if (!table || !table.columns.length) {
    return { text: `Não consegui carregar a tabela da ${lineName(line)} agora (sem internet e sem cópia offline). Tente abrir a linha para ver a tabela original.`, actions };
  }
  const today = day === dayTypeOf();
  const nowMin = minutesOfDay();
  const rows = today ? nextByColumn(table, nowMin) : null;
  const lines = table.columns.slice(0, 5).map((c, i) => {
    if (rows) {
      const r = rows[i];
      if (!r.next) return `• ${c.origin}: sem mais saídas hoje.`;
      const left = Math.max(0, Math.ceil(r.minutesLeft ?? 0));
      return `• ${c.origin}: ${r.next.time} (${left < 1 ? 'agora' : `em ${left} min`})${r.after ? `, depois ${r.after.time}` : ''}`;
    }
    return `• ${c.origin}: ${c.departures.slice(0, 4).map((d) => d.time).join(', ')}…`;
  });
  const live = ctx.vehicles.filter((v) => v.lineKey === lineKey(line.code)).length;
  return {
    text: `${lineName(line)} · ${today ? 'hoje' : ''} ${DAY_LABEL[day]}\n${lines.join('\n')}${live ? `\n\n${live} ônibus desta linha com GPS agora.` : ''}`,
    actions: live ? [{ label: 'Ver no mapa', kind: 'map', payload: lineKey(line.code) }, ...actions] : actions,
  };
}

function answerLive(line: FaolLine | null, ctx: LuizContext): LuizReply {
  if (line) {
    const key = lineKey(line.code);
    const vs = ctx.vehicles.filter((v) => v.lineKey === key);
    if (!vs.length) return { text: `Nenhum ônibus da ${lineName(line)} com GPS ativo agora.`, actions: [{ label: 'Ver horários', kind: 'line', payload: line.code }, { label: 'Criar alerta', kind: 'alert', payload: line.code }] };
    const near = Math.min(...vs.map((v) => haversine(ctx.pos, v)));
    const dirs = [...new Set(vs.map((v) => v.direction).filter(Boolean))].slice(0, 3).join(', ');
    return {
      text: `${lineName(line)}: ${vs.length} ${vs.length === 1 ? 'ônibus rodando' : 'ônibus rodando'} agora. O mais próximo de você está a ${formatDistance(near)}.${dirs ? `\nSentidos: ${dirs}.` : ''}`,
      actions: [{ label: 'Ver no mapa', kind: 'map', payload: key }, { label: 'Avisar quando passar', kind: 'alert', payload: line.code }],
    };
  }
  if (!ctx.vehicles.length) return { text: 'Não estou recebendo sinal de GPS dos ônibus agora. Tente de novo em instantes.', actions: [{ label: 'Abrir Radar', kind: 'tab', payload: 'radar' }] };
  const m = new Map<string, number>();
  ctx.vehicles.forEach((v) => m.set(v.lineKey, (m.get(v.lineKey) ?? 0) + 1));
  const top = [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  return {
    text: `${ctx.vehicles.length} ônibus com GPS agora em ${m.size} linhas. Mais ativas: ${top.map(([k, n]) => `${findLine(k)?.code ?? k} (${n})`).join(', ')}.`,
    actions: [{ label: 'Abrir Radar', kind: 'tab', payload: 'radar' }, ...top.slice(0, 3).map(([k]) => ({ label: `Linha ${findLine(k)?.code ?? k}`, kind: 'ask' as const, payload: `onde está a linha ${findLine(k)?.code ?? k}` }))],
  };
}

function answerDesvio(line: FaolLine | null, ctx: LuizContext): LuizReply {
  if (line) {
    const al = ctx.alerts.filter((a) => a.lineKey === lineKey(line.code));
    if (!al.length) return { text: `Não encontrei avisos de desvio para a ${lineName(line)} no site da FAOL. Isso não garante que esteja tudo normal: confira o canal oficial.`, actions: [{ label: 'Canal da FAOL', kind: 'faol' }] };
    return { text: `${lineName(line)}:\n${al.map((a) => `• ${a.kind === 'ALTERAÇÃO' ? 'Alteração' : 'Atenção'}: ${a.text}`).join('\n')}`, actions: [{ label: 'Abrir linha', kind: 'line', payload: line.code }] };
  }
  const keys = [...new Set(ctx.alerts.map((a) => a.lineKey))];
  if (!keys.length) return { text: 'Não encontrei avisos de desvio no site da FAOL agora. Confira o canal oficial para ter certeza.', actions: [{ label: 'Canal da FAOL', kind: 'faol' }] };
  return {
    text: `Há avisos em ${keys.length} ${keys.length === 1 ? 'linha' : 'linhas'}: ${keys.map((k) => findLine(k)?.code ?? k).join(', ')}. Toque numa linha para ver o aviso.`,
    actions: keys.slice(0, 6).map((k) => ({ label: `Linha ${findLine(k)?.code ?? k}`, kind: 'ask' as const, payload: `desvio da linha ${findLine(k)?.code ?? k}` })),
  };
}

async function answerStops(ctx: LuizContext): Promise<LuizReply> {
  try {
    const { stops } = await getNearbyStops(ctx.pos, false);
    if (!stops.length) return { text: 'Não achei pontos por perto. Abra o Radar e toque em "Atualizar pontos".', actions: [{ label: 'Abrir Radar', kind: 'tab', payload: 'radar' }] };
    return {
      text: `Pontos mais perto de você:\n${stops.slice(0, 4).map((s) => `• ${s.name} (${formatDistance(s.distance)})`).join('\n')}`,
      actions: [{ label: 'Ver no mapa', kind: 'tab', payload: 'radar' }],
    };
  } catch {
    return { text: 'Não consegui buscar os pontos agora. Verifique a internet e tente de novo.', actions: [{ label: 'Abrir Radar', kind: 'tab', payload: 'radar' }] };
  }
}

// ---------- roteador de intenções ----------
export async function luizAnswer(input: string, ctx: LuizContext, mem: LuizMemory): Promise<LuizReply> {
  const n = norm(input);
  const found = detectLines(n);
  const line = found.length === 1 ? found[0] : null;
  if (line) mem.lastLine = line.code;

  const isNext = /(proxim|quando|que horas|horario|saida|sai |passa|demora|tabela)/.test(n);
  const isLive = /(ao vivo|onde esta|onde ta|rodando|no ar|gps|localiz|tempo real|ja saiu)/.test(n);
  const isDesvio = /(desvio|alteracao|obra|interdi|mudanca de rota|aviso de|avisos)/.test(n);
  const isAlert = /(avis(e|a|ar)|alerta|notific|me chama|lembr)/.test(n);

  // resposta a uma pergunta pendente ("de qual linha?")
  if (mem.pending && (line || found.length === 0) && !/(ajuda|reclam|sugest)/.test(n) && line) {
    const p = mem.pending;
    mem.pending = undefined;
    if (p === 'next') return answerNext(line, detectDay(n), ctx);
    if (p === 'live') return answerLive(line, ctx);
    if (p === 'desvio') return answerDesvio(line, ctx);
    return { text: `Vou abrir o criador de alertas para a ${lineName(line)}.`, actions: [{ label: 'Criar alerta', kind: 'alert', payload: line.code }] };
  }
  mem.pending = undefined;

  if (/^(oi|ola|bom dia|boa tarde|boa noite|e ai|opa|hello|eae)\b/.test(n)) return GREETING;
  if (/(obrigad|valeu|brigad)/.test(n)) return { text: 'Por nada! Se precisar de mais alguma coisa, é só chamar. 🚌' };
  if (/(reclam|sugest|elogi|feedback|queixa|denunc|problema (no|com o) (app|aplicativo)|erro no app)/.test(n))
    return { text: 'Claro! Você pode enviar uma reclamação, sugestão ou elogio pela tela de feedback.', actions: [{ label: 'Abrir feedback', kind: 'feedback' }] };
  if (/(quem (criou|fez|desenvolveu)|criador|sobre o app|versao|vinculo|oficial da faol|e da faol)/.test(n))
    return { text: 'O Where is my bus? foi criado por Marcos Raminelly. É uma iniciativa independente, sem vínculo oficial com a FAOL, a prefeitura ou a Merus.', actions: [{ label: 'Ver tela Sobre', kind: 'about' }] };
  if (/(canal|whatsapp|telefone|contato da faol|falar com a faol)/.test(n))
    return { text: 'Para avisos e atendimento oficiais, use o canal da FAOL.', actions: [{ label: 'Abrir canal da FAOL', kind: 'faol' }] };
  if (/(ajuda|o que (voce|vc) faz|como funciona|comandos|menu)/.test(n))
    return {
      text: 'Posso:\n• mostrar o próximo ônibus de uma linha\n• dizer onde os ônibus estão agora\n• listar pontos perto de você\n• mostrar desvios e avisos\n• criar alertas de saída ou de passagem\n• abrir a tela de feedback\n\nEu funciono dentro do aparelho: suas mensagens não são enviadas para a internet.',
    };

  if (isDesvio) {
    if (!line && found.length > 1) return disambiguate(found, 'desvio');
    if (!line && /\blinha\b/.test(n)) { mem.pending = 'desvio'; return { text: 'De qual linha?', actions: askLineActions(ctx, 'desvio') }; }
    return answerDesvio(line, ctx);
  }
  if (isAlert) {
    if (!line && found.length > 1) return disambiguate(found, 'avisar sobre');
    if (!line) { mem.pending = 'alert'; return { text: 'Para qual linha você quer o alerta?', actions: [...askLineActions(ctx, 'alerta'), { label: 'Escolher na tela', kind: 'alert' }] }; }
    return { text: `Certo! Vou abrir o criador de alertas para a ${lineName(line)}. Lá você escolhe entre aviso de horário de saída, ônibus saiu do ponto final ou ônibus passando no seu ponto.`, actions: [{ label: 'Criar alerta', kind: 'alert', payload: line.code }] };
  }
  if (/(ponto|parada).*(perto|proxim)|perto de mim|mais proxim[oa] de mim/.test(n)) return answerStops(ctx);
  if (isLive && !isNext) {
    if (!line && found.length > 1) return disambiguate(found, 'onde está');
    if (!line && /\blinha\b/.test(n)) { mem.pending = 'live'; return { text: 'De qual linha?', actions: askLineActions(ctx, 'onde está') }; }
    return answerLive(line, ctx);
  }
  if (isNext || isLive) {
    const target = line ?? (found.length === 0 && mem.lastLine && /(e |tambem|nesse|nessa|dela|dele)/.test(n) ? findLine(mem.lastLine) ?? null : null);
    if (!target && found.length > 1) return disambiguate(found, 'próximo ônibus');
    if (!target) { mem.pending = 'next'; return { text: 'De qual linha você quer saber? Pode dizer o número (ex.: 58) ou o bairro.', actions: askLineActions(ctx, 'próximo ônibus') }; }
    return answerNext(target, detectDay(n), ctx);
  }
  if (line) {
    const live = ctx.vehicles.filter((v) => v.lineKey === lineKey(line.code)).length;
    const al = ctx.alerts.filter((a) => a.lineKey === lineKey(line.code)).length;
    return {
      text: `${lineName(line)} (${REGION_LABEL[line.region]}).${live ? ` ${live} ônibus com GPS agora.` : ' Nenhum ônibus com GPS agora.'}${al ? ` Há ${al} aviso(s) de desvio.` : ''} O que você quer ver?`,
      actions: [
        { label: 'Próxima saída', kind: 'ask', payload: `próximo ônibus da linha ${line.code}` },
        { label: 'Ao vivo', kind: 'ask', payload: `onde está a linha ${line.code}` },
        { label: 'Abrir linha', kind: 'line', payload: line.code },
        { label: 'Criar alerta', kind: 'alert', payload: line.code },
      ],
    };
  }
  if (found.length > 1) return disambiguate(found, 'mostrar');
  return { text: 'Não entendi muito bem. Você pode perguntar, por exemplo: "próximo ônibus da linha 58", "onde está o ônibus do Cônego" ou "desvios hoje".', actions: [{ label: 'Ajuda', kind: 'ask', payload: 'ajuda' }, { label: 'Reclamação ou sugestão', kind: 'feedback' }] };
}

function disambiguate(found: FaolLine[], verb: string): LuizReply {
  return {
    text: 'Encontrei mais de uma linha. Qual delas?',
    actions: found.slice(0, 6).map((l) => ({ label: `${l.code} ${l.name}`, kind: 'ask' as const, payload: `${verb} linha ${l.code}` })),
  };
}
