import {useState} from 'react';
import {Button, Dialog, HelperText, Portal, TextInput} from 'react-native-paper';

export type EditSpec = {
  title: string;
  label: string;
  /** 'time' is HH:MM, 'duration' is hours like 7.5 or 7:45, 'text' is free text, otherwise a number. */
  kind: 'number' | 'time' | 'duration' | 'text';
  initial: string;
  hint?: string;
  secure?: boolean;
  min?: number;
  max?: number;
  onSave: (value: number | string | null) => void;
};

export function parseClock(text: string): number | null {
  const m = text.trim().match(/^(\d{1,2})[:.]?(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
}

export function parseDuration(text: string): number | null {
  const t = text.trim();
  const clock = t.match(/^(\d{1,2})[:h]\s*(\d{1,2})m?$/);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
  const n = Number(t.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 60) : null;
}

export default function EditValueDialog({spec, onDismiss}: {spec: EditSpec | null; onDismiss: () => void}) {
  return (
    <Portal>
      <Dialog visible={spec != null} onDismiss={onDismiss}>
        <Dialog.Title>{spec?.title}</Dialog.Title>
        {spec && <Form key={spec.title} spec={spec} onDismiss={onDismiss} />}
      </Dialog>
    </Portal>
  );
}

function Form({spec, onDismiss}: {spec: EditSpec; onDismiss: () => void}) {
  const [text, setText] = useState(spec.initial);
  const empty = text.trim() === '';
  let parsed: number | string | null = null;
  if (!empty) {
    if (spec.kind === 'time') parsed = parseClock(text);
    else if (spec.kind === 'duration') {
      const d = parseDuration(text);
      parsed = d != null && d >= 180 && d <= 840 ? d : null;
    }
    else if (spec.kind === 'text') parsed = text.trim();
    else {
      const n = Number(text.replace(',', '.'));
      parsed = Number.isFinite(n) && (spec.min == null || n >= spec.min) && (spec.max == null || n <= spec.max) ? n : null;
    }
  }
  const valid = empty || parsed != null;
  const save = () => {
    if (!valid) return;
    spec.onSave(empty ? null : parsed);
    onDismiss();
  };
  return (
    <>
      <Dialog.Content>
        <TextInput
          mode="outlined"
          label={spec.label}
          value={text}
          onChangeText={setText}
          autoFocus
          secureTextEntry={spec.secure}
          autoCapitalize="none"
          keyboardType={spec.kind === 'text' ? 'default' : spec.kind === 'number' ? 'number-pad' : 'numbers-and-punctuation'}
          onSubmitEditing={save}
          error={!valid}
        />
        <HelperText type={valid ? 'info' : 'error'} visible>
          {valid ? spec.hint ?? 'Leave empty to use the automatic value' : 'That doesn’t look right'}
        </HelperText>
      </Dialog.Content>
      <Dialog.Actions>
        <Button onPress={onDismiss}>Cancel</Button>
        <Button onPress={save} disabled={!valid}>Save</Button>
      </Dialog.Actions>
    </>
  );
}
