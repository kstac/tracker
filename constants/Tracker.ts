export enum TrackerType {
  COUNT
}

export type Tracker = {
  label: string;
  type: TrackerType;
  value?: number;
  dateAwareValues: Record<string, number>;
}