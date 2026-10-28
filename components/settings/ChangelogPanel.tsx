import {useState} from 'react';
import {View} from 'react-native';
import {Button, Text} from 'react-native-paper';
import CollapsiblePanel from '@/components/ui/CollapsiblePanel';
import {APP_VERSION, CHANGELOG} from '@/lib/changelog';
import {useAppTheme} from '@/theme';

export default function ChangelogPanel() {
  const {chart} = useAppTheme();
  const [showOlder, setShowOlder] = useState(false);
  const entries = showOlder ? CHANGELOG : CHANGELOG.slice(0, 1);
  const count = CHANGELOG[0]?.test.length ?? 0;
  return (
    <CollapsiblePanel
      id={`changelog.${APP_VERSION}`}
      title={`Version ${APP_VERSION}`}
      subtitle="What changed, and what to check"
      summary={`${CHANGELOG[0]?.title ?? ''} · ${count} ${count === 1 ? 'thing' : 'things'} to check`}
      icon="format-list-checks"
      color={chart.series[0]}
      defaultOpen
    >
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
    </CollapsiblePanel>
  );
}
