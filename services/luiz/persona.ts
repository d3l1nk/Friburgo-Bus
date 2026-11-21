// Personalidade e textos do Luiz. Tudo que o assistente "diz" sem consultar dados fica aqui.
import type { LuizReply } from './types';

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

export const THANKS_TEXT = 'Por nada! Se precisar de mais alguma coisa, é só chamar. 🚌';

export const FEEDBACK_TEXT =
  'Claro! Você pode enviar uma reclamação, sugestão ou elogio pela tela de feedback.';

export const ABOUT_TEXT =
  'O Where is my bus? foi criado por Marcos Raminelly. É uma iniciativa independente, sem vínculo oficial com a FAOL, a prefeitura ou a Merus.';

export const FAOL_CHANNEL_TEXT = 'Para avisos e atendimento oficiais, use o canal da FAOL.';

export const HELP_TEXT =
  'Posso:\n• mostrar o próximo ônibus de uma linha\n• dizer onde os ônibus estão agora\n• listar pontos perto de você\n• mostrar desvios e avisos\n• criar alertas de saída ou de passagem\n• abrir a tela de feedback\n\nEu funciono dentro do aparelho: suas mensagens não são enviadas para a internet.';

export const NOT_UNDERSTOOD_TEXT =
  'Não entendi muito bem. Você pode perguntar, por exemplo: "próximo ônibus da linha 58", "onde está o ônibus do Cônego" ou "desvios hoje".';

export const ASK_WHICH_LINE = 'De qual linha?';
export const ASK_WHICH_LINE_NEXT =
  'De qual linha você quer saber? Pode dizer o número (ex.: 58) ou o bairro.';
export const ASK_WHICH_LINE_ALERT = 'Para qual linha você quer o alerta?';
export const AMBIGUOUS_TEXT = 'Encontrei mais de uma linha. Qual delas?';
