import {useState} from 'react';
import {View} from 'react-native';
import {Button, Dialog, IconButton, Portal, Text, TextInput} from 'react-native-paper';
import {addDays, IsoDate, parseIsoDate, today} from '@/lib/dates';
import {MetricDef} from '@/metrics/registry';

type Props = {def: MetricDef | null; onDismiss: () => void; onSubmit: (date: IsoDate, value: number) => void};

export default function ManualValueDialog({def, onDismiss, onSubmit}: Props) {
  return (
    <Portal>
      <Dialog visible={def != null} onDismiss={onDismiss}>
        <Dialog.Title>Add {def?.label.toLowerCase()}</Dialog.Title>
        {def && <Form def={def} onDismiss={onDismiss} onSubmit={onSubmit} />}
      </Dialog>
    </Portal>
  );
}

function Form({def, onDismiss, onSubmit}: {def: MetricDef; onDismiss: () => void; onSubmit: Props['onSubmit']}) {
  const [date, setDate] = useState(today());
  const [text, setText] = useState('');
  const value = Number(text.replace(',', '.'));
  const valid = text.trim() !== '' && Number.isFinite(value) && value > 0 && (def.max == null || value <= def.max);
  return (
    <>
      <Dialog.Content style={{gap: 12}}>
        <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}}>
          <IconButton icon="chevron-left" onPress={() => setDate(addDays(date, -1))} />
          <Text variant="titleMedium">{date === today() ? 'Today' : parseIsoDate(date).toLocaleDateString(undefined, {weekday: 'short', day: 'numeric', month: 'short'})}</Text>
          <IconButton icon="chevron-right" disabled={date >= today()} onPress={() => setDate(addDays(date, 1))} />
        </View>
        <TextInput
          mode="outlined"
          label={def.label}
          value={text}
          onChangeText={setText}
          keyboardType="decimal-pad"
          autoFocus
          right={def.unit ? <TextInput.Affix text={def.unit} /> : undefined}
          onSubmitEditing={() => valid && onSubmit(date, value)}
        />
      </Dialog.Content>
      <Dialog.Actions>
        <Button onPress={onDismiss}>Cancel</Button>
        <Button disabled={!valid} onPress={() => onSubmit(date, value)}>Save</Button>
      </Dialog.Actions>
    </>
  );
}
