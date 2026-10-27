const TYPES: Record<string, {label: string; icon: string}> = {
  running: {label: 'Run', icon: 'run'},
  treadmill_running: {label: 'Treadmill run', icon: 'run'},
  trail_running: {label: 'Trail run', icon: 'run'},
  walking: {label: 'Walk', icon: 'walk'},
  hiking: {label: 'Hike', icon: 'hiking'},
  cycling: {label: 'Ride', icon: 'bike'},
  indoor_cycling: {label: 'Indoor ride', icon: 'bike'},
  swimming: {label: 'Swim', icon: 'swim'},
  strength_training: {label: 'Strength', icon: 'dumbbell'},
  hiit: {label: 'HIIT', icon: 'lightning-bolt'},
  cardio: {label: 'Cardio', icon: 'heart-pulse'},
  yoga: {label: 'Yoga', icon: 'yoga'},
  pilates: {label: 'Pilates', icon: 'yoga'},
  stretching: {label: 'Stretching', icon: 'human-handsup'},
  breathwork: {label: 'Breathwork', icon: 'weather-windy'},
  elliptical: {label: 'Elliptical', icon: 'run-fast'},
  indoor_rowing: {label: 'Rowing machine', icon: 'rowing'},
  rowing: {label: 'Rowing', icon: 'rowing'},
  tennis: {label: 'Tennis', icon: 'tennis'},
  soccer: {label: 'Football', icon: 'soccer'},
  dancing: {label: 'Dance', icon: 'dance-ballroom'},
  rock_climbing: {label: 'Climbing', icon: 'carabiner'},
};

export function activityLabel(type: string): string {
  return TYPES[type]?.label ?? type.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

export function activityIcon(type: string): string {
  return TYPES[type]?.icon ?? 'run-fast';
}
