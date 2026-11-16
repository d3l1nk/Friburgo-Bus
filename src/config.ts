/** Configurações editáveis do app. */
export const APP_NAME = 'Where is my bus?';
export const APP_VERSION: string = __APP_VERSION__;
export const AUTHOR = 'Marcos Raminelly';

/** Telas técnicas: só aparecem se o build for feito com VITE_DIAGNOSTICS=true. */
export const DIAGNOSTICS_ENABLED = import.meta.env.VITE_DIAGNOSTICS === 'true';

/** TODO: trocar pelo link do canal oficial de avisos da FAOL quando for definido. */
export const FAOL_CHANNEL_URL = 'https://www.faol.com.br/';

/** TODO: e-mail que recebe reclamações/sugestões. Vazio = abre o menu de compartilhar do Android. */
export const FEEDBACK_EMAIL = '';

export const LEGAL_TEXT = [
  'O Where is my bus? é uma iniciativa independente e gratuita. Não possui qualquer vínculo, patrocínio, parceria ou aprovação da FAOL, da Prefeitura de Nova Friburgo, da Merus Tracker (Partiu) ou de qualquer outra empresa ou órgão de transporte.',
  'Horários, avisos de desvio e posições dos ônibus são obtidos de fontes públicas e podem estar atrasados, incompletos ou incorretos, e mudar sem aviso. Para informações oficiais, consulte sempre os canais da concessionária.',
  'Nomes e marcas citados pertencem aos seus respectivos titulares e são usados apenas para identificar as fontes das informações. O uso do aplicativo é por conta e risco do usuário.',
  'Privacidade: sua localização é usada no aparelho para achar pontos próximos e é enviada ao serviço Merus Tracker para buscar pontos e previsões de chegada. Favoritos, alertas e mensagens de feedback ficam salvos somente no seu celular.',
];
