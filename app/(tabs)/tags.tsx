import {useState} from 'react';
import {Pressable, ScrollView, View} from 'react-native';
import {router} from 'expo-router';
import {FAB, IconButton, Text} from 'react-native-paper';
import TagEditDialog from '@/components/TagEditDialog';
import LimitBar, {limitColor} from '@/components/tags/LimitBar';
import TagAmountDialog from '@/components/tags/TagAmountDialog';
import IconBadge from '@/components/ui/IconBadge';
import {Panel} from '@/components/ui/Panel';
import {computeTagStats, formatTagAmount} from '@/insights/tagStats';
import {addDays, IsoDate, parseIsoDate, today} from '@/lib/dates';
import {Tag} from '@/metrics/types';
import {useAppData} from '@/providers/AppData';
import {useAppTheme} from '@/theme';

function sinceText(daysSince: number | null) {
  if (daysSince == null) return 'Never logged';
  if (daysSince <= 0) return 'Logged this day';
  return daysSince === 1 ? '1 day without' : `${daysSince} days without`;
}

export default function TagsScreen() {
  const {chart, colors} = useAppTheme();
  const {tags, tagEntries, setTagValue, createTag} = useAppData();
  const [date, setDate] = useState<IsoDate>(today());
  const [adding, setAdding] = useState(false);
  const [amountTag, setAmountTag] = useState<Tag | null>(null);
  const isToday = date === today();
  const valueFor = (tagId: string) => tagEntries.find((e) => e.tagId === tagId && e.date === date)?.value ?? 0;

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
          const entries = tagEntries.filter((e) => e.tagId === t.id);
          const stats = computeTagStats(entries, date, t.weeklyLimit);
          const value = valueFor(t.id);
          const color = chart.series[i % chart.series.length];
          const fraction = stats.thisWeek.fraction;
          const weekText = t.weeklyLimit != null
            ? `${formatTagAmount(stats.thisWeek.total, null)} / ${formatTagAmount(t.weeklyLimit, t.unit)} this week`
            : `${formatTagAmount(stats.thisWeek.total, t.unit)} this week`;
          return (
            <Panel key={t.id} onPress={() => router.push({pathname: '/tag/[id]', params: {id: t.id}})} style={{gap: 10, paddingVertical: 12}}>
              <View style={{flexDirection: 'row', alignItems: 'center', gap: 12}}>
                <IconBadge icon={t.unit ? 'scale-balance' : 'tag-outline'} color={color} />
                <View style={{flex: 1}}>
                  <Text variant="titleMedium" style={{color: chart.inkPrimary, fontWeight: '600'}}>{t.name}</Text>
                  <Text variant="bodySmall" style={{color: chart.inkSecondary}}>{sinceText(stats.daysSinceLast)}</Text>
                </View>
                {t.unit ? (
                  <Pressable onPress={() => setAmountTag(t)} accessibilityLabel={`Set ${t.name} amount`}
                    style={{flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, borderWidth: 1, borderColor: colors.outlineVariant, paddingLeft: 14, paddingRight: 6, paddingVertical: 2}}>
                    <Text variant="titleMedium" style={{color: value ? chart.inkPrimary : chart.inkMuted, fontWeight: '700'}}>{formatTagAmount(value, t.unit)}</Text>
                    <IconButton icon="pencil-outline" size={16} style={{margin: 0}} />
                  </Pressable>
                ) : (
                  <>
                    <IconButton icon="minus" size={18} mode="outlined" disabled={value === 0} onPress={() => setTagValue(t.id, date, value - 1)} accessibilityLabel={`Remove one ${t.name}`} />
                    <Text variant="titleLarge" style={{minWidth: 28, textAlign: 'center', color: value ? chart.inkPrimary : chart.inkMuted, fontWeight: '700'}}>{value}</Text>
                    <IconButton icon="plus" size={18} mode="contained" onPress={() => setTagValue(t.id, date, value + 1)} accessibilityLabel={`Add one ${t.name}`} />
                  </>
                )}
              </View>
              {(fraction != null || stats.thisWeek.total > 0) && (
                <View style={{gap: 4}}>
                  <Text variant="labelSmall" style={{color: fraction != null ? limitColor(fraction, chart.status, chart.inkSecondary) : chart.inkSecondary}}>
                    {weekText}{fraction != null && fraction > 1 ? ' · over limit' : ''}
                  </Text>
                  {fraction != null && <LimitBar fraction={fraction} color={color} />}
                </View>
              )}
            </Panel>
          );
        })}
      </ScrollView>
      <FAB icon="plus" label="New tag" style={{position: 'absolute', right: 16, bottom: 16}} onPress={() => setAdding(true)} />
      <TagEditDialog
        visible={adding}
        title="New tag"
        onDismiss={() => setAdding(false)}
        onSubmit={async (update) => {
          setAdding(false);
          await createTag(update);
        }}
      />
      <TagAmountDialog
        tag={amountTag}
        date={date}
        current={amountTag ? valueFor(amountTag.id) : 0}
        onDismiss={() => setAmountTag(null)}
        onSubmit={async (v) => {
          const t = amountTag;
          setAmountTag(null);
          if (t) await setTagValue(t.id, date, v);
        }}
      />
    </View>
  );
}
