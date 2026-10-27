import * as SecureStore from 'expo-secure-store';
import {kvGet, kvSet} from '@/db/repo';
import {ACTION_TEXT, InsightReport, topEffects} from '@/insights';
import {mean, round} from '@/insights/stats';
import {weekStart} from '@/insights/tagStats';
import {addDays, formatClock, formatMinutes, IsoDate} from '@/lib/dates';
import {DailyData, MetricId, Tag, TagEntry} from '@/metrics/types';

const KEY_STORE = 'anthropic_api_key';
const MODEL_KEY = 'ai.model';

export const AI_MODELS = [
  {id: 'claude-opus-5-5', label: 'Claude Opus 5.5', detail: 'Most capable'},
  {id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', detail: 'Faster, cheaper'},
  {id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5', detail: 'Fastest'},
];

export async function getApiKey(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(KEY_STORE);
  } catch {
    return null;
  }
}

export async function setApiKey(key: string | null) {
  if (key) await SecureStore.setItemAsync(KEY_STORE, key.trim());
  else await SecureStore.deleteItemAsync(KEY_STORE);
}

export async function getModel(): Promise<string> {
  return (await kvGet(MODEL_KEY)) || AI_MODELS[0].id;
}

export async function setModel(model: string) {
  await kvSet(MODEL_KEY, model);
}

const WEEKLY_METRICS: MetricId[] = [
  'sleep_total_min', 'sleep_start', 'resting_hr', 'hrv_overnight', 'sleep_stress', 'stress_avg', 'body_battery_wake',
  'steps', 'intensity_min', 'active_kcal', 'weight_kg', 'checkin_energy', 'checkin_mood',
];

const DAILY_METRICS: MetricId[] = [
  'sleep_total_min', 'sleep_start', 'sleep_end', 'resting_hr', 'sleep_stress', 'respiration_sleep', 'body_battery_wake',
  'body_battery_high', 'stress_avg', 'steps', 'intensity_min', 'checkin_energy', 'checkin_mood', 'checkin_soreness',
];

function fmtValue(metric: MetricId, v: number): string {
  if (metric === 'sleep_start' || metric === 'sleep_end') return formatClock(v);
  if (metric.endsWith('_min') && metric !== 'intensity_min') return formatMinutes(v);
  return String(round(v, 1));
}

/**
 * Everything the model may use, computed by the app. The model is told to stick to these numbers, which avoids the
 * invented figures people complain about in other wearable AI coaches.
 */
export function buildContext(input: {report: InsightReport; daily: DailyData; tags: Tag[]; tagEntries: TagEntry[]; today: IsoDate}): string {
  const {report, daily, tags, tagEntries, today} = input;
  const lines: string[] = [`Today is ${today}. Overnight metrics are dated by the morning you woke up.`];

  const score = (name: string, s: InsightReport['readiness']) => {
    if (!s) return;
    lines.push(`${name}: ${s.value}/100 (${s.action ? ACTION_TEXT[s.action].label : s.label}${s.calibrating ? ', still calibrating' : ''})`);
    for (const c of s.contributors) lines.push(`  - ${c.label}: ${c.score}/100, ${c.detail}`);
  };
  score('Readiness today', report.readiness);
  score('Last night\'s sleep score', report.sleep);
  score('Activity score today', report.activity);
  if (report.status) lines.push(`User has marked themselves as "${report.status.kind}" since ${report.status.start}.`);

  const plan = report.sleepPlan;
  lines.push(
    `Sleep plan for the night before ${plan.wakeDate}: need ${formatMinutes(plan.need.tonightMin)} (baseline ${formatMinutes(plan.need.baselineMin)}, ` +
      `debt payback ${plan.need.debtRepayMin} min, training extra ${plan.need.strainMin} min), wake ${formatClock(plan.wakeTarget)}, be asleep by ${formatClock(plan.stepBedtime ?? plan.bedtime)}. ` +
      `Sleep debt over 14 nights: ${plan.debt ? formatMinutes(plan.debt.debtMin) : 'unknown'} (${plan.debtLevel}).`,
  );

  const load = report.load;
  lines.push(
    `Training load: status ${load.status}, 7-day avg ${load.acute ?? '?'} vs 28-day avg ${load.chronic ?? '?'} per day (ratio ${load.today?.acwr ?? '?'}), ` +
      `form zone ${load.formZone ?? '?'}, this week ${load.weekLoad} vs last week ${load.prevWeekLoad}. Today's target ${load.target ? `${load.target.low}-${load.target.high}` : 'none'}, done so far ${load.today?.load ?? 0}.`,
  );

  lines.push(`Body check: strain radar ${report.bodyCheck.radar.level}.${report.bodyCheck.radar.hits.map((h) => ` ${h.text}.`).join('')}`);
  for (const v of report.bodyCheck.vitals) lines.push(`  - ${v.label} ${round(v.value, v.decimals)}${v.unit} (usual ${round(v.mean, v.decimals)} ± ${round(v.sd, v.decimals)}): ${v.tier}`);

  const effects = topEffects(report.effects.effects, {minConfidence: 'possible', limit: 25});
  if (effects.length) {
    lines.push('Patterns found in the data (correlations; confidence strong > likely > possible):');
    for (const e of effects) lines.push(`  - [${e.confidence}] ${e.summary} (${e.nWith} days with vs ${e.nWithout} without)`);
  }
  for (const o of report.effects.overlaps) lines.push(`  - ${o.aName} and ${o.bName} are usually logged together, effects can't be separated.`);

  lines.push('Weekly averages, oldest first (Monday-start weeks):');
  const weeks: IsoDate[] = [];
  for (let w = weekStart(addDays(today, -7 * 11)); w <= today; w = addDays(w, 7)) weeks.push(w);
  for (const m of WEEKLY_METRICS) {
    const series = daily[m];
    if (!series?.size) continue;
    const cells = weeks.map((w) => {
      const vals: number[] = [];
      for (let i = 0; i < 7; i++) {
        const v = series.get(addDays(w, i));
        if (v != null) vals.push(v);
      }
      return vals.length ? fmtValue(m, mean(vals)!) : '-';
    });
    lines.push(`  ${m}: ${cells.join(', ')}`);
  }
  const readinessWeeks = weeks.map((w) => {
    const vals = report.history.days.filter((d) => d.date >= w && d.date < addDays(w, 7) && d.readiness).map((d) => d.readiness!.value);
    return vals.length ? String(Math.round(mean(vals)!)) : '-';
  });
  lines.push(`  readiness: ${readinessWeeks.join(', ')}`);

  lines.push('Last 14 days, oldest first:');
  for (const m of DAILY_METRICS) {
    const series = daily[m];
    if (!series?.size) continue;
    const cells = Array.from({length: 14}, (_, i) => {
      const v = series.get(addDays(today, i - 13));
      return v == null ? '-' : fmtValue(m, v);
    });
    lines.push(`  ${m}: ${cells.join(', ')}`);
  }

  if (tags.length) {
    lines.push('Tags logged in the last 14 days (date: tags):');
    for (let i = 13; i >= 0; i--) {
      const d = addDays(today, -i);
      const logged = tagEntries.filter((e) => e.date === d && e.value > 0).map((e) => {
        const t = tags.find((x) => x.id === e.tagId);
        return t ? `${t.name}${e.value !== 1 || t.unit ? ` ${e.value}${t.unit ? ` ${t.unit}` : ''}` : ''}` : null;
      }).filter(Boolean);
      if (logged.length) lines.push(`  ${d}: ${logged.join(', ')}`);
    }
  }
  for (const r of report.experiments) {
    lines.push(`Experiment "${r.experiment.name}" (${r.state}, ${r.experiment.start}, ${r.experiment.days} days): ${r.verdict ?? 'no result yet'}`);
  }
  if (report.insights.length) {
    lines.push('Current insight cards:');
    for (const i of report.insights) lines.push(`  - ${i.title}: ${i.body}`);
  }
  return lines.join('\n');
}

const SYSTEM = `You are a thoughtful health data analyst inside a personal tracker app. The user wears a Garmin vivomove Trend (no HRV; stress is Garmin's HRV-derived stress score).
Answer using ONLY the data provided below. Quote the specific numbers you rely on. If the data doesn't answer the question, say so plainly instead of guessing.
Correlations are not causation; say how confident a pattern is. Be concise, warm and practical, with at most a few short paragraphs or a short list. You are not a doctor; suggest seeing one for anything that looks medical.`;

export type ChatMessage = {role: 'user' | 'assistant'; content: string};

export async function askClaude(messages: ChatMessage[], context: string): Promise<string> {
  const key = await getApiKey();
  if (!key) throw new Error('Add your Anthropic API key in Settings first.');
  const model = await getModel();
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01'},
    body: JSON.stringify({model, max_tokens: 1200, system: `${SYSTEM}\n\n<data>\n${context}\n</data>`, messages}),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error?.message ?? `Request failed (HTTP ${res.status})`);
  const text = (body?.content ?? []).filter((c: {type: string}) => c.type === 'text').map((c: {text: string}) => c.text).join('\n').trim();
  return text || 'No answer came back.';
}
