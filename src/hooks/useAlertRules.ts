import { useEffect, useRef, useState } from 'react';
import {
  cancelRule,
  ensurePermission,
  loadRules,
  newRule,
  rescheduleAll,
  saveRules,
  scheduleRule,
} from '../services/notifications';
import type { AlertRule, NewAlertRule } from '../types';

export function useAlertRules() {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const ref = useRef<AlertRule[]>([]);
  ref.current = rules;

  useEffect(() => {
    loadRules().then((r) => {
      setRules(r);
      void rescheduleAll(r); // renova os avisos agendados a cada abertura do app
    });
  }, []);

  const persist = (next: AlertRule[]) => {
    setRules(next);
    void saveRules(next);
  };

  const add = async (p: NewAlertRule) => {
    const granted = await ensurePermission();
    const rule = newRule(ref.current, p);
    const count = granted && rule.type === 'schedule' ? await scheduleRule(rule) : 0;
    persist([...ref.current, rule]);
    return { count, granted };
  };

  const remove = async (id: string) => {
    const r = ref.current.find((x) => x.id === id);
    if (r) await cancelRule(r);
    persist(ref.current.filter((x) => x.id !== id));
  };

  const toggle = async (id: string) => {
    const next = ref.current.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r));
    persist(next);
    const r = next.find((x) => x.id === id);
    if (r && r.type === 'schedule') await (r.enabled ? scheduleRule(r) : cancelRule(r));
  };

  return { rules, add, remove, toggle };
}
