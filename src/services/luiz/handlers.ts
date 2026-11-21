// Respostas do Luiz: montam o texto e os botões a partir do contexto e das fontes de dados.
import { REGION_LABEL, dayReplacement, findLine, lineKey } from '../../data/faolLines';
import { formatDistance, haversine } from '../../lib/geo';
import { DAY_LABEL, dayTypeOf, minutesOfDay } from '../../lib/time';
import type { DayCode, FaolLine } from '../../types';
import { nextByColumn } from '../faol';
import { AMBIGUOUS_TEXT } from './persona';
import type { LuizSources } from './sources';
import type { LuizAction, LuizContext, LuizReply } from './types';

export const lineName = (l: FaolLine) => `Linha ${l.code} · ${l.name}`;

export const askLineActions = (ctx: LuizContext, verb: string): LuizAction[] =>
  ctx.favLines
    .slice(0, 4)
    .map((c) => ({ label: `Linha ${c}`, kind: 'ask', payload: `${verb} da linha ${c}` }));

export function disambiguate(found: FaolLine[], verb: string): LuizReply {
  return {
    text: AMBIGUOUS_TEXT,
    actions: found.slice(0, 6).map((l) => ({
      label: `${l.code} ${l.name}`,
      kind: 'ask' as const,
      payload: `${verb} linha ${l.code}`,
    })),
  };
}

export async function answerNext(
  line: FaolLine,
  day: DayCode,
  ctx: LuizContext,
  sources: LuizSources,
  nowMin: number = minutesOfDay(),
): Promise<LuizReply> {
  const rep = dayReplacement(line.code, day);
  if (rep) {
    return {
      text: rep.text,
      actions: rep.related.map((c) => ({ label: `Linha ${c}`, kind: 'line' as const, payload: c })),
    };
  }
  const { table } = await sources.getTimetable(line.code, day);
  const actions: LuizAction[] = [
    { label: 'Abrir horários', kind: 'line', payload: line.code },
    { label: 'Criar alerta', kind: 'alert', payload: line.code },
  ];
  if (!table || !table.columns.length) {
    return {
      text: `Não consegui carregar a tabela da ${lineName(line)} agora (sem internet e sem cópia offline). Tente abrir a linha para ver a tabela original.`,
      actions,
    };
  }
  const today = day === dayTypeOf();
  const rows = today ? nextByColumn(table, nowMin) : null;
  const lines = table.columns.slice(0, 5).map((c, i) => {
    if (rows) {
      const r = rows[i];
      if (!r.next) return `• ${c.origin}: sem mais saídas hoje.`;
      const left = Math.max(0, Math.ceil(r.minutesLeft ?? 0));
      return `• ${c.origin}: ${r.next.time} (${left < 1 ? 'agora' : `em ${left} min`})${r.after ? `, depois ${r.after.time}` : ''}`;
    }
    return `• ${c.origin}: ${c.departures
      .slice(0, 4)
      .map((d) => d.time)
      .join(', ')}…`;
  });
  const live = ctx.vehicles.filter((v) => v.lineKey === lineKey(line.code)).length;
  return {
    text: `${lineName(line)} · ${today ? 'hoje' : ''} ${DAY_LABEL[day]}\n${lines.join('\n')}${live ? `\n\n${live} ônibus desta linha com GPS agora.` : ''}`,
    actions: live
      ? [{ label: 'Ver no mapa', kind: 'map', payload: lineKey(line.code) }, ...actions]
      : actions,
  };
}

