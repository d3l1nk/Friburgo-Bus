import { Clock, MessageCircle, Radar, Settings, Star } from 'lucide-react';
import type { TabId } from '../types';

const TABS: { id: TabId; label: string; Icon: typeof Radar }[] = [
  { id: 'radar', label: 'Radar', Icon: Radar },
  { id: 'lines', label: 'Linhas', Icon: Clock },
  { id: 'luiz', label: 'Luiz', Icon: MessageCircle },
  { id: 'favorites', label: 'Favoritos', Icon: Star },
  { id: 'settings', label: 'Ajustes', Icon: Settings },
];

export default function BottomNav({ tab, onPress }: { tab: TabId; onPress: (id: TabId) => void }) {
  return (
    <nav className="shrink-0 bg-ink-900 border-t border-ink-700 pb-safe">
      <div className="grid grid-cols-5">
        {TABS.map(({ id, label, Icon }) => {
          const on = tab === id;
          return (
            <button
              key={id}
              onClick={() => onPress(id)}
              className={`h-16 flex flex-col items-center justify-center gap-1 text-[11px] font-medium ${on ? 'text-route' : 'text-slate-400'}`}
            >
              <span className={`h-7 w-12 grid place-items-center rounded-full ${on ? 'bg-route-soft' : ''}`}>
                <Icon size={20} />
              </span>
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
