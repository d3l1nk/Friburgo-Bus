import { useCallback, useState } from 'react';
import { openExternal } from '../lib/openUrl';
import { FAOL_CHANNEL_URL } from '../config';
import type { LuizAction } from '../services/luiz';
import type { MerusStop, SettingsView, TabId } from '../types';

/** Estado de navegação do app (aba, tela de ajustes, linha aberta…) e as ações que o alteram. */
export function useAppNavigation() {
  const [tab, setTab] = useState<TabId>('radar');
  const [settingsView, setSettingsView] = useState<SettingsView>('main');
  const [openCode, setOpenCode] = useState<string | null>(null);
  const [prefillLine, setPrefillLine] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [focusStop, setFocusStop] = useState<MerusStop | null>(null);

  const clearFocusStop = useCallback(() => setFocusStop(null), []);

  const showOnMap = useCallback((key: string) => {
    setHighlight(key);
    setTab('radar');
  }, []);

  const openLine = useCallback((code: string | null) => {
    setOpenCode(code);
    setTab('lines');
  }, []);

  const openStop = useCallback((s: MerusStop) => {
    setFocusStop(s);
    setTab('radar');
  }, []);

  const openSettings = useCallback((view: SettingsView, line: string | null = null) => {
    setPrefillLine(line);
    setSettingsView(view);
    setTab('settings');
  }, []);

  const onLuizAction = useCallback(
    (a: LuizAction) => {
      switch (a.kind) {
        case 'line':
          openLine(a.payload ?? null);
          break;
        case 'map':
          if (a.payload) showOnMap(a.payload);
          break;
        case 'alert':
          openSettings('alerts', a.payload ?? null);
          break;
        case 'feedback':
          openSettings('feedback');
          break;
        case 'about':
          openSettings('about');
          break;
        case 'faol':
          void openExternal(FAOL_CHANNEL_URL);
          break;
        case 'tab':
          setTab((a.payload as TabId) ?? 'radar');
          break;
      }
    },
    [openLine, openSettings, showOnMap],
  );

  /** Toque numa aba da barra inferior (tocar em "Ajustes" já aberto volta ao menu). */
  const onTabPress = useCallback(
    (id: TabId) => {
      if (id === 'settings' && tab === 'settings') setSettingsView('main');
      if (id === 'settings' && tab !== 'settings' && settingsView !== 'diag') setPrefillLine(null);
      setTab(id);
    },
    [tab, settingsView],
  );

  return {
    tab,
    settingsView,
    setSettingsView,
    openCode,
    setOpenCode,
    prefillLine,
    highlight,
    setHighlight,
    focusStop,
    clearFocusStop,
    showOnMap,
    openLine,
    openStop,
    openSettings,
    onLuizAction,
    onTabPress,
  };
}
