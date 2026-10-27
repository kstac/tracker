import {useState} from 'react';
import {View} from 'react-native';
import {Button, Text} from 'react-native-paper';
import {Panel, PanelHeader} from '@/components/ui/Panel';
import {APP_VERSION, CHANGELOG} from '@/lib/changelog';
import {useAppTheme} from '@/theme';

export default function ChangelogPanel() {
  const {chart} = useAppTheme();
  const [showOlder, setShowOlder] = useState(false);
  const entries = showOlder ? CHANGELOG : CHANGELOG.slice(0, 1);
  return (
    <Panel>
      <PanelHeader title={`Version ${APP_VERSION}`} subtitle="What changed, and what to check" icon="format-list-checks" color={chart.series[0]} />
      <View style={{gap: 16}}>
        {entries.map((e) => (
          <View key={e.version} style={{gap: 6}}>
            <Text variant="titleSmall" style={{color: chart.inkPrimary, fontWeight: '600'}}>{e.version} · {e.title}</Text>
            <Text variant="labelSmall" style={{color: chart.inkMuted}}>{e.date}</Text>
            {e.test.map((t) => (
              <View key={t} style={{flexDirection: 'row', gap: 8}}>
                <Text style={{color: chart.inkMuted}}>☐</Text>
                <Text variant="bodySmall" style={{color: chart.inkSecondary, flex: 1}}>{t}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>
      {CHANGELOG.length > 1 && (
        <Button compact style={{alignSelf: 'flex-start', marginTop: 8}} onPress={() => setShowOlder(!showOlder)}>
          {showOlder ? 'Hide older versions' : 'Older versions'}
        </Button>
      )}
    </Panel>
  );
}
