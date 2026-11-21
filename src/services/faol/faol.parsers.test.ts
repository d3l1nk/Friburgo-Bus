import { describe, expect, it } from 'vitest';
import { parseAlerts } from './alerts';
import { parseLinks } from './links';
import { extractOriginalHtml } from './originalHtml';
import { parseHtml, textLines } from './dom';
import { daysForLine, nextByColumn } from './schedule';
import { hasDepartures, parseFlow, parseTimetable, tokenizeCell } from './timetableParser';
import circular from './__fixtures__/timetable-circular.html?raw';
import empty from './__fixtures__/timetable-empty.html?raw';
import flow from './__fixtures__/timetable-flow.html?raw';
import horarios from './__fixtures__/horarios-page.html?raw';
import malformed from './__fixtures__/timetable-malformed.html?raw';
import repeated from './__fixtures__/timetable-repeated-header.html?raw';
import twoRow from './__fixtures__/timetable-two-row-header.html?raw';

const times = (c: { departures: { time: string; ramal?: string }[] }) =>
  c.departures.map((d) => d.time + (d.ramal ?? ''));

describe('tokenizeCell', () => {
  it('minutos soltos usam a hora da linha', () => {
    expect(tokenizeCell('00 15 30', 4).map((d) => d.time)).toEqual(['04:00', '04:15', '04:30']);
  });
  it('lê ramais colados, com hífen ou parênteses', () => {
    expect(tokenizeCell('15A 30-B 45(C)', 7).map((d) => `${d.time}${d.ramal}`)).toEqual([
      '07:15A',
      '07:30B',
      '07:45C',
    ]);
  });
  it('horários completos ignoram a hora da linha', () => {
    expect(tokenizeCell('04:15 05:45', 9).map((d) => d.time)).toEqual(['04:15', '05:45']);
  });
  it('descarta valores inválidos e células sem número', () => {
    expect(tokenizeCell('-', 4)).toEqual([]);
    expect(tokenizeCell('', 4)).toEqual([]);
    expect(tokenizeCell('75', 4)).toEqual([]); // minuto > 59
    expect(tokenizeCell('15', null)).toEqual([]); // sem hora conhecida
  });
  it('horas depois da meia-noite (24+) viram 00+', () => {
    expect(tokenizeCell('00 30', 24).map((d) => d.time)).toEqual(['00:00', '00:30']);
  });
});

describe('parseTimetable: cabeçalho de 2 linhas com colspan', () => {
  const t = parseTimetable(twoRow, '58', 'U');
  it('cada coluna recebe o nome real do bairro e a Estação Livre vem primeiro', () => {
    expect(t.columns.map((c) => c.origin)).toEqual([
      'Estação Livre',
      'Saibreira',
      'M.Bonita',
      'Campo do Coelho',
    ]);
    expect(t.columns[0].isTerminal).toBe(true);
    expect(t.columns.slice(1).every((c) => !c.isTerminal)).toBe(true);
  });
  it('separa a Faixa Horária das saídas reais', () => {
    expect(times(t.columns[0])).toEqual(['04:00', '04:40', '05:10', '05:50', '23:30']);
    expect(times(t.columns[1])).toEqual(['04:10', '05:15A']);
    expect(times(t.columns[3])).toEqual(['04:30', '05:35B']);
  });
  it('lê a legenda de ramais', () => {
    expect(t.legend.map((l) => l.code)).toEqual(['58', '58-A', '58-B']);
    expect(t.legend.find((l) => l.code === '58-A')?.label).toBe('Campo do Coelho Via Maria Bonita');
  });
  it('guarda a tabela original higienizada', () => {
    expect(t.originalHtml).toContain('<table>');
    expect(t.originalHtml).toContain('Saibreira');
  });
});

describe('parseTimetable: cabeçalho repetido sem colspan', () => {
  it('não mescla colunas diferentes sob o mesmo nome', () => {
    const t = parseTimetable(repeated, '58', 'U');
    expect(t.columns.map((c) => c.origin)).toEqual(['Estação Livre', 'Saibreira', 'M.Bonita']);
    expect(times(t.columns[0])).toEqual(['06:00', '06:30', '07:00']);
  });
});

