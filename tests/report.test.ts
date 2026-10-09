import { afterEach, describe, expect, it, vi } from 'vitest';
import { brier } from '../shared/scoring';
import { buildSeriesReport, decide, standings } from '../shared/report';
import { decisionText } from '../shared/presentation';
import type { Provider, Run, Standing } from '../shared/types';
import { providers } from '../shared/types';
import { scenarios } from '../server/scenarios';
import { demoResult } from '../server/demo';
import { Store } from '../server/store';
import { Engine } from '../server/engine';
import { buildApp } from '../server/app';
import { config, tariff } from '../server/config';
import * as cli from '../server/claude';
import * as provider from '../server/providers';

const originalConfig = { ...config };
const stores: Store[] = [];
afterEach(() => {
  stores.forEach((s) => s.close());
  stores.length = 0;
  vi.restoreAllMocks();
  Object.assign(config, originalConfig);
});
function engine() {
  const store = new Store(':memory:');
  stores.push(store);
  return new Engine(store);
}
const row = (provider: Provider, correct: number, brierScore: number | null, unavailable = 0) =>
  ({
    provider,
    correct,
    incorrect: 6 - correct - unavailable,
    uncertain: 0,
    unavailable,
    total: 6,
    brier: brierScore,
    costUsd: 0,
    unknownCosts: 0,
    inputTokens: 0,
    medianMs: null,
  }) satisfies Standing;

// A live meeting assembled from fixtures, with per-provider wrong rounds, cost and latency.
function liveRun(
  scenarioId: string,
  wrong: Partial<Record<Provider, number[]>>,
  perCall: Record<Provider, { cost: number; ms: number }>,
): Run {
  const scenario = scenarios.find((s) => s.id === scenarioId)!;
  const run = {
    id: scenarioId,
    mode: 'live',
    phase: 'complete',
    scenario,
    providers,
    rounds: [],
  } as unknown as Run;
  run.rounds = scenario.rounds.map((round, index) => ({
    roundId: round.id,
    results: Object.fromEntries(
      providers.map((p) => {
        // demoResult misses round 1 (Jev), 3 (Decisions) or 4 (Clef); remap to choose misses.
        const fixtureIndex = wrong[p]?.includes(index) ? { jev: 1, decisions: 3, clef: 4 }[p] : 0;
        return [
          p,
          {
            ...demoResult(p, run, round, fixtureIndex),
            costUsd: perCall[p].cost,
            durationMs: perCall[p].ms,
            inputTokens: 300,
          },
        ];
      }),
    ),
  }));
  return run;
}
const prices = {
  jev: { cost: 0.0000126, ms: 520 },
  decisions: { cost: 0.00003, ms: 900 },
  clef: { cost: 0.000072, ms: 410 },
};

describe('objective decision', () => {
  it('scores probability distributions with the multi-class Brier score', () => {
    const q = scenarios[0].rounds[1].question; // predicate, expected false
    const answer = (p: number) => ({
      type: 'predicate' as const,
      value: p,
      probabilities: [
        { value: 'true', label: 'Sim', probability: p },
        { value: 'false', label: 'Não', probability: 1 - p },
      ],
    });
    expect(brier(q, answer(0))).toBe(0);
    expect(brier(q, answer(1))).toBe(2);
    expect(brier(q, answer(0.27))).toBeCloseTo(2 * 0.27 ** 2, 10);
    expect(brier(q, undefined)).toBeNull();
  });
  it('ranks by points, breaks equal points by calibration and otherwise declares a tie', () => {
    expect(decide([row('jev', 5, 0.1), row('decisions', 6, 0.3), row('clef', 4, 0)])).toEqual({
      winner: 'decisions',
      reason: 'points',
    });
    expect(decide([row('jev', 6, 0.02), row('decisions', 6, 0.004), row('clef', 4, 0)])).toEqual({
      winner: 'decisions',
      reason: 'calibration',
    });
    expect(
      decide([row('jev', 6, 0.006), row('decisions', 6, 0.004), row('clef', 6, 0.005)]),
    ).toEqual({ winner: 'tie', reason: 'tie' });
  });
  it('declares no winner when missing answers could change the leader', () => {
    expect(decide([row('jev', 5, 0.1), row('decisions', 4, 0.2, 1), row('clef', 3, 0)])).toEqual({
      winner: 'inconclusive',
      reason: 'unavailable',
    });
    // Even a perfect missing answer would leave Decisions behind.
    expect(decide([row('jev', 6, 0.1), row('decisions', 4, 0.2, 1), row('clef', 3, 0)])).toEqual({
      winner: 'jev',
      reason: 'points',
    });
  });
  it('states the result in plain words', () => {
    const table = [row('jev', 6, 0.02), row('decisions', 6, 0.004), row('clef', 4, 0)];
    expect(decisionText(decide(table), table)).toBe(
      'Jev e Decisions empataram com 6 de 6 pontos; Decisions venceu no desempate, com probabilidades mais próximas do gabarito.',
    );
  });
});

