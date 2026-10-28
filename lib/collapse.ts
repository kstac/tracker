import {useSyncExternalStore} from 'react';
import {kvGet, kvSet} from '@/db/repo';

const KEY = 'ui.collapsed';

let state: Record<string, boolean> = {};
let loaded = false;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

function load() {
  loading ??= kvGet(KEY)
    .then((v) => {
      if (v) state = {...JSON.parse(v), ...state};
    })
    .catch(() => {})
    .finally(() => {
      loaded = true;
      emit();
    });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  load();
  return () => listeners.delete(listener);
}

/** Whether a card is open. Cards follow `defaultOpen` until the user opens or closes them, then remember that choice. */
export function useCardOpen(id: string, defaultOpen: boolean): [boolean, () => void] {
  const saved = useSyncExternalStore(subscribe, () => (loaded ? state[id] : undefined));
  const open = saved ?? defaultOpen;
  const toggle = () => {
    state = {...state, [id]: !open};
    emit();
    kvSet(KEY, JSON.stringify(state)).catch(() => {});
  };
  return [open, toggle];
}
