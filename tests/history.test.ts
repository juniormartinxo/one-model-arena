import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { summarizeRun } from '../shared/run-summary';
import type { Brava, BravaKind, Run } from '../shared/types';
import { buildBravaReport } from '../shared/brava-report';
import { scenarios } from '../server/scenarios';
import { demoResult } from '../server/demo';
import { Store } from '../server/store';
import { Engine } from '../server/engine';
import { buildApp } from '../server/app';

function fixture(): Run {
  const run: Run = {
    id: randomUUID(),
    mode: 'live',
    phase: 'complete',
    createdAt: '2026-10-08T21:48:33Z',
    updatedAt: '2026-10-08T21:50:00Z',
    scenario: scenarios[0],
    scenarioHash: 'fixture',
    rounds: [],
    cliCalls: [],
    providers: ['jev', 'decisions', 'clef'],
    tariff: { date: '2026-10-08', jev: 0.042, decisions: 0.1, clef: 0.24 },
    verdict: { winner: 'decisions', summary: 'Resultado de teste.', passes: [] },
  };
  run.rounds = run.scenario.rounds.map((round, index) => ({
    roundId: round.id,
    results: {
      jev: { ...demoResult('jev', run, round, index), costUsd: 0.0001 },
      decisions: { ...demoResult('decisions', run, round, index), costUsd: 0.0002 },
      clef: { ...demoResult('clef', run, round, index), costUsd: 0.0003 },
    },
  }));
  return run;
}

function bravaFixture(kind: BravaKind): Brava {
  const run = fixture();
  const participants = kind === 'visual' ? (['decisions', 'clef'] as const) : run.providers!;
  const battery = kind === 'visual' ? 'contagem' : 'injecao';
  const items: Brava['items'] = run.scenario.rounds.map((round) => ({
    ...round,
    battery,
    context: '',
  }));
  const brava: Brava = {
    id: run.id,
    kind,
    mode: 'live',
    phase: 'complete',
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    providers: [...participants],
    catalogHash: 'fixture',
    batteries: [
      {
        id: battery,
        title: 'Teste',
        description: '',
        unit: 'item',
        itemIds: items.map((i) => i.id),
      },
    ],
    items,
    results: Object.fromEntries(
      run.rounds.map((round) => [
        round.roundId,
        Object.fromEntries(participants.map((p) => [p, round.results[p]])),
      ]),
    ),
    currentBattery: 0,
    comments: {},
    cliCalls: [],
    tariff: run.tariff,
  };
  brava.report = buildBravaReport(brava, brava.providers);
  return brava;
}

