import { Bell, ChevronRight, ExternalLink, Info, MessageSquareWarning, Terminal } from 'lucide-react';
import AppIcon from '../../components/ui/AppIcon';
import AlertsScreen from '../alerts/AlertsScreen';
import FeedbackScreen from './FeedbackScreen';
import AboutScreen from './AboutScreen';
import DiagnosticTab from '../diagnostic/DiagnosticTab';
import { Header } from '../../components/ui/ui';
import { APP_NAME, APP_VERSION, DIAGNOSTICS_ENABLED, FAOL_CHANNEL_URL } from '../../config';
import { openExternal } from '../../lib/openUrl';
import type { GeoFix } from '../../lib/geo';
import type { AlertRule, Favorites, SettingsView } from '../../types';

interface Props {
  view: SettingsView;
  setView: (v: SettingsView) => void;
  rules: AlertRule[];
  addRule: (
    p: Omit<AlertRule, 'id' | 'nid' | 'createdAt' | 'enabled'>,
  ) => Promise<{ count: number; granted: boolean }>;
  removeRule: (id: string) => Promise<void>;
  toggleRule: (id: string) => Promise<void>;
  favStops: Favorites['stops'];
  prefillLine: string | null;
  geo: GeoFix | null;
}

export default function SettingsTab(p: Props) {
  const back = () => p.setView('main');
  if (p.view === 'alerts')
    return (
      <AlertsScreen
        rules={p.rules}
        add={p.addRule}
        remove={p.removeRule}
        toggle={p.toggleRule}
        favStops={p.favStops}
        prefillLine={p.prefillLine}
        onBack={back}
      />
    );
  if (p.view === 'feedback') return <FeedbackScreen onBack={back} prefillLine={p.prefillLine} />;
  if (p.view === 'about') return <AboutScreen onBack={back} />;
  if (p.view === 'diag' && DIAGNOSTICS_ENABLED) return <DiagnosticTab geo={p.geo} />;

  const Item = ({
    icon,
    title,
    sub,
    onClick,
    external,
  }: {
    icon: React.ReactNode;
    title: string;
    sub?: string;
    onClick: () => void;
    external?: boolean;
  }) => (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3.5 text-left border-b border-ink-700 last:border-0 active:bg-ink-700"
    >
      <span className="h-10 w-10 rounded-xl bg-ink-700 grid place-items-center text-route">{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block font-medium">{title}</span>
        {sub && <span className="block text-xs text-slate-400 mt-0.5">{sub}</span>}
      </span>
      {external ? (
        <ExternalLink size={18} className="text-slate-500" />
      ) : (
        <ChevronRight size={20} className="text-slate-500" />
      )}
    </button>
  );

  return (
    <div className="flex flex-col h-full">
      <Header title="Configurações" />
      <div className="scroll-y flex-1 px-4 py-4 space-y-4">
        <div className="flex items-center gap-3 rounded-2xl bg-ink-800 border border-ink-600 p-4">
          <div className="rounded-2xl overflow-hidden shrink-0">
            <AppIcon size={56} />
          </div>
          <div>
            <div className="font-sign text-xl font-semibold leading-tight">{APP_NAME}</div>
            <div className="text-xs text-slate-400">Versão {APP_VERSION}</div>
          </div>
        </div>

        <div className="rounded-2xl bg-ink-800 border border-ink-600 overflow-hidden">
          <Item
            icon={<Bell size={20} />}
            title="Meus alertas"
            sub={`${p.rules.filter((r) => r.enabled).length} ativos · saídas e passagem de ônibus`}
            onClick={() => p.setView('alerts')}
          />
          <Item
            icon={<ExternalLink size={20} />}
            title="Canal de avisos da FAOL"
            sub="Informações oficiais da concessionária"
            onClick={() => void openExternal(FAOL_CHANNEL_URL)}
            external
          />
          <Item
            icon={<MessageSquareWarning size={20} />}
            title="Reclamações e sugestões"
            sub="Fale com o responsável pelo app"
            onClick={() => p.setView('feedback')}
          />
          <Item
            icon={<Info size={20} />}
            title="Sobre o app"
            sub="Versão, créditos e aviso legal"
            onClick={() => p.setView('about')}
          />
          {DIAGNOSTICS_ENABLED && (
            <Item
              icon={<Terminal size={20} />}
              title="Diagnóstico (desenvolvedor)"
              onClick={() => p.setView('diag')}
            />
          )}
        </div>
      </div>
    </div>
  );
}
