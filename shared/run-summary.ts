import type { Provider, Run, RunSummary, Series, SeriesSummary } from './types';
import { runProviders } from './types';

export function summarizeRun(run: Run): RunSummary {
  const cost = (provider: Provider) =>
    run.rounds.reduce(
      (total, round) => {
        const value = round.results[provider]?.costUsd;
        if (typeof value === 'number' && Number.isFinite(value) && value >= 0)
          total.knownUsd += value;
        else total.unknown++;
        return total;
      },
      { knownUsd: 0, unknown: 0 },
    );
  const participants = runProviders(run);
  const costs = Object.fromEntries(participants.map((p) => [p, cost(p)])) as Record<
    Provider,
    { knownUsd: number; unknown: number }
  >;
  const comparable =
    run.mode === 'live' &&
    run.phase === 'complete' &&
    run.rounds.length > 0 &&
    run.rounds.length === run.scenario.rounds.length &&
    participants.every((p) => costs[p].unknown === 0);
  // Compare original totals, allowing only floating-point addition noise.
  const lowest = Math.min(...participants.map((p) => costs[p].knownUsd));
  const cheapest = participants.filter((p) => Math.abs(costs[p].knownUsd - lowest) < 1e-12);
  return {
    id: run.id,
    mode: run.mode,
    createdAt: run.createdAt,
    phase: run.phase,
    title: run.scenario.title,
    completedRounds: run.rounds.length,
    providers: participants,
    winner:
      run.mode === 'live' && run.phase === 'complete'
        ? (run.verdict?.winner ?? 'inconclusive')
        : null,
    costs,
    cheapest: comparable ? (cheapest.length === 1 ? cheapest[0] : 'tie') : null,
  };
}

export function summarizeSeries(series: Series): SeriesSummary {
  return {
    id: series.id,
    mode: series.mode,
    createdAt: series.createdAt,
    phase: series.phase,
    totalMeetings: series.scenarioIds.length,
    completedMeetings: series.report
      ? series.scenarioIds.length
      : Math.max(0, series.runIds.length - (series.phase === 'running' ? 1 : 0)),
    winner: series.mode === 'live' && series.report ? series.report.winner : null,
    cheapest: series.mode === 'live' ? (series.report?.cheapest ?? []) : [],
  };
}
