import {useMemo} from 'react';
import {computeScoreHistory, ScoreHistory} from '@/insights';
import {addDays, today} from '@/lib/dates';
import {useAppData} from '@/providers/AppData';

export const HISTORY_DAYS = 365;

export function useScoreHistory(): ScoreHistory {
  const {daily, sleep, tags, tagEntries} = useAppData();
  return useMemo(() => {
    const end = today();
    return computeScoreHistory({today: end, daily, sleep, tags, tagEntries}, addDays(end, -(HISTORY_DAYS - 1)), end);
  }, [daily, sleep, tags, tagEntries]);
}
