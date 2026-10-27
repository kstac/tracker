import {ScoreHistory} from '@/insights';
import {useAppData} from '@/providers/AppData';

export {HISTORY_DAYS} from '@/insights';

const EMPTY: ScoreHistory = {days: [], details: () => null};

/** The engine already computes a year of score history with the report; this just hands it out. */
export function useScoreHistory(): ScoreHistory {
  return useAppData().report?.history ?? EMPTY;
}
