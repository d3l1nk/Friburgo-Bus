import type { DayCode, FaolLine, RegionId } from '../types';

export const REGIONS: { id: RegionId; label: string }[] = [
  { id: 'circular', label: 'Circular' },
  { id: 'centro-sul', label: 'Centro Sul' },
  { id: 'centro-norte', label: 'Centro Norte' },
  { id: 'norte', label: 'Norte' },
  { id: 'leste', label: 'Leste' },
  { id: 'sul', label: 'Sul' },
  { id: 'oeste', label: 'Oeste' },
];

const L = (region: RegionId, code: string, name: string): FaolLine => ({ code, name, region });

export const FAOL_LINES: FaolLine[] = [
  // Circular
  L('circular', '100', 'Olaria'),
  L('circular', '200', 'Conselheiro'),
  L('circular', '400', 'Lumiar'),
  L('circular', '500', 'Conquista'),
  // Centro Sul
  L('centro-sul', '02', 'Perissê / Duas Pedras'),
  L('centro-sul', '04', 'Vale dos Pinheiros / Cordoeira'),
  L('centro-sul', '04C', 'Eugênio Montechiari'),
  L('centro-sul', '05', 'Catarcione'),
  L('centro-sul', '06', 'Tingly / Braunes'),
  L('centro-sul', '07', 'Granja Spinelli'),
  L('centro-sul', '08', 'São Cristovão / Perissê'),
  // Centro Norte
  L('centro-norte', '10', 'Olaria / Conselheiro'),
  L('centro-norte', '16', 'Rui Sanglard'),
  L('centro-norte', '17', 'Jardinlândia'),
  L('centro-norte', '18', 'Santo André'),
  // Norte
  L('norte', '20', 'Riograndina'),
  L('norte', '21', 'Furnas'),
  L('norte', '22', 'Belmonte'),
  L('norte', '23', 'Marajói'),
  L('norte', '24', 'Jardim Califórnia'),
  L('norte', '25', 'Maringá'),
  L('norte', '26', 'Alto do Floresta'),
  L('norte', '27', 'Fazenda da Laje'),
  L('norte', '28', 'Maria Teresa'),
  // Leste
  L('leste', '30', 'Amparo'),
  L('leste', '31', 'Paraíso'),
  L('leste', '32', 'Nova Suiça'),
  L('leste', '33', 'Alto do Schuenck'),
  L('leste', '34', 'Toledo'),
  L('leste', '35', 'Jardim dos Reis'),
  // Sul
  L('sul', '40', 'Theodoro'),
  L('sul', '41', 'Ponte da Saudade'),
  L('sul', '42', 'Alto de Olaria'),
  L('sul', '43', 'Cônego'),
  L('sul', '44', 'Cascatinha'),
  L('sul', '45', 'Varginha'),
  L('sul', '46', 'Vargem Alta'),
  L('sul', '47', 'São Pedro'),
  L('sul', '48', 'Lumiar'),
  L('sul', '49', 'Rio Bonito'),
  // Oeste
  L('oeste', '50', 'São Geraldo'),
  L('oeste', '51', 'Córrego Dantas'),
  L('oeste', '52', 'Santa Bernadete'),
  L('oeste', '53', 'Conquista'),
  L('oeste', '54', 'Pilões'),
  L('oeste', '55', 'São Lourenço'),
  L('oeste', '57', 'Rio Grande de Cima'),
  L('oeste', '58', 'Campo do Coelho'),
];

/** Linhas que possuem tabela "C" (circular) na FAOL. */
export const CIRCULAR_TABLE_LINES = new Set(['24', '27', '42', '43', '48', '53', '54']);

export const REGION_LABEL: Record<RegionId, string> = Object.fromEntries(
  REGIONS.map((r) => [r.id, r.label]),
) as Record<RegionId, string>;

/** "04C" -> "4C", "58-A" -> "58", "10 Olaria" -> "10" */
export function lineKey(input: unknown): string {
  if (input === null || input === undefined) return '';
  const m = String(input).match(/(?<!\d)(\d{1,3})([A-Za-z])?(?![A-Za-z0-9])/);
  if (!m) return '';
  return `${parseInt(m[1], 10)}${(m[2] || '').toUpperCase()}`;
}

const KEYS = new Set(FAOL_LINES.map((l) => lineKey(l.code)));

export function isKnownKey(key: string): boolean {
  return KEYS.has(key);
}

/** Resolve para uma chave do catálogo; "58A" (ramal) cai em "58". */
export function resolveLineKey(input: unknown): string {
  const k = lineKey(input);
  if (!k) return '';
  if (KEYS.has(k)) return k;
  const base = k.replace(/[A-Z]$/, '');
  return KEYS.has(base) ? base : k;
}

export function findLine(codeOrKey: string): FaolLine | undefined {
  const k = lineKey(codeOrKey);
  return FAOL_LINES.find((l) => lineKey(l.code) === k);
}

// ---------- Casos especiais ----------
export const CIRCULAR_MAIN = new Set(['100', '200', '400', '500']);

export const CIRCULAR_NOTE =
  'Linha circular. Os horários seguem a tabela original da FAOL; em caso de dúvida, abra a tabela original.';

const DAY_REPLACEMENTS: { code: string; day: DayCode; text: string; related: string[] }[] = [
  {
    code: '54',
    day: 'D',
    text: 'Aos domingos a linha 54 não tem tabela própria: o atendimento é feito pelas linhas 53, 55 e 500.',
    related: ['53', '55', '500'],
  },
];

/** Dia em que a linha não tem tabela e é atendida por outras. */
export function dayReplacement(code: string, day: DayCode) {
  return DAY_REPLACEMENTS.find((r) => r.code === code && r.day === day);
}
