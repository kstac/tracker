import {useState} from 'react';
import {View} from 'react-native';
import {Button, Dialog, HelperText, Portal, SegmentedButtons, TextInput} from 'react-native-paper';
import {unitFromName} from '@/insights/tagStats';
import {TagUpdate} from '@/metrics/types';

type Props = {
  visible: boolean;
  title: string;
  initial?: TagUpdate;
  onDismiss: () => void;
  onSubmit: (update: TagUpdate) => void;
};

export default function TagEditDialog({visible, title, initial, onDismiss, onSubmit}: Props) {
  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss}>
        <Dialog.Title>{title}</Dialog.Title>
        {visible && <TagForm initial={initial} onDismiss={onDismiss} onSubmit={onSubmit} />}
      </Dialog>
    </Portal>
  );
}

function parseLimit(text: string): number | null | 'invalid' {
  const t = text.trim();
  if (!t) return null;
  const n = Number(t.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : 'invalid';
}

function TagForm({initial, onDismiss, onSubmit}: Omit<Props, 'visible' | 'title'>) {
  const [name, setName] = useState(initial?.name ?? '');
  const suggested = initial?.unit ?? unitFromName(initial?.name ?? '');
  const [mode, setMode] = useState<'count' | 'amount'>(initial?.unit ? 'amount' : 'count');
  const [unit, setUnit] = useState(suggested ?? '');
  const [unitTouched, setUnitTouched] = useState(Boolean(initial?.unit));
  const [limit, setLimit] = useState(initial?.weeklyLimit != null ? String(initial.weeklyLimit) : '');

  const parsedLimit = parseLimit(limit);
  const unitValue = mode === 'amount' ? unit.trim() : '';
  const valid = name.trim() !== '' && parsedLimit !== 'invalid' && (mode === 'count' || unitValue !== '');

  const onNameChange = (text: string) => {
    setName(text);
    if (!unitTouched) {
      const s = unitFromName(text);
      if (s) {
        setUnit(s);
        setMode('amount');
      }
    }
  };

  const submit = () => {
    if (!valid) return;
    onSubmit({name: name.trim(), unit: mode === 'amount' ? unitValue : null, weeklyLimit: parsedLimit});
  };

  return (
    <>
      <Dialog.Content style={{gap: 12}}>
        <TextInput label="Name" mode="outlined" value={name} onChangeText={onNameChange} autoFocus={!initial} placeholder="e.g. Alcohol, Late meal, Nicotine (mg)" />
        <SegmentedButtons
          value={mode}
          onValueChange={(v) => setMode(v as 'count' | 'amount')}
          buttons={[
            {value: 'count', label: 'Count', icon: 'counter'},
            {value: 'amount', label: 'Amount', icon: 'scale-balance'},
          ]}
        />
        {mode === 'amount' && (
          <TextInput
            label="Unit"
            mode="outlined"
            value={unit}
            onChangeText={(t) => {
              setUnit(t);
              setUnitTouched(true);
            }}
            placeholder="mg, ml, cups…"
          />
        )}
        <View>
          <TextInput
            label={`Weekly limit (optional${mode === 'amount' && unitValue ? `, ${unitValue}` : ''})`}
            mode="outlined"
            value={limit}
            onChangeText={setLimit}
            keyboardType="decimal-pad"
            onSubmitEditing={submit}
          />
          <HelperText type={parsedLimit === 'invalid' ? 'error' : 'info'} visible>
            {parsedLimit === 'invalid' ? 'Enter a number above 0, or leave it empty' : 'Shows progress each week and warns as you get close'}
          </HelperText>
        </View>
      </Dialog.Content>
      <Dialog.Actions>
        <Button onPress={onDismiss}>Cancel</Button>
        <Button onPress={submit} disabled={!valid}>Save</Button>
      </Dialog.Actions>
    </>
  );
}
