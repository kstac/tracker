import {View} from 'react-native';
import {router} from 'expo-router';
import {Button, Text} from 'react-native-paper';
import {Panel, PanelHeader} from '@/components/ui/Panel';
import {scoreColor} from '@/components/ScoreRing';
import {Contributor, Score, ScoreKind, ScoreLabel} from '@/insights';
import {useAppTheme} from '@/theme';

function contributorLabel(score: number): ScoreLabel {
  if (score >= 85) return 'Optimal';
  if (score >= 70) return 'Good';
  if (score >= 60) return 'Fair';
  return 'Pay attention';
}

export function ContributorList({contributors}: {contributors: Contributor[]}) {
  const {chart} = useAppTheme();
  return (
    <View style={{gap: 14}}>
      {[...contributors].sort((a, b) => a.score - b.score).map((c) => {
        const label = contributorLabel(c.score);
        const color = scoreColor(label, chart.status);
        return (
          <View key={c.key}>
            <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
              <Text variant="bodyMedium" style={{color: chart.inkPrimary, fontWeight: '500'}}>{c.label}</Text>
              <Text variant="labelMedium" style={{color: chart.inkSecondary}}>{label}</Text>
            </View>
            <View style={{height: 6, borderRadius: 3, backgroundColor: chart.grid, marginVertical: 6, overflow: 'hidden'}}>
              <View style={{width: `${Math.max(3, Math.min(100, c.score))}%`, height: '100%', borderRadius: 3, backgroundColor: color}} />
            </View>
            <Text variant="bodySmall" style={{color: chart.inkSecondary}}>{c.detail}</Text>
          </View>
        );
      })}
    </View>
  );
}

type Props = {title: string; score: Score; icon: string; kind?: ScoreKind};

export default function ScoreDetails({title, score, icon, kind}: Props) {
  const {chart} = useAppTheme();
  return (
    <Panel>
      <PanelHeader
        title={`${title} · ${score.value}`}
        subtitle={score.calibrating ? 'Still learning your baseline. Scores firm up after about 2 weeks of data.' : `${score.label} · what's driving it`}
        icon={icon}
        color={scoreColor(score.label, chart.status)}
      />
      <ContributorList contributors={score.contributors} />
      {kind && (
        <Button
          mode="text"
          icon="chart-line"
          style={{alignSelf: 'flex-start', marginTop: 8}}
          onPress={() => router.push({pathname: '/scores/[kind]', params: {kind}})}
        >
          See history
        </Button>
      )}
    </Panel>
  );
}
