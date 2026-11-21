import { resolveLineKey } from '../../data/faolLines';
import type { DayCode, FaolLinks } from '../../types';
import { modalContainers, modalKey } from './alerts';
import { FAOL_HORARIOS_URL } from './constants';
import { clean, parseHtml, textLines } from './dom';

// Links reais das tabelas (botões Dias Úteis / Sábado / Domingo / Circular)
const TABLE_HREF = /tabelas\/([^/?#]+?)-([USDC])(?:[/?#.]|$)/i;
const DAY_TEXT: [RegExp, DayCode][] = [
  [/dias?\s*[uú]teis/i, 'U'],
  [/s[aá]bado/i, 'S'],
  [/domingo/i, 'D'],
  [/circular/i, 'C'],
];

const usable = (href: string | null): href is string =>
  !!href && !/^(#|javascript:|mailto:|tel:)/i.test(href.trim());

export function parseLinks(html: string): FaolLinks {
  const doc = parseHtml(html);
  const links: FaolLinks = {};
  const add = (key: string, day: DayCode, href: string) => {
    try {
      const url = new URL(href, FAOL_HORARIOS_URL).toString();
      if (!links[key]) links[key] = {};
      if (!links[key][day]) links[key][day] = url;
    } catch {
      /* href inválido */
    }
  };

  // a) qualquer link no padrão /tabelas/{LINHA}-{DIA}
  doc.querySelectorAll('a[href]').forEach((a) => {
    const href = a.getAttribute('href');
    if (!usable(href)) return;
    const m = href.match(TABLE_HREF);
    if (!m) return;
    const key = resolveLineKey(m[1]);
    if (key) add(key, m[2].toUpperCase() as DayCode, href);
  });

  // b) links fora do padrão, identificados pelo texto do botão dentro do modal da linha
  for (const c of modalContainers(doc)) {
    const key = modalKey(c, textLines(c));
    if (!key) continue;
    c.querySelectorAll('a[href]').forEach((a) => {
      const href = a.getAttribute('href');
      if (!usable(href) || TABLE_HREF.test(href)) return;
      const txt = clean(a.textContent ?? '');
      const hit = DAY_TEXT.find(([re]) => re.test(txt));
      if (hit) add(key, hit[1], href);
    });
  }
  return links;
}
