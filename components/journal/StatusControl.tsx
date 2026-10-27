import {useState} from 'react';
import {Alert, View} from 'react-native';
import {Button, Menu, Text} from 'react-native-paper';
import IconBadge from '@/components/ui/IconBadge';
import {Panel} from '@/components/ui/Panel';
import {STATUS_LABEL} from '@/insights';
import {addDays, parseIsoDate, today} from '@/lib/dates';
import {StatusKind} from '@/metrics/types';
import {useAppData} from '@/providers/AppData';
import {useAppTheme} from '@/theme';

const KINDS: StatusKind[] = ['sick', 'injured', 'travel', 'rest'];

const fmt = (d: string) => parseIsoDate(d).toLocaleDateString(undefined, {weekday: 'short', day: 'numeric', month: 'short'});

/** A banner while a status is active, otherwise a small menu to set one. */
export default function StatusControl({showWhenNormal = true}: {showWhenNormal?: boolean}) {
  const {chart} = useAppTheme();
  const {report, startStatus, endStatus, deleteStatus} = useAppData();
  const [menu, setMenu] = useState(false);
  const status = report?.status ?? null;
  const date = today();

  if (status) {
    const meta = STATUS_LABEL[status.kind];
    return (
      <Panel style={{flexDirection: 'row', alignItems: 'center', gap: 12, borderLeftWidth: 4, borderLeftColor: chart.status.warning}}>
        <IconBadge icon={meta.icon} color={chart.status.warning} />
        <View style={{flex: 1}}>
          <Text variant="titleSmall" style={{color: chart.inkPrimary, fontWeight: '600'}}>{meta.label} since {fmt(status.start)}</Text>
          <Text variant="bodySmall" style={{color: chart.inkSecondary}}>{meta.detail}</Text>
        </View>
        <Button
          compact
          onPress={() =>
            Alert.alert(`End "${meta.label}"?`, 'Ending keeps the past days marked. Deleting removes the status as if it never happened.', [
              {text: 'Cancel', style: 'cancel'},
              {text: 'Delete it', style: 'destructive', onPress: () => deleteStatus(status.id)},
              {text: 'Back to normal today', onPress: () => (status.start >= date ? deleteStatus(status.id) : endStatus(status.id, addDays(date, -1)))},
            ])
          }
        >
          End
        </Button>
      </Panel>
    );
  }
  if (!showWhenNormal) return null;
  return (
    <Menu
      visible={menu}
      onDismiss={() => setMenu(false)}
      anchor={<Button compact icon="account-heart-outline" onPress={() => setMenu(true)}>Set status</Button>}
    >
      {KINDS.map((k) => (
        <Menu.Item key={k} leadingIcon={STATUS_LABEL[k].icon} title={STATUS_LABEL[k].label} onPress={() => { setMenu(false); startStatus(k, date); }} />
      ))}
    </Menu>
  );
}