export function answerLive(line: FaolLine | null, ctx: LuizContext): LuizReply {
  if (line) {
    const key = lineKey(line.code);
    const vs = ctx.vehicles.filter((v) => v.lineKey === key);
    if (!vs.length) {
      return {
        text: `Nenhum ônibus da ${lineName(line)} com GPS ativo agora.`,
        actions: [
          { label: 'Ver horários', kind: 'line', payload: line.code },
          { label: 'Criar alerta', kind: 'alert', payload: line.code },
        ],
      };
    }
    const near = Math.min(...vs.map((v) => haversine(ctx.pos, v)));
    const dirs = [...new Set(vs.map((v) => v.direction).filter(Boolean))].slice(0, 3).join(', ');
    return {
      text: `${lineName(line)}: ${vs.length} ${vs.length === 1 ? 'ônibus rodando' : 'ônibus rodando'} agora. O mais próximo de você está a ${formatDistance(near)}.${dirs ? `\nSentidos: ${dirs}.` : ''}`,
      actions: [
        { label: 'Ver no mapa', kind: 'map', payload: key },
        { label: 'Avisar quando passar', kind: 'alert', payload: line.code },
      ],
    };
  }
  if (!ctx.vehicles.length) {
    return {
      text: 'Não estou recebendo sinal de GPS dos ônibus agora. Tente de novo em instantes.',
      actions: [{ label: 'Abrir Radar', kind: 'tab', payload: 'radar' }],
    };
  }
  const m = new Map<string, number>();
  ctx.vehicles.forEach((v) => m.set(v.lineKey, (m.get(v.lineKey) ?? 0) + 1));
  const top = [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const code = (k: string) => findLine(k)?.code ?? k;
  return {
    text: `${ctx.vehicles.length} ônibus com GPS agora em ${m.size} linhas. Mais ativas: ${top.map(([k, n]) => `${code(k)} (${n})`).join(', ')}.`,
    actions: [
      { label: 'Abrir Radar', kind: 'tab', payload: 'radar' },
      ...top.slice(0, 3).map(([k]) => ({
        label: `Linha ${code(k)}`,
        kind: 'ask' as const,
        payload: `onde está a linha ${code(k)}`,
      })),
    ],
  };
}

export function answerDesvio(line: FaolLine | null, ctx: LuizContext): LuizReply {
  if (line) {
    const al = ctx.alerts.filter((a) => a.lineKey === lineKey(line.code));
    if (!al.length) {
      return {
        text: `Não encontrei avisos de desvio para a ${lineName(line)} no site da FAOL. Isso não garante que esteja tudo normal: confira o canal oficial.`,
        actions: [{ label: 'Canal da FAOL', kind: 'faol' }],
      };
    }
    return {
      text: `${lineName(line)}:\n${al.map((a) => `• ${a.kind === 'ALTERAÇÃO' ? 'Alteração' : 'Atenção'}: ${a.text}`).join('\n')}`,
      actions: [{ label: 'Abrir linha', kind: 'line', payload: line.code }],
    };
  }
  const keys = [...new Set(ctx.alerts.map((a) => a.lineKey))];
  if (!keys.length) {
    return {
      text: 'Não encontrei avisos de desvio no site da FAOL agora. Confira o canal oficial para ter certeza.',
      actions: [{ label: 'Canal da FAOL', kind: 'faol' }],
    };
  }
  const code = (k: string) => findLine(k)?.code ?? k;
  return {
    text: `Há avisos em ${keys.length} ${keys.length === 1 ? 'linha' : 'linhas'}: ${keys.map(code).join(', ')}. Toque numa linha para ver o aviso.`,
    actions: keys.slice(0, 6).map((k) => ({
      label: `Linha ${code(k)}`,
      kind: 'ask' as const,
      payload: `desvio da linha ${code(k)}`,
    })),
  };
}

export async function answerStops(ctx: LuizContext, sources: LuizSources): Promise<LuizReply> {
  try {
    const { stops } = await sources.getNearbyStops(ctx.pos);
    if (!stops.length) {
      return {
        text: 'Não achei pontos por perto. Abra o Radar e toque em "Atualizar pontos".',
        actions: [{ label: 'Abrir Radar', kind: 'tab', payload: 'radar' }],
      };
    }
    return {
      text: `Pontos mais perto de você:\n${stops
        .slice(0, 4)
        .map((s) => `• ${s.name} (${formatDistance(s.distance)})`)
        .join('\n')}`,
      actions: [{ label: 'Ver no mapa', kind: 'tab', payload: 'radar' }],
    };
  } catch {
    return {
      text: 'Não consegui buscar os pontos agora. Verifique a internet e tente de novo.',
      actions: [{ label: 'Abrir Radar', kind: 'tab', payload: 'radar' }],
    };
  }
}

export function answerLineOverview(line: FaolLine, ctx: LuizContext): LuizReply {
  const key = lineKey(line.code);
  const live = ctx.vehicles.filter((v) => v.lineKey === key).length;
  const al = ctx.alerts.filter((a) => a.lineKey === key).length;
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
