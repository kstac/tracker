import {useState} from 'react';
import {Button, Dialog, Portal, TextInput} from 'react-native-paper';

type Props = {visible: boolean; title: string; initial?: string; onDismiss: () => void; onSubmit: (name: string) => void};

export default function TagNameDialog({visible, title, initial = '', onDismiss, onSubmit}: Props) {
  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss}>
        <Dialog.Title>{title}</Dialog.Title>
        {visible && <NameForm initial={initial} onDismiss={onDismiss} onSubmit={onSubmit} />}
      </Dialog>
    </Portal>
  );
}

function NameForm({initial, onDismiss, onSubmit}: Pick<Props, 'initial' | 'onDismiss' | 'onSubmit'>) {
  const [name, setName] = useState(initial ?? '');
  const submit = () => name.trim() && onSubmit(name.trim());
  return (
    <>
      <Dialog.Content>
        <TextInput label="Name" mode="outlined" value={name} onChangeText={setName} onSubmitEditing={submit} autoFocus placeholder="e.g. Alcohol, Late meal, Caffeine after 2pm" />
      </Dialog.Content>
      <Dialog.Actions>
        <Button onPress={onDismiss}>Cancel</Button>
        <Button onPress={submit} disabled={!name.trim()}>Save</Button>
      </Dialog.Actions>
    </>
  );
}
