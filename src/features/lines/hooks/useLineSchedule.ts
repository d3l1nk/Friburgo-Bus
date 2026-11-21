import { useCallback, useEffect, useRef, useState } from 'react';
import { dayReplacement } from '../../../data/faolLines';
import { dayTypeOf } from '../../../lib/time';
import { daysForLine, downloadAllDays, getTimetable } from '../../../services/faol';
import type { DayCode, Timetable, TimetableResult } from '../../../types';

type Loaded = Partial<Record<DayCode, TimetableResult | 'loading'>>;

const tableOf = (r: TimetableResult | 'loading' | undefined): Timetable | null =>
  r && r !== 'loading' ? r.table : null;

/** Tabelas da linha (hoje + dia escolhido), origem selecionada, filtro "só próximos" e download offline. */
export function useLineSchedule(lineCode: string, onCacheChanged: () => void) {
  const today = dayTypeOf();
  const days = daysForLine(lineCode);
  const [day, setDay] = useState<DayCode>(today);
  const [tables, setTables] = useState<Loaded>({});
  const [origin, setOrigin] = useState<string | null>(null);
  const [onlyUpcoming, setOnlyUpcoming] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [downloadMsg, setDownloadMsg] = useState<string | null>(null);

  const tablesRef = useRef(tables);
  tablesRef.current = tables;
  const cacheChanged = useRef(onCacheChanged);
  cacheChanged.current = onCacheChanged;

  const load = useCallback(
    async (d: DayCode, force = false) => {
      if (dayReplacement(lineCode, d)) return; // sem tabela própria
      setTables((t) => ({ ...t, [d]: 'loading' }));
      const r = await getTimetable(lineCode, d, force);
      setTables((t) => ({ ...t, [d]: r }));
      cacheChanged.current();
    },
    [lineCode],
  );

  useEffect(() => {
    if (!tablesRef.current[today]) void load(today);
  }, [today, load]);
  useEffect(() => {
    if (!tablesRef.current[day]) void load(day);
    setOrigin(null);
  }, [day, load]);

  const download = async () => {
    setDownloading(true);
    setDownloadMsg(null);
    const r = await downloadAllDays(lineCode);
    setDownloadMsg(`${r.ok} de ${r.total} tabelas baixadas para uso offline.`);
    for (const d of days) await load(d);
    setDownloading(false);
  };

  const todayRes = tables[today];
  const viewRes = tables[day];

  return {
    today,
    days,
    day,
    setDay,
    origin,
    setOrigin,
    onlyUpcoming,
    toggleOnlyUpcoming: () => setOnlyUpcoming((v) => !v),
    showAllToday: () => setOnlyUpcoming(false),
    todayRes,
    viewRes,
    todayTable: tableOf(todayRes),
    viewTable: tableOf(viewRes),
    todayLoading: !todayRes || todayRes === 'loading',
    viewLoading: !viewRes || viewRes === 'loading',
    replacement: dayReplacement(lineCode, day),
    todayReplacement: dayReplacement(lineCode, today),
    reload: load,
    download,
    downloading,
    downloadMsg,
  };
}
