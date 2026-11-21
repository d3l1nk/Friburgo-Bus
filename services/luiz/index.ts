// Roteador do Luiz: classifica a intenção (nlu) e delega a resposta (handlers).
import { findLine } from '../../data/faolLines';
import {
  ABOUT_TEXT,
  ASK_WHICH_LINE,
  ASK_WHICH_LINE_ALERT,
  ASK_WHICH_LINE_NEXT,
  FAOL_CHANNEL_TEXT,
  FEEDBACK_TEXT,
  GREETING,
  HELP_TEXT,
  NOT_UNDERSTOOD_TEXT,
  THANKS_TEXT,
} from './persona';
import {
  answerDesvio,
  answerLineOverview,
  answerLive,
  answerNext,
  answerStops,
  askLineActions,
  disambiguate,
  lineName,
} from './handlers';
import {
  blocksPending,
  classifyIntent,
  detectDay,
  detectLines,
  isFollowUp,
  mentionsLineWord,
  norm,
} from './nlu';
import { defaultSources, type LuizSources } from './sources';
import type { LuizContext, LuizMemory, LuizReply } from './types';

export * from './types';
export { GREETING, QUICK_MESSAGES } from './persona';
export type { LuizSources } from './sources';

export async function luizAnswer(
  input: string,
  ctx: LuizContext,
  mem: LuizMemory,
  sources: LuizSources = defaultSources,
): Promise<LuizReply> {
  const n = norm(input);
  const found = detectLines(n);
  const line = found.length === 1 ? found[0] : null;
  if (line) mem.lastLine = line.code;

  // resposta a uma pergunta pendente ("de qual linha?")
  if (mem.pending && line && !blocksPending(n)) {
    const p = mem.pending;
    mem.pending = undefined;
    if (p === 'next') return answerNext(line, detectDay(n), ctx, sources);
    if (p === 'live') return answerLive(line, ctx);
    if (p === 'desvio') return answerDesvio(line, ctx);
    return {
      text: `Vou abrir o criador de alertas para a ${lineName(line)}.`,
      actions: [{ label: 'Criar alerta', kind: 'alert', payload: line.code }],
    };
  }
  mem.pending = undefined;

  switch (classifyIntent(n)) {
    case 'greeting':
      return GREETING;
    case 'thanks':
      return { text: THANKS_TEXT };
    case 'feedback':
      return { text: FEEDBACK_TEXT, actions: [{ label: 'Abrir feedback', kind: 'feedback' }] };
    case 'about':
      return { text: ABOUT_TEXT, actions: [{ label: 'Ver tela Sobre', kind: 'about' }] };
    case 'faol':
      return { text: FAOL_CHANNEL_TEXT, actions: [{ label: 'Abrir canal da FAOL', kind: 'faol' }] };
    case 'help':
      return { text: HELP_TEXT };

    case 'desvio':
      if (!line && found.length > 1) return disambiguate(found, 'desvio');
      if (!line && mentionsLineWord(n)) {
        mem.pending = 'desvio';
        return { text: ASK_WHICH_LINE, actions: askLineActions(ctx, 'desvio') };
      }
      return answerDesvio(line, ctx);

    case 'alert':
      if (!line && found.length > 1) return disambiguate(found, 'avisar sobre');
      if (!line) {
        mem.pending = 'alert';
        return {
          text: ASK_WHICH_LINE_ALERT,
          actions: [...askLineActions(ctx, 'alerta'), { label: 'Escolher na tela', kind: 'alert' }],
        };
      }
      return {
        text: `Certo! Vou abrir o criador de alertas para a ${lineName(line)}. Lá você escolhe entre aviso de horário de saída, ônibus saiu do ponto final ou ônibus passando no seu ponto.`,
        actions: [{ label: 'Criar alerta', kind: 'alert', payload: line.code }],
      };

    case 'stops':
      return answerStops(ctx, sources);

    case 'live':
      if (!line && found.length > 1) return disambiguate(found, 'onde está');
      if (!line && mentionsLineWord(n)) {
        mem.pending = 'live';
        return { text: ASK_WHICH_LINE, actions: askLineActions(ctx, 'onde está') };
      }
      return answerLive(line, ctx);

    case 'next': {
      const target =
        line ??
        (found.length === 0 && mem.lastLine && isFollowUp(n) ? (findLine(mem.lastLine) ?? null) : null);
      if (!target && found.length > 1) return disambiguate(found, 'próximo ônibus');
      if (!target) {
        mem.pending = 'next';
        return { text: ASK_WHICH_LINE_NEXT, actions: askLineActions(ctx, 'próximo ônibus') };
      }
      return answerNext(target, detectDay(n), ctx, sources);
    }

    default:
      if (line) return answerLineOverview(line, ctx);
      if (found.length > 1) return disambiguate(found, 'mostrar');
      return {
        text: NOT_UNDERSTOOD_TEXT,
        actions: [
          { label: 'Ajuda', kind: 'ask', payload: 'ajuda' },
          { label: 'Reclamação ou sugestão', kind: 'feedback' },
        ],
      };
  }
}