describe('marathon report', () => {
  const runs = () => [
    liveRun('loja', { jev: [1] }, prices),
    liveRun('produto', { jev: [5], clef: [2] }, prices),
    liveRun('dossie-estresse', { decisions: [0] }, prices),
  ];
  it('aggregates batteries, divergences and only honest, data-backed recommendations', () => {
    const report = buildSeriesReport(runs(), providers);
    expect(report.decisions).toBe(18);
    const byProvider = Object.fromEntries(report.standings.map((s) => [s.provider, s]));
    expect(byProvider.jev.correct).toBe(16);
    expect(byProvider.decisions.correct).toBe(17);
    expect(byProvider.clef.correct).toBe(17);
    expect(report.batteries.map((b) => [b.id, b.total])).toEqual([
      ['basicos', 12],
      ['estresse', 6],
    ]);
    expect(report.batteries[1].correct).toEqual({ jev: 6, decisions: 5, clef: 6 });
    expect(report.divergences.map((d) => d.roundId)).toEqual(['l2', 'p3', 'p6', 'd1']);
    expect(report.divergences[0].answers.jev).toEqual({ label: 'Sim', status: 'incorrect' });
    expect(report.mostAccurate).toEqual(['decisions', 'clef']);
    expect(report.cheapest).toEqual(['jev']);
    expect(report.fastest).toEqual(['clef']);
    expect(report.costPerMillion.jev).toBeCloseTo(12.6, 6);
    const budget = report.recommendations.find((r) => r.kind === 'budget')!;
    expect(budget.providers).toEqual(['jev']);
    expect(budget.text).toMatch(
      /^Jev tem custo estimado da API [\d,]+× menor por decisão que (Decisions|Clef) e acertou 1 decisão a menos \(16 contra 17 de 18\)\.$/,
    );
    expect(report.recommendations.find((r) => r.kind === 'speed')!.text).toBe(
      'Clef teve a menor mediana de resposta: 0,41 s por decisão, incluindo a rede.',
    );
  });
  it('reports a shared speed lead and the token count behind the price per decision', () => {
    const tied = { ...prices, jev: { cost: 0.0000126, ms: 400 } };
    const series = [
      liveRun('loja', { jev: [1] }, tied),
      liveRun('produto', { jev: [5], clef: [2] }, tied),
      liveRun('dossie-estresse', { decisions: [0] }, tied),
    ];
    for (const run of series) for (const round of run.rounds) round.results.jev!.inputTokens = 450;
    const report = buildSeriesReport(series, providers);
    expect(report.fastest).toEqual(['jev', 'clef']);
    const speed = report.recommendations.find((r) => r.kind === 'speed')!;
    expect(speed.providers).toEqual(['jev', 'clef']);
    expect(speed.text).toBe(
      'Jev e Clef empataram com a menor mediana de resposta, a menos de 50 ms um do outro: Jev 0,40 s e Clef 0,41 s por decisão, incluindo a rede.',
    );
    expect(report.recommendations.find((r) => r.kind === 'budget')!.text).toMatch(
      /Para o mesmo texto, Jev contou 450 tokens por decisão, contra 300 de (Decisions|Clef)\.$/,
    );
    for (const run of series)
      for (const round of run.rounds) round.results.decisions!.durationMs = 420;
    expect(
      buildSeriesReport(series, providers).recommendations.find((r) => r.kind === 'speed')!.text,
    ).toMatch(/^Todos responderam em tempos equivalentes/);
  });
  it('withholds cost and speed claims when usage is unknown or the data is synthetic', () => {
    const partial = runs();
    partial[0].rounds[0].results.clef!.costUsd = null;
    const report = buildSeriesReport(partial, providers);
    expect(report.cheapest).toEqual([]);
    expect(report.costPerMillion).toEqual({});
    expect(report.recommendations.some((r) => r.kind === 'budget')).toBe(false);
    const demo = runs().map((r) => ({ ...r, mode: 'demo' as const }));
    expect(buildSeriesReport(demo, providers).recommendations).toEqual([]);
    expect(standings(demo, providers)[0].medianMs).toBeNull();
  });
});

