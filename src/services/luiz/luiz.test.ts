import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MerusVehicle, Timetable } from '../../types';
import { luizAnswer, type LuizContext, type LuizMemory, type LuizSources } from './index';
import { classifyIntent, detectDay, detectLines, norm } from './nlu';

const veh = (id: string, lineKey: string, lat: number, lng: number, direction = 'Sentido Rodoviária'): MerusVehicle => ({
  id, lineKey, lineLabel: lineKey, lineName: '', lat, lng, heading: null, direction, speed: null, updatedAt: '', raw: {},
}); // prettier-ignore

const ctx: LuizContext = {
  pos: { lat: -22.2818, lng: -42.5311 },
  vehicles: [
    veh('A1', '58', -22.283, -42.535),
    veh('A2', '58', -22.29, -42.54),
    veh('B1', '10', -22.28, -42.53),
  ],
  alerts: [{ lineKey: '10', kind: 'ALTERAÇÃO', text: 'Passando pela Av. Roberto Silveira' }],
  favLines: ['58', '10'],
};

const table: Timetable = {
  code: '58',
  day: 'U',
  fetchedAt: 1,
  legend: [],
  columns: [
    { origin: 'Estação Livre', isTerminal: true, departures: [{ time: '04:00', minutes: 240 }, { time: '23:00', minutes: 1380 }] },
    { origin: 'Saibreira', isTerminal: false, departures: [{ time: '04:10', minutes: 250 }] },
  ],
}; // prettier-ignore

const sources = (t: Timetable | null = table): LuizSources => ({
  getTimetable: vi.fn().mockResolvedValue({ table: t, fromCache: false }),
  getNearbyStops: vi.fn().mockResolvedValue({
    stops: [{ id: '1', name: 'Rua A', lat: 0, lng: 0, lines: [], distance: 120 }],
    fromCache: true,
    savedAt: 1,
  }),
});
const ask = (t: string, mem: LuizMemory = {}, s = sources(), c = ctx) => luizAnswer(t, c, mem, s);
const labels = (r: { actions?: { label: string }[] }) => (r.actions ?? []).map((a) => a.label);

describe('NLU', () => {
  it('norm remove acentos e caixa', () => expect(norm('  ÔNIBUS Cônego ')).toBe('onibus conego'));

  it('detectLines: por número, por "linha N" e por bairro', () => {
    expect(detectLines('onibus 58').map((l) => l.code)).toEqual(['58']);
    expect(detectLines('linha 4c').map((l) => l.code)).toEqual(['04C']);
    expect(detectLines('onde esta o conego').map((l) => l.code)).toEqual(['43']);
    expect(detectLines('quando sai de 10:30')).toEqual([]); // horário não é linha
    expect(detectLines('oi')).toEqual([]);
  });

  it('detectLines: bairro ambíguo devolve várias linhas', () => {
    expect(
      detectLines('olaria')
        .map((l) => l.code)
        .sort(),
    ).toEqual(['10', '100']);
  });

  it('detectDay', () => {
    expect(detectDay('horario no sabado')).toBe('S');
    expect(detectDay('domingo')).toBe('D');
    expect(detectDay('nos dias uteis')).toBe('U');
    expect(detectDay('horario', 'S')).toBe('S');
  });

  it.each([
    ['oi', 'greeting'],
    ['obrigado', 'thanks'],
    ['quero fazer uma reclamacao', 'feedback'],
    ['quem criou o app', 'about'],
    ['canal da faol', 'faol'],
    ['ajuda', 'help'],
    ['desvio da linha 10', 'desvio'],
    ['me avisa quando passar', 'alert'],
    ['pontos perto de mim', 'stops'],
    ['onde esta a linha 58', 'live'],
    ['proximo onibus da linha 58', 'next'],
    ['blablabla', 'none'],
  ])('classifyIntent(%s) = %s', (txt, intent) => expect(classifyIntent(norm(txt))).toBe(intent));
});

