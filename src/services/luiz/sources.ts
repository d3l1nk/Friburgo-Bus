// Fonte de dados do Luiz (injetável nos testes): horários da FAOL e pontos do Merus.
import type { LatLng, TimetableResult, DayCode } from '../../types';
import { getTimetable } from '../faol';
import { getNearbyStops, type StopsResult } from '../merus';

export interface LuizSources {
  getTimetable(code: string, day: DayCode): Promise<TimetableResult>;
  getNearbyStops(pos: LatLng): Promise<StopsResult>;
}

export const defaultSources: LuizSources = {
  getTimetable: (code, day) => getTimetable(code, day),
  getNearbyStops: (pos) => getNearbyStops(pos, false),
};
