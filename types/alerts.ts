export type AlertRuleType = 'schedule' | 'depart' | 'pass';

export interface AlertRule {
  id: string;
  /** base numérica dos IDs de notificação (único por regra) */
  nid: number;
  type: AlertRuleType;
  lineCode: string;
  enabled: boolean;
  /** schedule: aviso programado antes da saída de uma origem da tabela */
  originName?: string;
  leadMin?: number;
  /** depart/pass: acompanhamento por GPS (app aberto) */
  stop?: { id: string; name: string; lat: number; lng: number };
  radius?: number;
  createdAt: number;
}

export type NewAlertRule = Omit<AlertRule, 'id' | 'nid' | 'createdAt' | 'enabled'>;
