/**
 * The app's own version, bumped (minor) with each set of changes. It's kept here rather than in app.json because
 * app.json's version feeds the native fingerprint, and changing it would stop OTA updates reaching existing builds.
 */
export const APP_VERSION = '1.3.0';

export type ChangelogEntry = {version: string; date: string; title: string; test: string[]};

/** Newest first. Each item is something to check on the phone. */
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.3.0',
    date: '2026-10-28',
    title: 'Simpler screens and collapsible cards',
    test: [
      'Cards with a chevron open and close, and stay that way after closing and reopening the app',
      'Today: check-in and Log today sit near the top; Body check shows a one-line summary unless something is off',
      'Today: Tonight, Sleep debt, Activity and Stress start closed with the key number still visible',
      'Journal is no longer a tab: open it from Log today; past days, notes and new tags still work',
      'Insights: rows are one sentence each; stressful days and weekends sit under "Other patterns"',
      'Tag screen: history is a calendar; By day of week starts closed; Details on a pattern shows the breakdown',
      'Training: top card reads in plain words, workouts are grouped by week',
      'Settings: sections are grouped and collapsed with summaries; this list closes and reopens for each new version',
    ],
  },
  {
    version: '1.2.0',
    date: '2026-10-28',
    title: 'Chat with Gemini',
    test: [
      'Settings: switch Ask about your data between Claude and Gemini; each keeps its own key and model',
      'Add a Gemini key from aistudio.google.com and ask a question; check the answer quotes your numbers',
      'Switch back to Claude and check your Claude key and model are still there',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-10-28',
    title: 'Insights, training load, sleep planning and journal',
    test: [
      'Today: readiness shows Go for it / Ready / Pace yourself / Recover and what is holding it back',
      'Today: morning check-in (energy, mood, soreness) saves and changes readiness',
      'Today: Body check lists your vitals with Typical / Slightly off and a 30-day strain strip',
      'Today: Tonight panel gives an "asleep by" time; check it against your usual bedtime',
      'Today: Activity panel shows steps vs goal and a training target; Stress panel shows rest/low/medium/high time',
      'Body Battery events appear in the Stress panel (new Garmin endpoint, may be empty)',
      'Training screen: workouts from Garmin appear once, with load, and status after ~3 weeks',
      'Insights tab: "What helps / holds you back", tap a row for details',
      'Experiments: start one from Insights and check progress the next day',
      'Monthly report: open from Insights, flip months with the arrows',
      'Journal tab (was Tags): check-in, note, tag presets, archive a tag and restore it',
      'Status: set Sick/Travelling from Today, check the banner and that strain alerts soften',
      'Trends: Body lets you log weight, body fat and blood pressure; How you feel shows check-ins',
      'Settings: goals, wake times, profile, Patterns toggle, CSV export, Claude API key',
      'Notifications: morning report text, bedtime nudge about an hour before target, monthly review on the 1st',
      'After a backup restore, workouts and notes are still there',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-10-27',
    title: 'Health dashboard',
    test: ['Scores, sleep debt, tags with limits, notifications and backups'],
  },
];
