import { LocalNotifications } from '@capacitor/local-notifications';
import { getJSON, setJSON } from '../lib/storage';
import { ESTACAO_LIVRE, haversine } from '../lib/geo';
import { dayTypeOf } from '../lib/time';
import { dayReplacement, lineKey } from '../data/faolLines';
import { getTimetable } from './faolScraper';
import type { AlertRule, MerusVehicle } from '../types';

const RULES_KEY = 'alerts:rules:v1';
const MAX_PER_RULE = 60;

export const ESTACAO_LIVRE_STOP = { id: 'estacao-livre', name: 'Estação Livre (ponto final)', lat: ESTACAO_LIVRE.lat, lng: ESTACAO_LIVRE.lng };

export async function loadRules(): Promise<AlertRule[]> {
  return (await getJSON<AlertRule[]>(RULES_KEY)) ?? [];
}
export const saveRules = (rules: AlertRule[]) => setJSON(RULES_KEY, rules);

export function newRule(existing: AlertRule[], partial: Omit<AlertRule, 'id' | 'nid' | 'createdAt' | 'enabled'>): AlertRule {
  const nid = Math.max(0, ...existing.map((r) => r.nid)) + 1;
  return { ...partial, id: `r${Date.now().toString(36)}${nid}`, nid, enabled: true, createdAt: Date.now() };
}

export async function ensurePermission(): Promise<boolean> {
  try {
    const cur = await LocalNotifications.checkPermissions();
    if (cur.display === 'granted') return true;
    const req = await LocalNotifications.requestPermissions();
    return req.display === 'granted';
  } catch {
    return false;
  }
}

export async function notifyNow(title: string, body: string, id = Math.floor(Math.random() * 1e6) + 2_000_000): Promise<void> {
  try {
    await LocalNotifications.schedule({
      notifications: [{ id, title, body, schedule: { at: new Date(Date.now() + 400), allowWhileIdle: true } }],
    });
  } catch {
    /* sem permissão */
  }
}

export async function cancelRule(rule: AlertRule): Promise<void> {
  try {
    const { notifications } = await LocalNotifications.getPending();
    const mine = notifications.filter((n) => n.id >= rule.nid * 1000 && n.id < rule.nid * 1000 + 1000);
    if (mine.length) await LocalNotifications.cancel({ notifications: mine.map((n) => ({ id: n.id })) });
  } catch {
    /* ignora */
  }
}

/** Agenda os avisos de saída (hoje e amanhã) a partir da tabela da FAOL. Funciona com o app fechado. */
export async function scheduleRule(rule: AlertRule): Promise<number> {
  await cancelRule(rule);
  if (!rule.enabled || rule.type !== 'schedule') return 0;
  const lead = rule.leadMin ?? 0;
  const now = Date.now();
  const items: { at: Date; body: string }[] = [];

  for (let offset = 0; offset <= 1; offset++) {
    const base = new Date();
    base.setDate(base.getDate() + offset);
    const day = dayTypeOf(base);
    if (dayReplacement(rule.lineCode, day)) continue;
    const { table } = await getTimetable(rule.lineCode, day);
    const col = table?.columns.find((c) => c.origin === rule.originName) ?? table?.columns.find((c) => c.isTerminal) ?? table?.columns[0];
    if (!col) continue;
    for (const d of col.departures) {
      const at = new Date(base.getFullYear(), base.getMonth(), base.getDate(), Math.floor(d.minutes / 60), d.minutes % 60, 0);
      at.setTime(at.getTime() - lead * 60000);
      if (at.getTime() > now + 5000) {
        items.push({ at, body: `Linha ${rule.lineCode} sai de ${col.origin} às ${d.time}${lead ? ` (em ${lead} min)` : ''}.` });
      }
    }
  }
  const batch = items.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, MAX_PER_RULE);
  if (!batch.length) return 0;
  try {
    await LocalNotifications.schedule({
      notifications: batch.map((it, i) => ({
        id: rule.nid * 1000 + i,
        title: `Where is my bus? · Linha ${rule.lineCode}`,
        body: it.body,
        schedule: { at: it.at, allowWhileIdle: true },
        extra: { ruleId: rule.id },
      })),
    });
    return batch.length;
  } catch {
    return 0;
  }
}

export async function rescheduleAll(rules: AlertRule[]): Promise<void> {
  for (const r of rules) if (r.type === 'schedule') await scheduleRule(r);
}

// ---------------------------------------------------------------------
// Avisos por GPS (app aberto): ônibus saiu do ponto final / está passando no ponto
// ---------------------------------------------------------------------
const inside = new Map<string, boolean>();
const lastFired = new Map<string, number>();
const COOLDOWN_MS = 5 * 60 * 1000;

export function hasLiveRules(rules: AlertRule[]): boolean {
  return rules.some((r) => r.enabled && (r.type === 'depart' || r.type === 'pass'));
}

/** Compara a posição dos ônibus com os pontos vigiados e dispara notificações. Retorna mensagens (para toast). */
export function evaluateLiveRules(rules: AlertRule[], vehicles: MerusVehicle[]): string[] {
  const fired: string[] = [];
  for (const r of rules) {
    if (!r.enabled || (r.type !== 'depart' && r.type !== 'pass')) continue;
    const point = r.stop ?? ESTACAO_LIVRE_STOP;
    const key = lineKey(r.lineCode);
    const radius = r.radius ?? (r.type === 'depart' ? 150 : 300);
    for (const v of vehicles) {
      if (v.lineKey !== key) continue;
      const k = `${r.id}|${v.id}`;
      const dist = haversine(point, v);
      const was = inside.get(k) ?? false;
      const now = r.type === 'depart' ? (dist <= radius ? true : dist > radius + 100 ? false : was) : dist <= radius;
      inside.set(k, now);
      const trigger = r.type === 'depart' ? was && !now : !was && now;
      if (!trigger) continue;
      if (Date.now() - (lastFired.get(k) ?? 0) < COOLDOWN_MS) continue;
      lastFired.set(k, Date.now());
      const msg =
        r.type === 'depart'
          ? `O ônibus da linha ${r.lineCode} acabou de sair de ${point.name}.`
          : `Ônibus da linha ${r.lineCode} a ${Math.round(dist / 10) * 10} m de ${point.name}.`;
      fired.push(msg);
      void notifyNow(`Linha ${r.lineCode}`, msg);
    }
  }
  return fired;
}

export function describeRule(r: AlertRule): string {
  if (r.type === 'schedule') return `Saída de ${r.originName ?? 'Estação Livre'}${r.leadMin ? `, ${r.leadMin} min antes` : ', na hora'}`;
  if (r.type === 'depart') return `Ônibus saiu de ${(r.stop ?? ESTACAO_LIVRE_STOP).name}`;
  return `Ônibus passando em ${r.stop?.name ?? 'ponto'} (${r.radius ?? 300} m)`;
}
