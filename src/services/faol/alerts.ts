import { findLine, isKnownKey, resolveLineKey } from '../../data/faolLines';
import type { FaolAlert } from '../../types';
import { clean, norm, parseHtml, textLines } from './dom';

// =====================================================================
// Alertas (ALTERAÇÃO / ATENÇÃO) em /horarios
// =====================================================================
const ALERT_RE = /^(ALTERA[ÇC][ÃA]O|ATEN[ÇC][ÃA]O)\b\s*[:!\-–—.]*\s*(.*)$/i;
const CODE_RE = /(?<!\d)(\d{2,3}[A-Za-z]?)(?![A-Za-z0-9:])/;

function kindOf(word: string): FaolAlert['kind'] {
  return /^altera/i.test(norm(word)) ? 'ALTERAÇÃO' : 'ATENÇÃO';
}

export function keyFromStrings(strings: (string | null | undefined)[]): string {
  for (const s of strings) {
    if (!s) continue;
    const m = s.match(CODE_RE);
    if (!m) continue;
    const k = resolveLineKey(m[1]);
    if (k && isKnownKey(k)) return k;
  }
  return '';
}

function alertsFromLines(lines: string[], key: string | (() => string)): FaolAlert[] {
  const out: FaolAlert[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(ALERT_RE);
    if (!m) continue;
    let text = m[2];
    let j = i + 1;
    while (!text && j < lines.length && j <= i + 3 && !ALERT_RE.test(lines[j])) {
      text = lines[j];
      j++;
    }
    text = clean(text);
    const k = typeof key === 'function' ? key() : key;
    if (text && k) out.push({ lineKey: k, kind: kindOf(m[1]), text });
  }
  return out;
}

export function modalContainers(doc: Document): HTMLElement[] {
  const all = [...doc.querySelectorAll<HTMLElement>('.modal, [role="dialog"], [id*="modal" i]')];
  return all.filter((c) => !all.some((o) => o !== c && o.contains(c)));
}

export function modalKey(c: HTMLElement, lines: string[]): string {
  const heads = [...c.querySelectorAll('.modal-title, h1, h2, h3, h4, h5, h6')].map((h) => h.textContent);
  return keyFromStrings([
    c.id,
    c.getAttribute('data-linha'),
    c.getAttribute('data-line'),
    c.getAttribute('aria-labelledby'),
    ...heads,
    ...lines.slice(0, 2),
  ]);
}

export function parseAlerts(html: string): FaolAlert[] {
  const doc = parseHtml(html);
  const found: FaolAlert[] = [];

  // 1) Modais por linha
  for (const c of modalContainers(doc)) {
    const lines = textLines(c);
    const key = modalKey(c, lines);
    if (key) found.push(...alertsFromLines(lines, key));
  }

  // 2) Fallback: varre a página inteira acompanhando o cabeçalho da linha corrente
  if (!found.length) {
    const lines = textLines(doc.body);
    let current = '';
    const hdr = /^(?:linha\s*)?(\d{2,3}[A-Za-z]?)\s*[-–—:.]?\s+(.+)$/i;
    const getKey = () => current;
    for (let i = 0; i < lines.length; i++) {
      const h = lines[i].match(hdr);
      if (h) {
        const k = resolveLineKey(h[1]);
        const line = k && isKnownKey(k) ? findLine(k) : undefined;
        const first = line ? norm(line.name).split(/[ /]/)[0] : '';
        if (line && first && norm(h[2]).includes(first)) current = k;
      }
      if (ALERT_RE.test(lines[i])) found.push(...alertsFromLines(lines.slice(i, i + 5), getKey));
    }
  }

  const seen = new Set<string>();
  return found.filter((a) => {
    const id = `${a.lineKey}|${norm(a.text)}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}
