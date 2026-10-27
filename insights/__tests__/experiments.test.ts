import {describe, expect, it} from '@jest/globals';
import {addDays, IsoDate} from '@/lib/dates';
import {evaluateExperiment} from '@/insights/experiments';
import {TODAY} from '@/insights/__fixtures__/series';
import {Experiment, TagEntry} from '@/metrics/types';

const noise = (i: number) => ((i * 37) % 11) - 5;

describe('evaluateExperiment', () => {
  const start = addDays(TODAY, -13);
  const experiment: Experiment = {
    id: 'e', name: 'No alcohol', tagId: 'alcohol', mode: 'avoid', start, days: 14, prediction: 'better',
    metrics: ['sleep_score', 'steps'], createdAt: 0, endedAt: null,
  };
  const sleepScores = new Map<IsoDate, number>();
  for (let i = -1; i < 60; i++) {
    const wake = addDays(TODAY, -i);
    sleepScores.set(wake, (addDays(wake, -1) >= start ? 84 : 76) + noise(i) * 0.5);
  }
  const tagEntries: TagEntry[] = [{tagId: 'alcohol', date: addDays(TODAY, -3), value: 2}];
  const base = {today: TODAY, daily: {}, sleepScores, readiness: new Map(), tags: [], tagEntries};

  it('compares the experiment with the weeks before it and checks the prediction', () => {
    const done = evaluateExperiment({...base, today: addDays(TODAY, 1)}, experiment);
    expect({
      state: done.state,
      compliance: done.compliance,
      main: [done.metrics[0].label, Math.round(done.metrics[0].diff!), done.metrics[0].improved, done.metrics[0].nDuring, done.metrics[0].nBefore],
      steps: done.metrics[1].text,
      verdict: done.verdict,
      matched: done.predictionMatched,
    }).toEqual({
      state: 'done',
      compliance: {kept: 13, logged: 14},
      main: ['Sleep score', 8, true, 14, 14],
      steps: 'Not enough data yet',
      verdict: 'Sleep score got better: 8 points higher than before.',
      matched: true,
    });
  });

  it('shows progress while running and nothing before it starts', () => {
    const running = evaluateExperiment(base, experiment);
    expect({state: running.state, days: running.daysElapsed, nDuring: running.metrics[0].nDuring}).toEqual({state: 'running', days: 14, nDuring: 13});
    const upcoming = evaluateExperiment({...base, today: addDays(start, -1)}, experiment);
    expect({state: upcoming.state, days: upcoming.daysElapsed, verdict: upcoming.verdict}).toEqual({state: 'upcoming', days: 0, verdict: null});
  });
});
