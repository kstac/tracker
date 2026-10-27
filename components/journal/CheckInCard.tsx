import {useState} from 'react';
import {Pressable, View} from 'react-native';
import {Button, Text} from 'react-native-paper';
import {Panel, PanelHeader} from '@/components/ui/Panel';
import {IsoDate} from '@/lib/dates';
import {MetricId} from '@/metrics/types';
import {useAppData} from '@/providers/AppData';
import {useAppTheme} from '@/theme';

export const CHECKIN_QUESTIONS: {metric: MetricId; label: string; low: string; high: string; goodHigh: boolean}[] = [
  {metric: 'checkin_energy', label: 'Energy', low: 'Drained', high: 'Energised', goodHigh: true},
  {metric: 'checkin_mood', label: 'Mood', low: 'Low', high: 'Great', goodHigh: true},
  {metric: 'checkin_soreness', label: 'Soreness', low: 'None', high: 'Very sore', goodHigh: false},
];

function RatingRow({label, low, high, value, goodHigh, onChange}: {
  label: string; low: string; high: string; value: number | null; goodHigh: boolean; onChange: (v: number | null) => void;
}) {
  const {chart, colors} = useAppTheme();
  const tint = (n: number) => {
    const good = goodHigh ? n >= 4 : n <= 2;
    const bad = goodHigh ? n <= 2 : n >= 4;
    return good ? chart.status.good : bad ? chart.status.serious : chart.status.warning;
  };
  return (
    <View style={{gap: 6}}>
      <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
        <Text variant="bodyMedium" style={{color: chart.inkPrimary, fontWeight: '500'}}>{label}</Text>
        <Text variant="labelSmall" style={{color: chart.inkMuted}}>{low} → {high}</Text>
      </View>
      <View style={{flexDirection: 'row', gap: 8}}>
        {[1, 2, 3, 4, 5].map((n) => {
          const selected = value === n;
          return (
            <Pressable
              key={n}
              onPress={() => onChange(selected ? null : n)}
              accessibilityLabel={`${label} ${n} of 5`}
              style={{
                flex: 1, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
                borderWidth: 1, borderColor: selected ? tint(n) : colors.outlineVariant, backgroundColor: selected ? `${tint(n)}33` : 'transparent',
              }}
            >
              <Text variant="titleSmall" style={{color: selected ? chart.inkPrimary : chart.inkSecondary, fontWeight: selected ? '700' : '400'}}>{n}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** A 10-second morning check-in. How you feel feeds readiness and lets patterns show what affects your mood and energy. */
export default function CheckInCard({date, title = 'How do you feel?', compactWhenDone = true}: {date: IsoDate; title?: string; compactWhenDone?: boolean}) {
  const {chart} = useAppTheme();
  const {daily, setManualValue} = useAppData();
  const [editing, setEditing] = useState(false);
  const values = CHECKIN_QUESTIONS.map((q) => daily[q.metric]?.get(date) ?? null);
  const done = values.every((v) => v != null);

  if (done && compactWhenDone && !editing) {
    return (
      <Panel style={{flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10}}>
        <Text variant="bodyMedium" style={{color: chart.inkSecondary, flex: 1}}>
          {CHECKIN_QUESTIONS.map((q, i) => `${q.label} ${values[i]}/5`).join(' · ')}
        </Text>
        <Button compact onPress={() => setEditing(true)}>Edit</Button>
      </Panel>
    );
  }

  return (
    <Panel style={{gap: 14}}>
      <PanelHeader title={title} subtitle="Feeds into readiness and your patterns" icon="emoticon-happy-outline" color={chart.category.feel} right={done && editing ? <Button compact onPress={() => setEditing(false)}>Done</Button> : undefined} />
      {CHECKIN_QUESTIONS.map((q, i) => (
        <RatingRow key={q.metric} label={q.label} low={q.low} high={q.high} goodHigh={q.goodHigh} value={values[i]} onChange={(v) => setManualValue(q.metric, date, v)} />
      ))}
    </Panel>
  );
}
