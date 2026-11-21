// Utilidades de DOM sem dependência de Capacitor: funcionam no app, nos testes (jsdom) e em scripts Node.
const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

const BLOCK = new Set([
  'P', 'DIV', 'LI', 'UL', 'OL', 'TR', 'TABLE', 'TBODY', 'THEAD', 'TFOOT', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'BR', 'HR', 'DT', 'DD', 'BLOCKQUOTE', 'FORM', 'MAIN', 'ASIDE', 'NAV',
]); // prettier-ignore

export const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
export const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
export const escHtml = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function parseHtml(html: string): Document {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script,style,noscript,svg').forEach((n) => n.remove());
  return doc;
}

/** Converte um elemento em linhas de texto, quebrando em elementos de bloco. */
export function textLines(root: Node): string[] {
  const out: string[] = [];
  let buf = '';
  const flush = () => {
    const t = clean(buf);
    if (t) out.push(t);
    buf = '';
  };
  const walk = (n: Node) => {
    if (n.nodeType === TEXT_NODE) {
      buf += ' ' + (n.nodeValue ?? '');
      return;
    }
    if (n.nodeType !== ELEMENT_NODE) return;
    const el = n as Element;
    const isBlock = BLOCK.has(el.tagName);
    if (isBlock) flush();
    el.childNodes.forEach(walk);
    if (isBlock) flush();
  };
  walk(root);
  flush();
  return out;
}
