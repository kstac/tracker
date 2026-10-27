import {View} from 'react-native';
import {Chip, Text} from 'react-native-paper';
import {Panel, PanelHeader} from '@/components/ui/Panel';
import {formatTagAmount} from '@/insights/tagStats';
import {addDays, IsoDate} from '@/lib/dates';
import {Tag, TagEntry} from '@/metrics/types';
import {useAppTheme} from '@/theme';

type Props = {date: IsoDate; reason: string; tags: Tag[]; tagEntries: TagEntry[]; onLog: (tag: Tag, date: IsoDate, current: number) => void};

/** After an unusual night, ask about the day before while it's fresh, starting with the tags you use most. */
export default function YesterdayPrompt({date, reason, tags, tagEntries, onLog}: Props) {
  const {chart} = useAppTheme();
  const yesterday = addDays(date, -1);
  const since = addDays(date, -60);
  const counts = new Map<string, number>();
  for (const e of tagEntries) if (e.date >= since && e.value > 0) counts.set(e.tagId, (counts.get(e.tagId) ?? 0) + 1);
  const ranked = [...tags].sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0)).slice(0, 8);
  if (!ranked.length) return null;
  const value = (t: Tag) => tagEntries.find((e) => e.tagId === t.id && e.date === yesterday)?.value ?? 0;
  return (
    <Panel>
      <PanelHeader title="Anything different yesterday?" subtitle={reason} icon="head-question-outline" color={chart.series[3]} />
      <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8}}>
        {ranked.map((t) => {
          const v = value(t);
          return (
            <Chip key={t.id} selected={v > 0} showSelectedOverlay icon={v > 0 ? 'check' : t.unit ? 'scale-balance' : 'plus'} onPress={() => onLog(t, yesterday, v)}>
              {v > 0 ? `${t.name} · ${formatTagAmount(v, t.unit)}` : t.name}
            </Chip>
          );
        })}
      </View>
      <Text variant="labelSmall" style={{color: chart.inkMuted, marginTop: 10}}>Logging what happened is how the app learns what affects your sleep.</Text>
    </Panel>
  );
}
