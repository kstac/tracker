import {Pressable, ScrollView, View} from 'react-native';
import {router} from 'expo-router';
import {Text} from 'react-native-paper';
import {radarColor, radarText, RadarStrip, VitalRow} from '@/components/today/BodyCheckPanel';
import {Panel, PanelHeader} from '@/components/ui/Panel';
import {computeBodyCheck} from '@/insights';
import {parseIsoDate} from '@/lib/dates';
import {useAppData} from '@/providers/AppData';
import {useAppTheme} from '@/theme';

const fmt = (d: string) => parseIsoDate(d).toLocaleDateString(undefined, {weekday: 'short', day: 'numeric', month: 'short'});

export default function BodyScreen() {
  const {chart} = useAppTheme();
  const {report, daily} = useAppData();
  if (!report) return null;
  const check = report.bodyCheck;
  const loads = new Map(report.load.days.map((d) => [d.date, d.load]));
  const ctx = {loads, chronicLoad: report.load.chronic};
  const flagged = [...check.history].reverse().filter((h) => h.level !== 'none').slice(0, 10);

  return (
    <ScrollView style={{backgroundColor: chart.page}} contentContainerStyle={{paddingTop: 12, paddingBottom: 32}}>
      <Panel>
        <PanelHeader title="Last night" subtitle="Each vital against your last 60 days" icon="shield-check-outline" color={radarColor(check.radar.level, chart)} />
        <View style={{gap: 14}}>
          {check.vitals.map((v) => (
            <Pressable key={v.metric} onPress={() => router.push({pathname: '/metric/[id]', params: {id: v.metric}})}>
              <VitalRow vital={v} detailed />
            </Pressable>
          ))}
        </View>
        <Text variant="bodySmall" style={{color: chart.inkMuted, marginTop: 12}}>
          The green band is your usual range. Slightly off is more than one standard deviation from normal in the unhealthy direction; notably off is more than two.
        </Text>
      </Panel>
      <Panel>
        <PanelHeader title="Strain radar" subtitle="Several signals moving together is a stronger sign than any single one" icon="radar" color={radarColor(check.radar.level, chart)} />
        <Text variant="bodyMedium" style={{color: chart.inkPrimary, marginBottom: 12}}>{radarText(check)}</Text>
        <RadarStrip history={check.history} />
        <Text variant="labelSmall" style={{color: chart.inkMuted, marginTop: 6}}>Last 30 days. Amber is minor, red is major.</Text>
        {flagged.length > 0 && (
          <View style={{marginTop: 12, gap: 8}}>
            {flagged.map((h) => {
              const detail = computeBodyCheck(daily, h.date, ctx, 1).radar;
              return (
                <View key={h.date}>
                  <Text variant="labelMedium" style={{color: radarColor(h.level, chart)}}>{fmt(h.date)} · {h.level === 'major' ? 'Major' : 'Minor'}</Text>
                  <Text variant="bodySmall" style={{color: chart.inkSecondary}}>{detail.hits.map((x) => x.text).join('; ')}</Text>
                </View>
              );
            })}
          </View>
        )}
      </Panel>
    </ScrollView>
  );
}
