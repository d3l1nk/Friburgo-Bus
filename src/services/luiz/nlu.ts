// Entendimento de linguagem natural do Luiz: funções puras, sem rede nem armazenamento.
import { FAOL_LINES, findLine } from '../../data/faolLines';
import { dayTypeOf } from '../../lib/time';
import type { DayCode, FaolLine } from '../../types';

export type Intent =
  | 'greeting'
  | 'thanks'
  | 'feedback'
  | 'about'
  | 'faol'
  | 'help'
  | 'desvio'
  | 'alert'
  | 'stops'
  | 'live'
  | 'next'
  | 'none';

export const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

/** Linhas citadas na frase: por número ("linha 58", "58") ou por nome de bairro. */
export function detectLines(n: string): FaolLine[] {
  const byWord = n.match(
    /(?:linha|onibus|busao|circular)\s*(?:numero|n|no|num)?\s*(\d{1,3}[a-z]?)(?![a-z0-9])/,
  );
  const byNum = n.match(/(?<![\d:])(\d{2,3}[a-z]?)(?![\d:a-z])/);
  const code = byWord?.[1] ?? byNum?.[1];
  if (code) {
    const l = findLine(code);
    if (l) return [l];
  }
  const hits = FAOL_LINES.map((l) => {
    const parts = norm(l.name)
      .split('/')
      .map((p) => p.trim())
      .filter((p) => p.length >= 4);
    const best = Math.max(0, ...parts.filter((p) => n.includes(p)).map((p) => p.length));
    return { l, best };
  }).filter((h) => h.best > 0);
  if (!hits.length) return [];
  const max = Math.max(...hits.map((h) => h.best));
  return hits.filter((h) => h.best === max).map((h) => h.l);
}

export function detectDay(n: string, today: DayCode = dayTypeOf()): DayCode {
  if (/sabado/.test(n)) return 'S';
  if (/domingo/.test(n)) return 'D';
  if (/(dia util|dias uteis|semana)/.test(n)) return 'U';
  return today;
}

const RE = {
  greeting: /^(oi|ola|bom dia|boa tarde|boa noite|e ai|opa|hello|eae)\b/,
  thanks: /(obrigad|valeu|brigad)/,
  feedback: /(reclam|sugest|elogi|feedback|queixa|denunc|problema (no|com o) (app|aplicativo)|erro no app)/,
  about: /(quem (criou|fez|desenvolveu)|criador|sobre o app|versao|vinculo|oficial da faol|e da faol)/,
  faol: /(canal|whatsapp|telefone|contato da faol|falar com a faol)/,
  help: /(ajuda|o que (voce|vc) faz|como funciona|comandos|menu)/,
  next: /(proxim|quando|que horas|horario|saida|sai |passa|demora|tabela)/,
  live: /(ao vivo|onde esta|onde ta|rodando|no ar|gps|localiz|tempo real|ja saiu)/,
  desvio: /(desvio|alteracao|obra|interdi|mudanca de rota|aviso de|avisos)/,
  alert: /(avis(e|a|ar)|alerta|notific|me chama|lembr)/,
  stops: /(ponto|parada).*(perto|proxim)|perto de mim|mais proxim[oa] de mim/,
};

/** Intenção da frase (já normalizada), na mesma ordem de prioridade usada pelo assistente. */
export function classifyIntent(n: string): Intent {
  if (RE.greeting.test(n)) return 'greeting';
  if (RE.thanks.test(n)) return 'thanks';
  if (RE.feedback.test(n)) return 'feedback';
  if (RE.about.test(n)) return 'about';
  if (RE.faol.test(n)) return 'faol';
  if (RE.help.test(n)) return 'help';
  if (RE.desvio.test(n)) return 'desvio';
  if (RE.alert.test(n)) return 'alert';
  if (RE.stops.test(n)) return 'stops';
  const isNext = RE.next.test(n);
  const isLive = RE.live.test(n);
  if (isLive && !isNext) return 'live';
  if (isNext || isLive) return 'next';
  return 'none';
}

/** Frases de continuação ("e amanhã?", "nesse também") que reaproveitam a última linha. */
export const isFollowUp = (n: string) => /(e |tambem|nesse|nessa|dela|dele)/.test(n);
export const mentionsLineWord = (n: string) => /\blinha\b/.test(n);
export const blocksPending = (n: string) => /(ajuda|reclam|sugest)/.test(n);
