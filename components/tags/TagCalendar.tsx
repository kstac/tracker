import {useState} from 'react';
import {View} from 'react-native';
import {Button, Text} from 'react-native-paper';
import {monthLabel, shiftMonth} from '@/insights';
import {monthStart} from '@/insights/tagStats';
import {addDays, dayOfWeek, IsoDate} from '@/lib/dates';
import {useAppTheme} from '@/theme';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const STEP = 3;

function Month({start, values, max, end, color}: {start: IsoDate; values: Map<IsoDate, number>; max: number; end: IsoDate; color: string}) {
  const {chart} = useAppTheme();
  const next = shiftMonth(start, 1);
  const lead = (dayOfWeek(start) + 6) % 7;
  const cells: (IsoDate | null)[] = Array.from({length: lead}, () => null);
  for (let d = start; d < next; d = addDays(d, 1)) cells.push(d);
  while (cells.length % 7) cells.push(null);
  const weeks = Array.from({length: cells.length / 7}, (_, i) => cells.slice(i * 7, i * 7 + 7));
  return (
    <View style={{gap: 3}}>
      <Text variant="labelMedium" style={{color: chart.inkSecondary, marginBottom: 2}}>{monthLabel(start)}</Text>
      {weeks.map((week, i) => (
        <View key={i} style={{flexDirection: 'row', gap: 3}}>
          {week.map((d, j) => {
            if (!d) return <View key={j} style={{flex: 1, aspectRatio: 1}} />;
            const v = values.get(d) ?? 0;
            return (
              <View
                key={j}
                accessibilityLabel={`${d}: ${v}`}
                style={{
                  flex: 1, aspectRatio: 1, borderRadius: 4,
                  backgroundColor: v > 0 ? color : chart.grid,
                  opacity: d > end ? 0.3 : v > 0 ? 0.35 + 0.65 * Math.min(1, v / max) : 1,
                  borderWidth: d === end ? 2 : 0, borderColor: chart.inkPrimary,
                }}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

/** Logged days as month grids, newest first, darker for bigger amounts. */
export default function TagCalendar({entries, end, firstDate, color}: {entries: {date: IsoDate; value: number}[]; end: IsoDate; firstDate: IsoDate | null; color: string}) {
  const {chart} = useAppTheme();
  const [count, setCount] = useState(STEP);
  const values = new Map(entries.map((e) => [e.date, e.value]));
  const max = Math.max(1, ...entries.map((e) => e.value));
  const latest = monthStart(end);
  const earliest = firstDate ? monthStart(firstDate) : latest;
  const months: IsoDate[] = [];
  for (let m = latest; months.length < count && m >= earliest; m = shiftMonth(m, -1)) months.push(m);
  const more = months.length === count && shiftMonth(months[months.length - 1], -1) >= earliest;
  return (
    <View style={{gap: 14}}>
      <View style={{flexDirection: 'row', gap: 3}}>
        {WEEKDAYS.map((d, i) => <Text key={i} variant="labelSmall" style={{flex: 1, textAlign: 'center', color: chart.inkMuted}}>{d}</Text>)}
      </View>
      {months.map((m) => <Month key={m} start={m} values={values} max={max} end={end} color={color} />)}
      {more && <Button compact style={{alignSelf: 'flex-start'}} onPress={() => setCount(count + STEP)}>Show older</Button>}
    </View>
  );
}
