/**
 * Gera `snapshots/faol.json`: avisos, links e todas as tabelas de horários da FAOL já interpretados,
 * usando os MESMOS parsers do app. Rode com `npm run snapshot:faol` (ou pelo workflow "FAOL snapshot").
 *
 * O app só consome esse arquivo se `FAOL_SNAPSHOT_URL` (src/config.ts) estiver preenchida.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { JSDOM } from 'jsdom';
import { FAOL_LINES, lineKey } from '../src/data/faolLines';
import { parseAlerts } from '../src/services/faol/alerts';
import { FAOL_HORARIOS_URL, faolTableUrl } from '../src/services/faol/constants';
import { parseLinks } from '../src/services/faol/links';
import { daysForLine } from '../src/services/faol/schedule';
import { hasDepartures, parseTimetable } from '../src/services/faol/timetableParser';
import type { FaolSnapshot, Timetable } from '../src/types';

const OUT = process.env.SNAPSHOT_OUT ?? 'snapshots/faol.json';
const MIN_TABLES = Number(process.env.SNAPSHOT_MIN_TABLES ?? 20);
const DELAY_MS = Number(process.env.SNAPSHOT_DELAY_MS ?? 250);
const UA = 'Mozilla/5.0 (compatible; WhereIsMyBus-snapshot/1.0; +https://github.com/d3l1nk/Friburgo-Bus)';

// os parsers usam o DOMParser do navegador; no Node ele vem do jsdom
Object.assign(globalThis, { DOMParser: new JSDOM('').window.DOMParser });

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function get(url: string): Promise<{ ok: boolean; status: number; text: string }> {
  try {
    const res = await fetch(url, { headers: { 'user-agent': UA, 'accept-language': 'pt-BR' } });
    return { ok: res.ok, status: res.status, text: await res.text() };
  } catch (e: unknown) {
    console.warn(`  falhou: ${url} (${e instanceof Error ? e.message : String(e)})`);
    return { ok: false, status: 0, text: '' };
  }
}

async function main() {
  console.log(`Baixando ${FAOL_HORARIOS_URL}`);
  const home = await get(FAOL_HORARIOS_URL);
  if (!home.ok) throw new Error(`Página de horários indisponível (HTTP ${home.status}).`);
  const alerts = parseAlerts(home.text);
  const links = parseLinks(home.text);
  console.log(`  ${alerts.length} avisos, ${Object.keys(links).length} linhas com links`);

  const tables: Record<string, Timetable> = {};
  let attempted = 0;
  for (const line of FAOL_LINES) {
    for (const day of daysForLine(line.code)) {
      if (line.code === '54' && day === 'D') continue; // atendida pelas linhas 53/55/500
      attempted++;
      const urls = [links[lineKey(line.code)]?.[day], faolTableUrl(line.code, day)].filter(
        (u): u is string => !!u,
      );
      for (const url of [...new Set(urls)]) {
        await sleep(DELAY_MS);
        const r = await get(url);
        if (!r.ok) continue;
        const table = { ...parseTimetable(r.text, line.code, day), sourceUrl: url };
        if (hasDepartures(table)) {
          tables[`${line.code}-${day}`] = table;
          break;
        }
      }
    }
  }
  const count = Object.keys(tables).length;
  console.log(`Tabelas com horários: ${count}/${attempted}`);
  if (count < MIN_TABLES) {
    throw new Error(
      `Apenas ${count} tabelas (mínimo ${MIN_TABLES}): o layout da FAOL pode ter mudado. Snapshot NÃO gravado.`,
    );
  }

  const snapshot: FaolSnapshot = { version: 1, generatedAt: Date.now(), alerts, links, tables };
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(snapshot));
  console.log(`Gravado: ${OUT}`);
}

main().catch((e: unknown) => {
  console.error(`ERRO: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
