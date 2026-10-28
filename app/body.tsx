import {Pressable, ScrollView, View} from 'react-native';
import {router} from 'expo-router';
import {Text} from 'react-native-paper';
import {radarColor, radarText, RadarStrip, VitalRow} from '@/components/today/BodyCheckPanel';
import CollapsiblePanel from '@/components/ui/CollapsiblePanel';
import {Panel, PanelHeader} from '@/components/ui/Panel';
import {computeBodyCheck, RadarContext, RadarLevel} from '@/insights';
import {DailyData} from '@/metrics/types';
import {IsoDate, parseIsoDate} from '@/lib/dates';
import {useAppData} from '@/providers/AppData';
import {useAppTheme} from '@/theme';

const fmt = (d: string) => parseIsoDate(d).toLocaleDateString(undefined, {weekday: 'short', day: 'numeric', month: 'short'});

function StrainDay({date, level, daily, ctx}: {date: IsoDate; level: RadarLevel; daily: DailyData; ctx: RadarContext}) {
  const {chart} = useAppTheme();
  const detail = computeBodyCheck(daily, date, ctx, 1).radar;
  return (
    <View>
      <Text variant="labelMedium" style={{color: radarColor(level, chart)}}>{fmt(date)} · {level === 'major' ? 'Major' : 'Minor'}</Text>
      <Text variant="bodySmall" style={{color: chart.inkSecondary}}>{detail.hits.map((x) => x.text).join('; ')}</Text>
    </View>
  );
}

export default function BodyScreen() {
  const {chart} = useAppTheme();
  const {report, daily} = useAppData();
  if (!report) return null;
  const check = report.bodyCheck;
  const loads = new Map(report.load.days.map((d) => [d.date, d.load]));
  const ctx = {loads, chronicLoad: report.load.chronic};
  const strained = [...check.history].reverse().filter((h) => h.level !== 'none');
  const flagged = strained.slice(0, 10);

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
      </Panel>
      {flagged.length > 0 && (
        <CollapsiblePanel
          id="body.strain_days"
          title="Strain days"
          summary={`${strained.length} ${strained.length === 1 ? 'day' : 'days'} with strain in the last 30`}
          icon="calendar-alert"
          color={radarColor(flagged[0].level, chart)}
        >
          <View style={{gap: 8}}>
            {flagged.map((h) => <StrainDay key={h.date} date={h.date} level={h.level} daily={daily} ctx={ctx} />)}
          </View>
        </CollapsiblePanel>
      )}
    </ScrollView>
  );
}
