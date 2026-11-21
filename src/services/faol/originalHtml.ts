import { clean, escHtml } from './dom';

// Tabela original higienizada (exibida dentro do app): só tags permitidas, sem atributos
// (exceto colspan/rowspan numéricos) e com o texto escapado.
const KEEP = new Set(['TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TH', 'TD', 'CAPTION', 'P', 'BR', 'STRONG', 'B', 'EM', 'I', 'SPAN', 'DIV', 'UL', 'OL', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6']); // prettier-ignore
const MAX_CHARS = 250000;

function safeHtml(n: Node): string {
  if (n.nodeType === 3) return escHtml(n.nodeValue ?? '');
  if (n.nodeType !== 1) return '';
  const el = n as Element;
  const inner = [...el.childNodes].map(safeHtml).join('');
  if (!KEEP.has(el.tagName)) return inner;
  const tag = el.tagName.toLowerCase();
  if (tag === 'br') return '<br>';
  let attrs = '';
  for (const a of ['colspan', 'rowspan']) {
    const v = el.getAttribute(a);
    if (v && /^\d{1,2}$/.test(v)) attrs += ` ${a}="${v}"`;
  }
  return `<${tag}${attrs}>${inner}</${tag}>`;
}

export function extractOriginalHtml(doc: Document, lines: string[]): string {
  const tables = [...doc.querySelectorAll('table')].filter(
    (t) => t.rows.length >= 2 && !t.querySelector('table'),
  );
  const html = tables.length
    ? tables.map(safeHtml).join('')
    : lines
        .slice(0, 300)
        .map((l) => `<p>${escHtml(clean(l))}</p>`)
        .join('');
  return html.slice(0, MAX_CHARS);
}
