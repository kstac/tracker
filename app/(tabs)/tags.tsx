import {useState} from 'react';
import {Pressable, ScrollView, View} from 'react-native';
import {router} from 'expo-router';
import {FAB, IconButton, Text} from 'react-native-paper';
import TagNameDialog from '@/components/TagNameDialog';
import IconBadge from '@/components/ui/IconBadge';
import {Panel} from '@/components/ui/Panel';
import {addDays, daysBetween, IsoDate, parseIsoDate, today} from '@/lib/dates';
import {useAppData} from '@/providers/AppData';
import {useAppTheme} from '@/theme';

function daysSinceText(lastDate: IsoDate | undefined, date: IsoDate) {
  if (!lastDate) return 'Never logged';
  const days = daysBetween(lastDate, date);
  if (days <= 0) return 'Logged this day';
  return days === 1 ? '1 day since last' : `${days} days since last`;
}

export default function TagsScreen() {
  const {chart, colors} = useAppTheme();
  const {tags, tagEntries, setTagValue, createTag} = useAppData();
  const [date, setDate] = useState<IsoDate>(today());
  const [adding, setAdding] = useState(false);
  const isToday = date === today();

  return (
    <View style={{flex: 1, backgroundColor: chart.page}}>
      <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 16, marginVertical: 8, backgroundColor: chart.surface, borderRadius: 999, borderWidth: 1, borderColor: colors.outlineVariant}}>
        <IconButton icon="chevron-left" onPress={() => setDate(addDays(date, -1))} accessibilityLabel="Previous day" />
        <Pressable onPress={() => setDate(today())}>
          <Text variant="titleMedium" style={{color: chart.inkPrimary, fontWeight: '600'}}>
            {isToday ? 'Today' : parseIsoDate(date).toLocaleDateString(undefined, {weekday: 'short', day: 'numeric', month: 'short'})}
          </Text>
        </Pressable>
        <IconButton icon="chevron-right" disabled={isToday} onPress={() => setDate(addDays(date, 1))} accessibilityLabel="Next day" />
      </View>
      <ScrollView contentContainerStyle={{paddingBottom: 96, paddingTop: 4}}>
        {tags.length === 0 && (
          <Panel>
            <Text style={{color: chart.inkSecondary}}>
              Tags are things you do that might affect your health: alcohol, caffeine, late meals, a sauna, travel. Log them here and the app shows how they line up with your sleep, resting heart rate and Body Battery.
            </Text>
          </Panel>
        )}
        {tags.map((t, i) => {
          const entries = tagEntries.filter((e) => e.tagId === t.id && e.value > 0);
          const count = entries.find((e) => e.date === date)?.value ?? 0;
          const last = entries.filter((e) => e.date <= date).map((e) => e.date).sort().pop();
          const color = chart.series[i % chart.series.length];
          return (
            <Panel key={t.id} onPress={() => router.push({pathname: '/tag/[id]', params: {id: t.id}})} style={{flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10}}>
              <IconBadge icon="tag-outline" color={color} />
              <View style={{flex: 1}}>
                <Text variant="titleMedium" style={{color: chart.inkPrimary, fontWeight: '600'}}>{t.name}</Text>
                <Text variant="bodySmall" style={{color: chart.inkSecondary}}>{daysSinceText(last, date)}</Text>
              </View>
              <IconButton icon="minus" size={18} mode="outlined" disabled={count === 0} onPress={() => setTagValue(t.id, date, count - 1)} accessibilityLabel={`Remove one ${t.name}`} />
              <Text variant="titleLarge" style={{minWidth: 28, textAlign: 'center', color: count ? chart.inkPrimary : chart.inkMuted, fontWeight: '700'}}>{count}</Text>
              <IconButton icon="plus" size={18} mode="contained" onPress={() => setTagValue(t.id, date, count + 1)} accessibilityLabel={`Add one ${t.name}`} />
            </Panel>
          );
        })}
      </ScrollView>
      <FAB icon="plus" label="New tag" style={{position: 'absolute', right: 16, bottom: 16}} onPress={() => setAdding(true)} />
      <TagNameDialog
        visible={adding}
        title="New tag"
        onDismiss={() => setAdding(false)}
        onSubmit={async (name) => {
          setAdding(false);
          await createTag(name);
        }}
      />
    </View>
  );
}
