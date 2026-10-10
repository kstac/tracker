import {useState} from 'react';
import {View} from 'react-native';
import {Button, Chip, Dialog, Portal, TextInput} from 'react-native-paper';
import {formatTagAmount} from '@/insights/tagStats';
import {parseIsoDate} from '@/lib/dates';
import {Tag} from '@/metrics/types';

type Props = {
  tag: Tag | null;
  date: string;
  current: number;
  onDismiss: () => void;
  onSubmit: (value: number) => void;
};

const QUICK_ADD = [1, 2, 5, 10];

export default function TagAmountDialog({tag, date, current, onDismiss, onSubmit}: Props) {
  return (
    <Portal>
      <Dialog visible={tag != null} onDismiss={onDismiss}>
        <Dialog.Title>{tag?.name}</Dialog.Title>
        {tag && <AmountForm key={`${tag.id}-${date}`} tag={tag} date={date} current={current} onDismiss={onDismiss} onSubmit={onSubmit} />}
      </Dialog>
    </Portal>
  );
}

function AmountForm({tag, date, current, onDismiss, onSubmit}: Omit<Props, 'tag'> & {tag: Tag}) {
  const [text, setText] = useState(current > 0 ? String(current) : '');
  const value = Number(text.replace(',', '.'));
  const valid = text.trim() === '' || (Number.isFinite(value) && value >= 0);
  const add = (n: number) => setText(String(Math.round(((Number.isFinite(value) ? value : 0) + n) * 100) / 100));
  const submit = () => valid && onSubmit(text.trim() === '' ? 0 : value);

  return (
    <>
      <Dialog.Content style={{gap: 12}}>
        <TextInput
          label={`Amount on ${parseIsoDate(date).toLocaleDateString(undefined, {weekday: 'short', day: 'numeric', month: 'short'})}`}
          mode="outlined"
          value={text}
          onChangeText={setText}
          keyboardType="decimal-pad"
          autoFocus
          right={tag.unit ? <TextInput.Affix text={tag.unit} /> : undefined}
          onSubmitEditing={submit}
          error={!valid}
        />
        <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8}}>
          {QUICK_ADD.map((n) => (
            <Chip key={n} icon="plus" onPress={() => add(n)} compact>{formatTagAmount(n, tag.unit)}</Chip>
          ))}
        </View>
      </Dialog.Content>
      <Dialog.Actions>
        {current > 0 && <Button onPress={() => onSubmit(0)}>Clear</Button>}
        <Button onPress={onDismiss}>Cancel</Button>
        <Button onPress={submit} disabled={!valid}>Save</Button>
      </Dialog.Actions>
    </>
  );
}