describe('saved history result and cost summary', () => {
  it.each(['brava', 'visual'] as const)(
    'serves the %s cost award, including ties and incomplete or synthetic costs',
    async (kind) => {
      const store = new Store(':memory:');
      const engine = new Engine(store);
      const app = await buildApp(engine);
      try {
        const brava = bravaFixture(kind);
        const check = async (expected: Brava['providers']) => {
          store.saveBrava(brava);
          const before = store.getBrava(brava.id);
          const response = await app.inject({ url: '/api/bravas' });
          expect(response.statusCode).toBe(200);
          expect(response.json()[0]).toMatchObject({ id: brava.id, kind, cheapest: expected });
          expect(response.json()[0]).not.toHaveProperty('results');
          expect(store.getBrava(brava.id)).toEqual(before);
        };
        await check([kind === 'visual' ? 'decisions' : 'jev']);
        for (const byProvider of Object.values(brava.results))
          for (const result of Object.values(byProvider)) result!.costUsd = 0.0001;
        await check(brava.providers);
        brava.results[brava.items[0].id].clef!.costUsd = null;
        await check([]);
        brava.results[brava.items[0].id].clef!.costUsd = 0.0001;
        brava.mode = 'demo';
        await check([]);
        brava.mode = 'live';
        brava.phase = 'cancelled';
        await check([]);
      } finally {
        await app.close();
        engine.close();
        store.close();
      }
    },
  );
  it('serves all saved costs and independent awards without changing evidence', async () => {
    const store = new Store(':memory:');
    const engine = new Engine(store);
    const app = await buildApp(engine);
    try {
      const run = fixture();
      store.save(run);
      const original = store.events(run.id);
      const response = await app.inject({ url: '/api/runs' });
      expect(response.statusCode).toBe(200);
      const [summary] = response.json();
      expect(summary.winner).toBe('decisions');
      expect(summary.cheapest).toBe('jev');
      expect(summary.providers).toEqual(['jev', 'decisions', 'clef']);
      expect(summary.costs.jev.knownUsd).toBeCloseTo(0.0006, 12);
      expect(summary.costs.decisions.knownUsd).toBeCloseTo(0.0012, 12);
      expect(summary.costs.clef.knownUsd).toBeCloseTo(0.0018, 12);
      expect(summary.costs.jev.unknown).toBe(0);
      expect(summary).not.toHaveProperty('rounds');
      expect(store.events(run.id)).toEqual(original);
      expect(store.get(run.id)).toEqual(run);
    } finally {
      await app.close();
      engine.close();
      store.close();
    }
  });
  it('compares before display rounding and recognizes numerical ties', () => {
    const run = fixture();
    for (const round of run.rounds) {
      round.results.jev!.costUsd = 0.00000102;
      round.results.decisions!.costUsd = 0.00000101;
      round.results.clef!.costUsd = 0.00000103;
    }
    expect(summarizeRun(run).cheapest).toBe('decisions');
    for (const round of run.rounds) round.results.clef!.costUsd = 0.000001;
    expect(summarizeRun(run).cheapest).toBe('clef');
    for (const round of run.rounds) {
      round.results.jev!.costUsd = 0;
      round.results.decisions!.costUsd = 0;
      round.results.clef!.costUsd = 0.1;
    }
    run.rounds[0].results.jev!.costUsd = 0.1;
    run.rounds[1].results.jev!.costUsd = 0.2;
    run.rounds[0].results.decisions!.costUsd = 0.3;
    expect(summarizeRun(run).cheapest).toBe('tie');
  });
  it('keeps missing usage/results unknown, preserving the known subtotal', () => {
    const run = fixture();
    run.rounds[0].results.jev!.costUsd = null;
    delete run.rounds[1].results.jev;
    const summary = summarizeRun(run);
    expect(summary.costs.jev!.knownUsd).toBeCloseTo(0.0004, 12);
    expect(summary.costs.jev!.unknown).toBe(2);
    expect(summary.cheapest).toBeNull();
    expect(summary.winner).toBe('decisions');
  });
  it('summarizes recordings made before Clef joined as a two-way comparison', () => {
    const run = fixture();
    delete run.providers;
    for (const round of run.rounds) delete round.results.clef;
    const summary = summarizeRun(run);
    expect(summary.providers).toEqual(['jev', 'decisions']);
    expect(summary.costs).not.toHaveProperty('clef');
    expect(summary.cheapest).toBe('jev');
  });
  it.each(['cancelled', 'failed', 'ready'] as const)(
    'does not give a final award for %s',
    (phase) => {
      const run = fixture();
      run.phase = phase;
      expect(summarizeRun(run).cheapest).toBeNull();
      expect(summarizeRun(run).winner).toBeNull();
      expect(summarizeRun(run).costs.jev!.knownUsd).toBeGreaterThan(0);
    },
  );
  it('does not award synthetic, empty or incomplete comparisons', () => {
    const run = fixture();
    run.mode = 'demo';
    expect(summarizeRun(run).cheapest).toBeNull();
    expect(summarizeRun(run).winner).toBeNull();
    run.mode = 'live';
    run.rounds.pop();
    expect(summarizeRun(run).cheapest).toBeNull();
    run.rounds = [];
    expect(summarizeRun(run).cheapest).toBeNull();
  });
  it('preserves ties and inconclusive verdicts', () => {
    const run = fixture();
    run.verdict!.winner = 'tie';
    expect(summarizeRun(run).winner).toBe('tie');
    delete run.verdict;
    expect(summarizeRun(run).winner).toBe('inconclusive');
  });
});