describe('parseTimetable: texto corrido', () => {
  it('ignora a coluna de faixa horária e atribui saídas à última origem declarada', () => {
    const t = parseTimetable(flow, '58', 'U');
    expect(t.columns.map((c) => c.origin)).toEqual(['Estação Livre', 'Saibreira']);
    expect(times(t.columns[0])).toEqual(['04:00', '04:30', '05:15']);
    expect(times(t.columns[1])).toEqual(['04:10', '04:40', '05:10']);
  });
  it('parseFlow sem filtro de faixa devolve também as horas cheias', () => {
    const lines = textLines(parseHtml(flow).body);
    const withFaixa = parseFlow(lines, false).flatMap((c) => times(c));
    expect(withFaixa).toContain('06:00');
    expect(parseFlow(lines, true).flatMap((c) => times(c))).not.toContain('06:00');
  });
});

describe('parseTimetable: circular e casos de borda', () => {
  it('coluna com nome próprio mantém o nome', () => {
    const t = parseTimetable(circular, '100', 'U');
    expect(t.columns.map((c) => c.origin)).toEqual(['Saídas']);
    expect(times(t.columns[0])).toEqual(['04:00', '04:30', '05:00', '05:30']);
  });
  it('coluna sem nome vira "Saídas (circular)" só nas linhas 100/200/400/500', () => {
    const unnamed =
      '<table><tr><th>Faixa Horária</th><th></th></tr><tr><td>04:00</td><td>00 30</td></tr></table>';
    expect(parseTimetable(unnamed, '100', 'U').columns[0].origin).toBe('Saídas (circular)');
    expect(parseTimetable(unnamed, '24', 'C').columns[0].origin).toBe('Partidas');
  });
  it('página sem horários: sem colunas, guarda texto bruto e não conta como tabela', () => {
    const t = parseTimetable(empty, '58', 'U');
    expect(t.columns).toEqual([]);
    expect(t.rawText).toContain('Nenhum horário disponível');
    expect(hasDepartures(t)).toBe(false);
  });
  it('HTML vazio ou só espaços não quebra', () => {
    expect(parseTimetable('', '58', 'U').columns).toEqual([]);
    expect(parseTimetable('   ', '58', 'U').columns).toEqual([]);
  });
  it('HTML malformado é tolerado pelo parser do navegador', () => {
    const t = parseTimetable(malformed, '58', 'U');
    expect(() => hasDepartures(t)).not.toThrow();
    // "04:00"/"05:00" são a Faixa Horária (primeira coluna), não saídas
    expect(t.columns.flatMap(times)).toEqual(['04:10', '04:40', '05:15', '05:45']);
  });
  it('tabela sem linhas de dados é ignorada', () => {
    const t = parseTimetable('<table><tr><th>Faixa</th><th>Saibreira</th></tr></table>', '58', 'U');
    expect(t.columns).toEqual([]);
  });
});

describe('parseAlerts', () => {
  const alerts = parseAlerts(horarios);
  it('extrai ATENÇÃO e ALTERAÇÃO por linha, ignorando <script>', () => {
    expect(alerts).toHaveLength(2);
    expect(alerts.find((a) => a.lineKey === '58')).toMatchObject({ kind: 'ATENÇÃO' });
    expect(alerts.find((a) => a.lineKey === '58')?.text).toContain('Roberto Silveira');
    expect(alerts.find((a) => a.lineKey === '16')).toMatchObject({ kind: 'ALTERAÇÃO' });
    expect(alerts.find((a) => a.lineKey === '16')?.text).toContain('Adelino Alves Amorim');
  });
  it('sem avisos ou HTML vazio devolve lista vazia', () => {
    expect(parseAlerts('<p>tudo normal</p>')).toEqual([]);
    expect(parseAlerts('')).toEqual([]);
  });
  it('remove avisos duplicados', () => {
    const dup = `<div class="modal" id="modal10"><h5>10 Olaria</h5><p>ATENÇÃO: Obra na ponte</p></div>
                 <div class="modal" id="modal10b"><h5>10 Olaria</h5><p>ATENÇÃO: obra  na ponte</p></div>`;
    expect(parseAlerts(dup)).toHaveLength(1);
  });
  it('usa o fallback de página inteira quando não há modais', () => {
    const page = '<h2>10 Olaria / Conselheiro</h2><p>ATENÇÃO: Passando pela ponte nova</p>';
    expect(parseAlerts(page)).toEqual([{ lineKey: '10', kind: 'ATENÇÃO', text: 'Passando pela ponte nova' }]);
  });
});

