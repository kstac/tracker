import {ReactNode, useCallback, useState} from 'react';
import {Alert, Platform, ScrollView, View} from 'react-native';
import {router, useFocusEffect} from 'expo-router';
import {Button, Dialog, Divider, Menu, Portal, SegmentedButtons, Switch, Text} from 'react-native-paper';
import {Panel, PanelHeader, SectionHeader} from '@/components/ui/Panel';
import EditValueDialog, {EditSpec} from '@/components/settings/EditValueDialog';
import ChangelogPanel from '@/components/settings/ChangelogPanel';
import {AI_MODELS, getApiKey, getModel, setApiKey, setModel} from '@/lib/ai';
import {activitiesCsv, dailyCsv, shareCsv} from '@/lib/exportCsv';
import {baselineNeed} from '@/insights';
import {backupSummary, exportBackup, pickBackup, restoreBackup} from '@/db/backup';
import {DEFAULT_PREFS, getPrefs, NotificationPrefs, permissionGranted, requestPermission, setPrefs} from '@/lib/notifications';
import {dumpDatabase, getLegacyImportReport, kvGet, LegacyImportReport, migrateLegacyTrackers} from '@/db/repo';
import {clearTokens, loadTokens} from '@/garmin/auth';
import {sleepNeedReport} from '@/garmin/diagnostics';
import {resetHealthConnectSyncState, SourceOutcome} from '@/sync';
import {resetGarminSyncState} from '@/sync/garmin';
import {
  getHealthConnectStatus,
  HealthConnectStatus,
  hasHistoryPermission,
  listExerciseSessions,
  openHealthConnectSettings,
  requestHealthConnectPermissions,
} from '@/sync/healthConnect';
import {useAppData} from '@/providers/AppData';
import {ThemePreference, useThemePreference} from '@/providers/ThemePreference';
import {useAppTheme} from '@/theme';
import {addDays, formatClock, formatMinutes, today} from '@/lib/dates';

const HC_TEXT: Record<HealthConnectStatus, string> = {
  unavailable: 'Health Connect is not available on this phone',
  needs_update: 'Health Connect needs an update from the Play Store',
  needs_permission: 'Not connected yet',
  ready: 'Connected',
};

function Outcome({outcome}: {outcome?: SourceOutcome}) {
  const {chart} = useAppTheme();
  if (!outcome) return null;
  if (outcome.status === 'skipped') return <Text variant="bodySmall" style={{color: chart.inkMuted}}>Last sync: skipped ({outcome.reason})</Text>;
  if (outcome.status === 'error') return <Text variant="bodySmall" style={{color: chart.status.critical}}>Last sync failed: {outcome.message}</Text>;
  return (
    <View>
      <Text variant="bodySmall" style={{color: chart.inkSecondary}}>Last sync: {outcome.detail}</Text>
      {outcome.warnings.map((w) => (
        <Text key={w} variant="bodySmall" style={{color: chart.inkMuted}}>• {w}</Text>
      ))}
    </View>
  );
}

function formatImportReport(r: LegacyImportReport | null) {
  if (!r) return 'The old tracker data has not been imported yet.';
  if (!r.foundLegacyData) return 'No old tracker data was found on this phone.';
  const lines = r.trackers.map((t) => {
    const range = t.firstDate ? ` (${t.firstDate} → ${t.lastDate})` : '';
    const skipped = t.skippedKeys.length ? `\n   could not read: ${t.skippedKeys.join(', ')}` : '';
    return `• ${t.name}: ${t.legacyDays} days${range}, ${t.added} added, ${t.alreadyPresent} already there${skipped}`;
  });
  return [`Imported ${new Date(r.at).toLocaleString()}`, ...lines].join('\n');
}

const REMINDER_TIMES = [19, 20, 21, 22].map((hour) => ({hour, minute: 0}));
const pad = (n: number) => String(n).padStart(2, '0');

function ValueRow({title, value, onPress}: {title: string; value: string; onPress: () => void}) {
  const {chart} = useAppTheme();
  return (
    <View style={{flexDirection: 'row', alignItems: 'center', paddingVertical: 6}}>
      <Text variant="bodyLarge" style={{color: chart.inkPrimary, flex: 1}}>{title}</Text>
      <Button compact onPress={onPress}>{value}</Button>
    </View>
  );
}