describe('Luiz: conversa', () => {
  it('saudação, ajuda e agradecimento', async () => {
    expect((await ask('oi')).text).toContain('Sou o Luiz'.replace('Sou', 'Eu sou'));
    expect((await ask('ajuda')).text).toContain('não são enviadas para a internet');
    expect((await ask('valeu')).text).toContain('Por nada');
  });

  it('só o número da linha mostra o resumo com botões', async () => {
    const r = await ask('linha 58');
    expect(r.text).toContain('Linha 58 · Campo do Coelho');
    expect(r.text).toContain('2 ônibus com GPS');
    expect(labels(r)).toEqual(['Próxima saída', 'Ao vivo', 'Abrir linha', 'Criar alerta']);
  });

  it('ao vivo: conta ônibus, sentidos e oferece mapa', async () => {
    const r = await ask('onde está a linha 58');
    expect(r.text).toContain('2 ônibus rodando');
    expect(r.text).toContain('Sentido Rodoviária');
    expect(r.actions?.[0]).toEqual({ label: 'Ver no mapa', kind: 'map', payload: '58' });
  });

  it('ao vivo geral e sem sinal', async () => {
    expect((await ask('ônibus ao vivo')).text).toContain('3 ônibus com GPS agora em 2 linhas');
    expect((await ask('ônibus ao vivo', {}, sources(), { ...ctx, vehicles: [] })).text).toContain(
      'Não estou recebendo sinal',
    );
  });

  it('desvio por linha e geral; linha sem aviso aponta o canal oficial', async () => {
    expect((await ask('desvio da linha 10')).text).toContain('Roberto Silveira');
    expect((await ask('desvios hoje')).text).toContain('Há avisos em 1 linha: 10');
    expect(labels(await ask('desvio da linha 58'))).toEqual(['Canal da FAOL']);
  });

  describe('próxima saída (relógio fixo: quarta-feira, 12:00)', () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2026, 10, 18, 12, 0, 0));
    });
    afterEach(() => vi.useRealTimers());

    it('hoje: mostra a próxima saída de cada origem com a contagem', async () => {
      const s = sources();
      const r = await ask('próximo ônibus da linha 58', {}, s);
      expect(s.getTimetable).toHaveBeenCalledWith('58', 'U');
      expect(r.text).toContain('hoje Dias úteis');
      expect(r.text).toContain('• Estação Livre: 23:00 (em 660 min)');
      expect(r.text).toContain('• Saibreira: sem mais saídas hoje.');
      expect(r.text).toContain('2 ônibus desta linha com GPS agora');
      expect(labels(r)).toEqual(['Ver no mapa', 'Abrir horários', 'Criar alerta']);
    });

    it('outro dia: lista as primeiras saídas', async () => {
      const s = sources();
      const r = await ask('próximo ônibus da linha 58 no sábado', {}, s);
      expect(s.getTimetable).toHaveBeenCalledWith('58', 'S');
      expect(r.text).toContain('Sábado');
      expect(r.text).toContain('• Estação Livre: 04:00, 23:00…');
    });
  });

  it('sem tabela: mensagem de falha com atalho para abrir a linha', async () => {
    const r = await ask('próximo ônibus da linha 58', {}, sources(null));
    expect(r.text).toContain('Não consegui carregar a tabela');
    expect(labels(r)).toContain('Abrir horários');
  });

  it('linha 54 no domingo explica a substituição', async () => {
    const r = await ask('horário da linha 54 no domingo');
    expect(r.text).toContain('53, 55 e 500');
    expect(r.actions?.map((a) => a.payload)).toEqual(['53', '55', '500']);
  });

  it('pergunta pendente: "de qual linha?" e depois só "58"', async () => {
    const mem: LuizMemory = {};
    const first = await ask('quando passa o ônibus', mem);
    expect(first.text).toContain('De qual linha');
    expect(mem.pending).toBe('next');
    expect(labels(first)).toEqual(['Linha 58', 'Linha 10']);
    const second = await ask('58', mem);
    expect(second.text).toContain('Linha 58');
    expect(mem.pending).toBeUndefined();
  });

  it('lembra a última linha em perguntas de continuação', async () => {
    const mem: LuizMemory = {};
    await ask('linha 58', mem);
    expect((await ask('e o horário também?', mem)).text).toContain('Linha 58');
  });

  it('bairro ambíguo pede para escolher', async () => {
    const r = await ask('próximo ônibus olaria');
    expect(r.text).toContain('mais de uma linha');
    expect(r.actions?.length).toBe(2);
  });

  it('alertas, feedback, sobre e canal abrem as ações certas', async () => {
    expect((await ask('me avisa quando o 58 passar')).actions?.[0]).toEqual({
      label: 'Criar alerta',
      kind: 'alert',
      payload: '58',
    });
    expect((await ask('quero reclamar')).actions?.[0].kind).toBe('feedback');
    expect((await ask('quem criou o app?')).text).toContain('Marcos Raminelly');
    expect((await ask('qual o canal da faol')).actions?.[0].kind).toBe('faol');
  });

  it('pontos perto: usa a fonte; falha vira mensagem amigável', async () => {
    expect((await ask('pontos perto de mim')).text).toContain('Rua A (120 m)');
    const broken: LuizSources = { ...sources(), getNearbyStops: vi.fn().mockRejectedValue(new Error('x')) };
    expect((await ask('pontos perto de mim', {}, broken)).text).toContain('Não consegui buscar os pontos');
  });

  it('frase desconhecida e entrada vazia não quebram', async () => {
    expect((await ask('blablabla')).text).toContain('Não entendi');
    expect((await ask('')).text).toContain('Não entendi');
  });
});