describe('parseLinks', () => {
  const links = parseLinks(horarios);
  it('extrai links no padrão /tabelas/{LINHA}-{DIA} (relativos e absolutos)', () => {
    expect(links['58'].U).toBe('https://www.faol.com.br/tabelas/58-U');
    expect(links['58'].S).toBe('https://faol.com.br/tabelas/58-S');
    expect(links['4C'].U).toBe('https://www.faol.com.br/tabelas/04C-U');
  });
  it('usa o texto do botão quando o link foge do padrão', () => {
    expect(links['58'].D).toBe('https://www.faol.com.br/outro/domingo58.html');
  });
  it('ignora links vazios (#) e HTML sem links', () => {
    expect(Object.values(links['58'])).toHaveLength(3);
    expect(parseLinks('<p>nada</p>')).toEqual({});
  });
});

describe('extractOriginalHtml (higienização)', () => {
  it('remove scripts, atributos e estilos, mantendo colspan/rowspan', () => {
    const doc = parseHtml(
      '<table onclick="x()" style="color:red"><tr><th colspan="2" class="a">T</th></tr><tr><td rowspan="2"><script>alert(1)</script>1</td><td>2</td></tr></table>',
    );
    const out = extractOriginalHtml(doc, []);
    expect(out).toBe(
      '<table><tbody><tr><th colspan="2">T</th></tr><tr><td rowspan="2">1</td><td>2</td></tr></tbody></table>',
    );
    expect(out).not.toMatch(/script|onclick|style|class/);
  });
  it('escapa texto e usa as linhas quando não há tabela', () => {
    const out = extractOriginalHtml(parseHtml('<p>a</p>'), ['<b>oi</b> & tchau']);
    expect(out).toBe('<p>&lt;b&gt;oi&lt;/b&gt; &amp; tchau</p>');
  });
  it('limita o tamanho', () => {
    const big = Array.from({ length: 300 }, () => 'x'.repeat(2000));
    expect(extractOriginalHtml(parseHtml(''), big).length).toBeLessThanOrEqual(250000);
  });
});

describe('schedule', () => {
  const table = parseTimetable(twoRow, '58', 'U');
  it('nextByColumn: próxima e seguinte saída por origem', () => {
    const rows = nextByColumn(table, 4 * 60 + 30); // 04:30
    const livre = rows.find((r) => r.isTerminal);
    expect(livre?.next?.time).toBe('04:40');
    expect(livre?.after?.time).toBe('05:10');
    expect(livre?.minutesLeft).toBeCloseTo(10);
  });
  it('sem mais saídas no dia', () => {
    const rows = nextByColumn(table, 23 * 60 + 59);
    expect(rows.every((r) => r.next === undefined && r.minutesLeft === undefined)).toBe(true);
  });
  it('saída exatamente agora conta como próxima', () => {
    expect(nextByColumn(table, 4 * 60)[0].next?.time).toBe('04:00');
  });
  it('daysForLine inclui C só nas linhas com tabela circular', () => {
    expect(daysForLine('43')).toEqual(['U', 'S', 'D', 'C']);
    expect(daysForLine('58')).toEqual(['U', 'S', 'D']);
  });
});