describe('automatic marathon', () => {
  it('runs all six meetings by itself, then builds the report without manual steps', async () => {
    Object.assign(config, { AUTOPLAY_DELAY_MS: 0, SERIES_PAUSE_MS: 0 });
    const calls = vi.spyOn(cli, 'callClaude');
    const e = engine();
    const started = await e.startSeries('demo');
    await vi.waitFor(() => expect(e.store.getSeries(started.id)?.phase).toBe('complete'), {
      timeout: 5000,
    });
    const series = e.store.getSeries(started.id)!;
    expect(series.runIds).toHaveLength(6);
    const meetings = series.runIds.map((id) => e.store.get(id)!);
    expect(meetings.map((r) => r.scenario.id)).toEqual(scenarios.map((s) => s.id));
    expect(meetings.every((r) => r.phase === 'complete' && r.autoplay && r.seriesId)).toBe(true);
    expect(series.report?.decisions).toBe(36);
    expect(series.report?.reason).toBeDefined();
    expect(calls).not.toHaveBeenCalled();
    // Marathon meetings appear only through their marathon in the history.
    expect(e.store.list()).toHaveLength(0);
    expect(e.store.listSeries()).toMatchObject([{ id: series.id, completedMeetings: 6 }]);
    const app = await buildApp(e);
    const exported = (await app.inject({ url: `/api/series/${series.id}/export` })).json();
    expect(exported.meetings).toHaveLength(6);
    expect(
      (await app.inject({ method: 'DELETE', url: `/api/series/${series.id}` })).json(),
    ).toEqual({ removed: 1 });
    expect(e.store.get(series.runIds[0])).toBeUndefined();
    await app.close();
  });
  it('makes 49 Opus calls in a live marathon: per meeting 1 opening, 6 comments, 1 explanation, plus a final reading', async () => {
    Object.assign(config, {
      AUTOPLAY_DELAY_MS: 0,
      SERIES_PAUSE_MS: 0,
      OPENAI_API_KEY: 'x',
      TYPESAFE_API_KEY: 'x',
      CLOUDFLARE_ACCOUNT_ID: 'x',
      CLOUDFLARE_API_TOKEN: 'x',
    });
    vi.spyOn(cli, 'cliStatus').mockResolvedValue({ available: true, authenticated: true });
    vi.spyOn(provider, 'evaluate').mockImplementation(async (p, s, r) => ({
      ...demoResult(p, { scenario: s } as Run, r, s.rounds.indexOf(r)),
      costUsd: (300 * tariff[p]) / 1e6,
      durationMs: p === 'clef' ? 300 : 600,
    }));
    const calls = vi.spyOn(cli, 'callClaude').mockImplementation(async (role, prompt) => {
      const scenario = scenarios.find((s) => prompt.includes(JSON.stringify(s.title)));
      const value =
        role === 'moderator'
          ? {
              introduction: 'Abertura',
              rounds: scenario!.rounds.map((r) => ({ id: r.id, transition: 'Transição' })),
            }
          : role === 'commentator'
            ? { text: 'Comentário' }
            : {
                headline: '[[A]] e [[B]] empataram na maratona',
                summary: 'Leitura',
                evidence: [{ roundId: 'l2', participant: 'both', observation: 'Evidência' }],
                limitations: ['Amostra fictícia'],
              };
      return {
        value,
        call: {
          role,
          prompt,
          durationMs: 1,
          model: 'fixture',
          estimatedUsd: null,
          inputTokens: 1,
          outputTokens: 1,
          output: value,
        },
      } as any;
    });
    const e = engine();
    const started = await e.startSeries('live');
    await vi.waitFor(() => expect(e.store.getSeries(started.id)?.phase).toBe('complete'), {
      timeout: 5000,
    });
    const series = e.store.getSeries(started.id)!;
    expect(calls).toHaveBeenCalledTimes(49);
    expect(series.analysis?.headline).toContain('[[A]]');
    expect(series.report?.cheapest).toEqual(['jev']);
    expect(series.report?.recommendations.map((r) => r.kind)).toEqual([
      'accuracy',
      'budget',
      'speed',
    ]);
    const finalPrompt = calls.mock.calls.at(-1)![1];
    for (const brand of ['Jev', 'Decisions', 'Clef', 'costUsd', 'durationMs'])
      expect(finalPrompt).not.toContain(brand);
  });
  it('stops the marathon and its meeting together when cancelled', async () => {
    Object.assign(config, { AUTOPLAY_DELAY_MS: 60000 });
    const e = engine();
    const started = await e.startSeries('demo');
    await vi.waitFor(() => expect(e.store.get(started.runIds[0])?.phase).toBe('ready'));
    expect(e.store.get(started.runIds[0])?.nextAdvanceAt).toBeDefined();
    e.cancelSeries(started.id);
    expect(e.store.getSeries(started.id)?.phase).toBe('cancelled');
    expect(e.store.get(started.runIds[0])?.phase).toBe('cancelled');
    await expect(e.startSeries('demo')).resolves.toBeDefined();
    e.close();
  });
});