function ToggleRow({title, subtitle, value, onChange, disabled, right}: {
  title: string; subtitle: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean; right?: ReactNode;
}) {
  const {chart} = useAppTheme();
  return (
    <View style={{flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10}}>
      <View style={{flex: 1}}>
        <Text variant="bodyLarge" style={{color: disabled ? chart.inkMuted : chart.inkPrimary}}>{title}</Text>
        <Text variant="bodySmall" style={{color: chart.inkSecondary}}>{subtitle}</Text>
      </View>
      {right}
      <Switch value={value} onValueChange={onChange} disabled={disabled} />
    </View>
  );
}

export default function SettingsScreen() {
  const {chart} = useAppTheme();
  const {preference, setPreference} = useThemePreference();
  const {sync, syncing, lastSync, reload, daily, sleep, settings, updateSettings, report, allTags, tagEntries, notes, activities} = useAppData();
  const [edit, setEdit] = useState<EditSpec | null>(null);
  const [ai, setAi] = useState<{hasKey: boolean; model: string}>({hasKey: false, model: AI_MODELS[0].id});
  const [modelMenu, setModelMenu] = useState(false);
  const [sexMenu, setSexMenu] = useState(false);
  const [hc, setHc] = useState<HealthConnectStatus | null>(null);
  const [hcHistory, setHcHistory] = useState(false);
  const [garmin, setGarmin] = useState<{connected: boolean; name: string | null; hrv: string | null}>({connected: false, name: null, hrv: null});
  const [dialog, setDialog] = useState<{title: string; body: string} | null>(null);
  const [notif, setNotif] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [notifAllowed, setNotifAllowed] = useState(false);
  const [timeMenu, setTimeMenu] = useState(false);

  const refresh = useCallback(async () => {
    const status = await getHealthConnectStatus();
    setHc(status);
    setHcHistory(status === 'ready' && (await hasHistoryPermission()));
    const tokens = await loadTokens();
    setGarmin({connected: !!tokens, name: await kvGet('garmin.display_name'), hrv: await kvGet('garmin.hrv_support')});
    setNotif(await getPrefs());
    setNotifAllowed(await permissionGranted());
    setAi({hasKey: !!(await getApiKey()), model: await getModel()});
  }, []);

  const updateNotif = async (patch: Partial<NotificationPrefs>) => {
    const turningOn = Object.values(patch).some((v) => v === true);
    if (turningOn && !notifAllowed) {
      const granted = await requestPermission();
      setNotifAllowed(granted);
      if (!granted) {
        Alert.alert('Notifications are off', 'Allow notifications for Health Tracker in Android settings to turn these on.');
        return;
      }
    }
    const next = {...notif, ...patch};
    setNotif(next);
    await setPrefs(next);
  };

  const backup = async () => {
    try {
      const summary = await exportBackup();
      setDialog({title: 'Backup created', body: `Saved ${summary}.\n\nKeep the file somewhere off this phone, e.g. Google Drive.`});
    } catch (e) {
      setDialog({title: 'Backup failed', body: e instanceof Error ? e.message : String(e)});
    }
  };

  const restore = async () => {
    try {
      const b = await pickBackup();
      if (!b) return;
      Alert.alert(
        'Restore this backup?',
        `From ${new Date(b.exportedAt).toLocaleString()}: ${backupSummary(b)}.\n\nThis replaces everything currently stored in the app.`,
        [
          {text: 'Cancel', style: 'cancel'},
          {text: 'Restore', style: 'destructive', onPress: async () => {
            await restoreBackup(b);
            await reload();
            setDialog({title: 'Restored', body: 'Your data has been restored. A sync will fill in anything newer.'});
            sync().then(refresh);
          }},
        ],
      );
    } catch (e) {
      setDialog({title: 'Restore failed', body: e instanceof Error ? e.message : String(e)});
    }
  };

  useFocusEffect(useCallback(() => {
    refresh();
  }, [refresh]));

  const connectHc = async () => {
    const status = await requestHealthConnectPermissions();
    setHc(status);
    if (status === 'ready') sync().then(refresh);
  };

  const disconnectGarmin = () =>
    Alert.alert('Disconnect Garmin?', 'Synced data stays on the phone. You can sign in again any time.', [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Disconnect', style: 'destructive', onPress: async () => {
        await clearTokens();
        refresh();
      }},
    ]);

  const resync = () =>
    Alert.alert('Re-download all data?', 'Clears sync progress so the next sync fetches the full history again. Existing data is kept and overwritten.', [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Re-download', onPress: async () => {
        await resetGarminSyncState();
        await resetHealthConnectSyncState();
        sync().then(refresh);
      }},
    ]);

  const activityCheck = async () => {
    const end = today();
    const from = addDays(end, -6);
    const methods = ['unknown', 'active', 'auto-detected', 'manual'];
    const days = Array.from({length: 7}, (_, i) => addDays(from, i)).map((d) => {
      const intensity = daily.intensity_min?.get(d);
      const exercise = daily.exercise_min?.get(d);
      const fmt = (v?: number) => (v == null ? '–' : `${Math.round(v)} min`);
      return `${d}  Garmin intensity ${fmt(intensity)} · HC exercise ${fmt(exercise)}`;
    });
    let sessions: string[] = [];
    try {
      sessions = (await listExerciseSessions(from, addDays(end, 1))).map(
        (x) => `${x.start.slice(0, 16).replace('T', ' ')}  ${x.minutes} min · type ${x.type} · ${methods[x.method ?? 0] ?? x.method} · ${x.origin}`,
      );
    } catch (e) {
      sessions = [`Could not read sessions: ${e instanceof Error ? e.message : String(e)}`];
    }
    setDialog({
      title: 'Activity data check',
      body: ['Last 7 days (score uses Garmin, falls back to HC):', ...days, '', `Health Connect exercise sessions (${sessions.length}):`, ...sessions].join('\n'),
    });
  };

  const reimport = async () => {
    const report = await migrateLegacyTrackers(true);
    await reload();
    setDialog({title: 'Old tracker import', body: formatImportReport(report)});
  };

  return (
    <ScrollView style={{backgroundColor: chart.page}} contentContainerStyle={{paddingTop: 4, paddingBottom: 32}}>
      <SectionHeader title="What's new" />
      <ChangelogPanel />

      <SectionHeader title="Appearance" />
      <Panel>
        <PanelHeader title="Theme" icon="theme-light-dark" color={chart.series[6]} />
        <SegmentedButtons
          value={preference}
          onValueChange={(v) => setPreference(v as ThemePreference)}
          buttons={[
            {value: 'system', label: 'System', icon: 'cellphone'},
            {value: 'light', label: 'Light', icon: 'white-balance-sunny'},
            {value: 'dark', label: 'Dark', icon: 'weather-night'},
          ]}
        />
      </Panel>

      <SectionHeader title="Goals & profile" />
      <Panel>
        <PanelHeader title="Goals" subtitle="Leave on Auto to let the app work them out" icon="flag-checkered" color={chart.category.activity} />
        <ValueRow
          title="Daily steps"
          value={settings.stepGoal ? settings.stepGoal.toLocaleString() : `Auto (${(report?.stepGoal ?? 8000).toLocaleString()})`}
          onPress={() => setEdit({title: 'Daily step goal', label: 'Steps', kind: 'number', min: 500, max: 100000, initial: settings.stepGoal ? String(settings.stepGoal) : '', hint: 'Empty uses the goal from Garmin Connect', onSave: (v) => updateSettings({stepGoal: v as number | null})})}
        />
        <ValueRow
          title="Sleep need"
          value={settings.sleepNeedMin ? formatMinutes(settings.sleepNeedMin) : `Auto (${formatMinutes(baselineNeed(sleep, today()).min)})`}
          onPress={() => setEdit({title: 'Nightly sleep need', label: 'Hours, e.g. 7.5 or 7:45', kind: 'duration', initial: settings.sleepNeedMin ? formatMinutes(settings.sleepNeedMin).replace('h ', ':').replace('m', '') : '', hint: 'Empty estimates it from your longer nights (7–9 hours)', onSave: (v) => updateSettings({sleepNeedMin: v as number | null})})}
        />
        <ValueRow
          title="Wake-up, weekdays"
          value={settings.wakeWeekday != null ? formatClock(settings.wakeWeekday) : 'Auto (usual)'}
          onPress={() => setEdit({title: 'Weekday wake-up', label: 'Time, e.g. 6:45', kind: 'time', initial: settings.wakeWeekday != null ? formatClock(settings.wakeWeekday) : '', hint: 'Used to plan your bedtime. Empty uses your usual wake time', onSave: (v) => updateSettings({wakeWeekday: v as number | null})})}
        />
        <ValueRow
          title="Wake-up, weekends"
          value={settings.wakeWeekend != null ? formatClock(settings.wakeWeekend) : 'Auto (usual)'}
          onPress={() => setEdit({title: 'Weekend wake-up', label: 'Time, e.g. 8:00', kind: 'time', initial: settings.wakeWeekend != null ? formatClock(settings.wakeWeekend) : '', hint: 'Empty uses your usual weekend wake time', onSave: (v) => updateSettings({wakeWeekend: v as number | null})})}
        />
        <ToggleRow
          title="Move bedtime gradually"
          subtitle="If your target bedtime is much earlier than usual, step towards it 30 minutes at a time"
          value={settings.gradualBedtime ?? true}
          onChange={(v) => updateSettings({gradualBedtime: v})}
        />
      </Panel>
      <Panel>
        <PanelHeader title="About you" subtitle="Improves training load and max heart rate estimates" icon="account-outline" color={chart.series[6]} />
        <ValueRow
          title="Year of birth"
          value={settings.birthYear ? String(settings.birthYear) : 'Not set'}
          onPress={() => setEdit({title: 'Year of birth', label: 'Year', kind: 'number', min: 1920, max: new Date().getFullYear() - 10, initial: settings.birthYear ? String(settings.birthYear) : '', hint: 'Used to estimate max heart rate', onSave: (v) => updateSettings({birthYear: v as number | null})})}
        />
        <View style={{flexDirection: 'row', alignItems: 'center', paddingVertical: 6}}>
          <Text variant="bodyLarge" style={{color: chart.inkPrimary, flex: 1}}>Sex</Text>
          <Menu visible={sexMenu} onDismiss={() => setSexMenu(false)} anchor={<Button compact onPress={() => setSexMenu(true)}>{settings.sex === 'male' ? 'Male' : settings.sex === 'female' ? 'Female' : 'Not set'}</Button>}>
            {[{v: null, l: 'Not set'}, {v: 'male' as const, l: 'Male'}, {v: 'female' as const, l: 'Female'}].map((o) => (
              <Menu.Item key={o.l} title={o.l} onPress={() => { setSexMenu(false); updateSettings({sex: o.v}); }} />
            ))}
          </Menu>
        </View>
        <ValueRow
          title="Max heart rate"
          value={settings.maxHr ? `${settings.maxHr} bpm` : `Auto (${report?.load.profile.maxHr ?? '–'} bpm)`}
          onPress={() => setEdit({title: 'Max heart rate', label: 'bpm', kind: 'number', min: 120, max: 230, initial: settings.maxHr ? String(settings.maxHr) : '', hint: 'From a lab test or a hard all-out effort. Empty estimates it', onSave: (v) => updateSettings({maxHr: v as number | null})})}
        />
      </Panel>
      <Panel>
        <PanelHeader title="Patterns" icon="chart-scatter-plot" color={chart.series[1]} />
        <ToggleRow
          title="Only count days I logged something"
          subtitle="Off: any day without a tag counts as a day without it. On: only days with a check-in or other tags count, in case you forget to log"
          value={settings.onlyJournaledDays ?? false}
          onChange={(v) => updateSettings({onlyJournaledDays: v})}
        />
      </Panel>

      <SectionHeader title="Data sources" />
      <Panel>
        <PanelHeader title="Health Connect" subtitle={hc ? HC_TEXT[hc] : 'Checking…'} icon="heart-pulse" color={chart.category.heart} />
        <View style={{gap: 6}}>
          <Text variant="bodySmall" style={{color: chart.inkSecondary}}>
            Steps, heart rate, sleep stages, calories and workouts that Garmin Connect shares with Health Connect.
            {hc === 'ready' && !hcHistory ? ' History access is off, so only the last 30 days can be read.' : ''}
          </Text>
          <Outcome outcome={lastSync?.healthConnect} />
        </View>
        <View style={{flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12}}>
          {hc === 'ready' ? (
            <Button onPress={() => openHealthConnectSettings()}>Manage permissions</Button>
          ) : (
            <Button mode="contained" disabled={hc === 'unavailable'} onPress={connectHc}>Connect</Button>
          )}
        </View>
      </Panel>

      <Panel>
        <PanelHeader
          title="Garmin Connect"
          subtitle={garmin.connected ? `Connected${garmin.name ? ` as ${garmin.name}` : ''}` : 'Not connected'}
          icon="watch"
          color={chart.category.recovery}
        />
        <View style={{gap: 6}}>
          <Text variant="bodySmall" style={{color: chart.inkSecondary}}>
            Body Battery, stress, sleep score, VO2 max, respiration and Pulse Ox, which Garmin does not share with Health Connect. This uses Garmin’s unofficial app API, so it can stop working if Garmin changes it.
          </Text>
          {garmin.hrv === 'no' && (
            <Text variant="bodySmall" style={{color: chart.inkMuted}}>Your watch doesn’t report overnight HRV, so overnight stress is used in its place.</Text>
          )}
          <Outcome outcome={lastSync?.garmin} />
          {lastSync?.garmin.status === 'error' && lastSync.garmin.authBroken && (
            <Text variant="bodySmall" style={{color: chart.status.critical}}>Garmin signed this app out. Sign in again to resume.</Text>
          )}
        </View>
        <View style={{flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12}}>
          {garmin.connected ? (
            <>
              <Button onPress={() => router.push('/garmin-login')}>Sign in again</Button>
              <Button onPress={disconnectGarmin}>Disconnect</Button>
            </>
          ) : (
            <Button mode="contained" onPress={() => router.push('/garmin-login')}>Sign in</Button>
          )}
        </View>
      </Panel>

      <Panel>
        <PanelHeader title="Sync" subtitle={lastSync ? `Last run ${new Date(lastSync.at).toLocaleString()}` : 'Never run'} icon="sync" color={chart.series[0]} />
        <View style={{flexDirection: 'row', justifyContent: 'flex-end'}}>
          <Button onPress={resync} disabled={syncing}>Re-download history</Button>
          <Button mode="contained" loading={syncing} disabled={syncing} onPress={() => sync().then(refresh)}>Sync now</Button>
        </View>
      </Panel>

      {Platform.OS !== 'web' && (
        <>
          <SectionHeader title="Notifications" />
          <Panel>
            <PanelHeader
              title="Notifications"
              subtitle={notifAllowed ? 'Choose what the app can tell you about' : 'Turning one on will ask for permission'}
              icon="bell-outline"
              color={chart.series[3]}
            />
            <ToggleRow title="Morning report" subtitle="Readiness, what's holding it back and today's training target, shortly after you wake" value={notif.readiness} onChange={(v) => updateNotif({readiness: v})} />
            <Divider />
            <ToggleRow
              title="Evening tag reminder"
              subtitle={`A nudge to log today's tags at ${pad(notif.eveningTagsTime.hour)}:${pad(notif.eveningTagsTime.minute)}`}
              value={notif.eveningTags}
              onChange={(v) => updateNotif({eveningTags: v})}
              right={
                <Menu
                  visible={timeMenu}
                  onDismiss={() => setTimeMenu(false)}
                  anchor={<Button compact onPress={() => setTimeMenu(true)}>{`${pad(notif.eveningTagsTime.hour)}:${pad(notif.eveningTagsTime.minute)}`}</Button>}
                >
                  {REMINDER_TIMES.map((t) => (
                    <Menu.Item key={t.hour} title={`${pad(t.hour)}:00`} onPress={() => { setTimeMenu(false); updateNotif({eveningTagsTime: t}); }} />
                  ))}
                </Menu>
              }
            />
            <Divider />
            <ToggleRow title="Strain alerts" subtitle="When several signals suggest you're run down or getting sick" value={notif.strain} onChange={(v) => updateNotif({strain: v})} />
            <Divider />
            <ToggleRow title="Bedtime reminder" subtitle="About an hour before tonight's target bedtime" value={notif.bedtime} onChange={(v) => updateNotif({bedtime: v})} />
            <Divider />
            <ToggleRow title="Weekly review" subtitle="A summary of last week on Monday morning" value={notif.weekly} onChange={(v) => updateNotif({weekly: v})} />
            <Divider />
            <ToggleRow title="Monthly review" subtitle="Your month in review on the 1st" value={notif.monthly} onChange={(v) => updateNotif({monthly: v})} />
            <Divider />
            <ToggleRow title="Sync problems" subtitle="If Garmin signs the app out and data stops syncing" value={notif.syncProblem} onChange={(v) => updateNotif({syncProblem: v})} />
            <Text variant="bodySmall" style={{color: chart.inkMuted, marginTop: 8}}>
              Checks run in the background about once an hour, so morning and alert notifications can arrive a little after the data does.
            </Text>
          </Panel>
        </>
      )}

      <SectionHeader title="Backup" />
      <Panel>
        <PanelHeader title="Backup & restore" subtitle="Your data only lives on this phone. Save a copy somewhere safe." icon="cloud-upload-outline" color={chart.series[0]} />
        <View style={{flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap'}}>
          <Button onPress={restore}>Restore from file</Button>
          <Button mode="contained" onPress={backup}>Back up now</Button>
        </View>
      </Panel>

      <Panel>
        <PanelHeader title="Export" subtitle="Spreadsheet-friendly CSV files" icon="file-delimited-outline" color={chart.series[2]} />
        <View style={{flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap'}}>
          <Button onPress={() => shareCsv('health-workouts', activitiesCsv(activities)).catch((e) => setDialog({title: 'Export failed', body: String(e)}))}>Workouts</Button>
          <Button mode="contained" onPress={() => shareCsv('health-daily', dailyCsv(daily, report, allTags, tagEntries, notes)).catch((e) => setDialog({title: 'Export failed', body: String(e)}))}>Daily data</Button>
        </View>
      </Panel>

      <SectionHeader title="Ask about your data" />
      <Panel>
        <PanelHeader
          title="Claude"
          subtitle={ai.hasKey ? 'API key saved on this phone' : 'Add your own Anthropic API key to ask questions about your data'}
          icon="chat-question-outline"
          color={chart.series[6]}
        />
        <Text variant="bodySmall" style={{color: chart.inkSecondary}}>
          Each question sends a summary of your recent data to Anthropic&apos;s API, billed to your key. Nothing is sent until you ask.
        </Text>
        <View style={{flexDirection: 'row', alignItems: 'center', paddingVertical: 6}}>
          <Text variant="bodyLarge" style={{color: chart.inkPrimary, flex: 1}}>Model</Text>
          <Menu visible={modelMenu} onDismiss={() => setModelMenu(false)} anchor={<Button compact onPress={() => setModelMenu(true)}>{AI_MODELS.find((m) => m.id === ai.model)?.label ?? ai.model}</Button>}>
            {AI_MODELS.map((m) => (
              <Menu.Item key={m.id} title={`${m.label} · ${m.detail}`} onPress={async () => { setModelMenu(false); await setModel(m.id); refresh(); }} />
            ))}
          </Menu>
        </View>
        <View style={{flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap'}}>
          {ai.hasKey && <Button onPress={async () => { await setApiKey(null); refresh(); }}>Remove key</Button>}
          <Button
            mode={ai.hasKey ? 'text' : 'contained'}
            onPress={() => setEdit({title: 'Anthropic API key', label: 'sk-ant-…', kind: 'text', secure: true, initial: '', hint: 'Create one at console.anthropic.com', onSave: async (v) => { await setApiKey(v ? String(v) : null); refresh(); }})}
          >
            {ai.hasKey ? 'Change key' : 'Add key'}
          </Button>
          {ai.hasKey && <Button mode="contained" onPress={() => router.push('/ask')}>Open</Button>}
        </View>
      </Panel>

      <SectionHeader title="Advanced" />
      <Panel>
        <PanelHeader title="Old tracker data" subtitle="Your counts from the previous version of the app" icon="history" color={chart.series[3]} />
        <View style={{flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap'}}>
          <Button onPress={async () => setDialog({title: 'Old tracker import', body: formatImportReport(await getLegacyImportReport())})}>View report</Button>
          <Button onPress={reimport}>Import again</Button>
        </View>
      </Panel>
      <Panel>
        <PanelHeader title="Debug" icon="bug-outline" color={chart.inkMuted} />
        <View style={{flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap'}}>
          <Button onPress={activityCheck}>Activity data check</Button>
          <Button
            onPress={async () => {
              setDialog({title: 'Garmin sleep need', body: 'Fetching the last 7 nights from Garmin…'});
              try {
                setDialog({title: 'Garmin sleep need', body: await sleepNeedReport()});
              } catch (e) {
                setDialog({title: 'Garmin sleep need', body: `Failed: ${e instanceof Error ? e.message : String(e)}`});
              }
            }}
          >
            Garmin sleep need check
          </Button>
          <Button onPress={reload}>Reload</Button>
          <Button onPress={async () => setDialog({title: 'Stored data', body: JSON.stringify(await dumpDatabase(), null, 2)})}>Show stored data</Button>
        </View>
      </Panel>

      <EditValueDialog spec={edit} onDismiss={() => setEdit(null)} />
      <Portal>
        <Dialog visible={dialog != null} onDismiss={() => setDialog(null)} style={{maxHeight: '85%'}}>
          <Dialog.Title>{dialog?.title}</Dialog.Title>
          <Dialog.ScrollArea>
            <ScrollView>
              <Text selectable style={{fontFamily: 'monospace', fontSize: 11, paddingVertical: 8}}>{dialog?.body}</Text>
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setDialog(null)}>Close</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}
