import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Brava, Provider, Run, Series } from '../shared/types';
import { buildConclusionData, type ConclusionData } from '../report/data';
import { edition } from '../report/edition';
import { scenarios } from '../server/scenarios';
import { demoResult } from '../server/demo';
import { Store } from '../server/store';
import { Engine } from '../server/engine';
import { buildApp } from '../server/app';

const html = readFileSync('reports/relatorio-conclusao.html', 'utf8');
const data: ConclusionData = JSON.parse(html.match(/id="report-data">(.*?)<\/script>/s)![1]);
const providers: Provider[] = ['jev', 'decisions', 'clef'];
function fixture() {
  const run: Run = {
    id: 'fixture',
    mode: 'live',
    phase: 'complete',
    createdAt: '2026-10-09T13:00:00Z',
    updatedAt: '2026-10-09T13:01:00Z',
    scenario: scenarios[0],
    scenarioHash: 'fixture',
    rounds: [],
    cliCalls: [],
    providers,
    tariff: { date: '2026-10-08', jev: 0.042, decisions: 0.1, clef: 0.24 },
  };
  run.rounds = run.scenario.rounds.map((q, i) => ({
    roundId: q.id,
    results: Object.fromEntries(
      providers.map((p) => [p, { ...demoResult(p, run, q, i), inputTokens: 100, costUsd: 0.0001 }]),
    ),
  }));
  const series: Series = {
    id: 'series',
    mode: 'live',
    phase: 'complete',
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    providers,
    scenarioIds: [run.scenario.id],
    runIds: [run.id],
    cliCalls: [],
    tariff: run.tariff,
  };
  const brava: Brava = {
    id: 'brava',
    kind: 'brava',
    mode: 'live',
    phase: 'complete',
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    providers,
    catalogHash: 'fixture',
    currentBattery: 0,
    comments: {},
    cliCalls: [],
    tariff: run.tariff,
    batteries: [
      {
        id: 'injecao',
        title: 'Teste',
        description: '',
        unit: 'item',
        itemIds: run.scenario.rounds.map((q) => q.id),
      },
    ],
    items: run.scenario.rounds.map((q) => ({
      ...q,
      battery: 'injecao',
      context: 'Política do caso',
    })),
    results: Object.fromEntries(run.rounds.map((r) => [r.roundId, r.results])),
  };
  const visual = structuredClone(brava);
  visual.id = 'visual';
  visual.kind = 'visual';
  const make = () =>
    buildConclusionData(series, [run], brava, visual, [], {
      preparedAt: run.createdAt,
      revision: 'fixture',
      rulesHash: 'fixture',
    });
  return { run, series, brava, visual, make };
}

describe('conclusão fixada para a gravação', () => {
  it('preserva as três execuções e a cobertura sem falhas', () => {
    expect([data.series.id, data.brava.id, data.visual.id]).toEqual([
      edition.series,
      edition.brava,
      edition.visual,
    ]);
    expect(data.series.meetings).toHaveLength(6);
    expect(data.brava.batteries.flatMap((b) => b.items)).toHaveLength(298);
    expect(data.visual.batteries.flatMap((b) => b.items)).toHaveLength(80);
    const standings = [
      ...data.series.report.standings,
      ...data.brava.report.standings,
      ...data.visual.report.standings,
    ];
    expect(standings.reduce((n, s) => n + s.total, 0)).toBe(1162);
    expect(standings.every((s) => s.unavailable === 0 && s.unknownCosts === 0)).toBe(true);
    expect(data.series.report.standings.map((s) => s.correct)).toEqual([35, 35, 36]);
    expect(data.brava.report.standings.map((s) => s.correct)).toEqual([276, 293, 292]);
    expect(data.visual.report.standings.map((s) => s.correct)).toEqual([65, 69]);
  });
  it('sustenta as recomendações e preserva a incerteza', () => {
    expect(data.brava.report.winner).toBe('clef');
    expect(data.visual.report.cheapest).toEqual(['decisions']);
    expect(data.visual.report.margins[0]).toMatchObject({ vs: 'decisions', within: true });
    expect(
      data.brava.report.batteries.find((b) => b.id === 'portugues')?.scores.decisions,
    ).toBeCloseTo(56 / 60);
    expect(data.visual.report.batteries.find((b) => b.id === 'distancia')?.scores).toMatchObject({
      decisions: 0.7,
      clef: 0.9,
    });
    expect(data.visual.report.standings[0].costUsd).toBeCloseTo(0.0066408, 10);
    expect(data.visual.report.standings[1].costUsd).toBeCloseTo(0.01472712, 10);
  });
  it('mantém rastreabilidade sem payloads ou texto sensível', () => {
    expect(data.previous.map((p) => p.errors.length)).toEqual([2, 2, 2, 20]);
    const sensitive = data.brava.batteries.flatMap((b) => b.items).filter((i) => i.sensitive);
    expect(sensitive).toHaveLength(20);
    expect(
      sensitive.every(
        (i) => i.context === '' && i.facts === 'Texto sensível omitido, como na arena.',
      ),
    ).toBe(true);
    expect(html).not.toMatch(/<script[^>]+src=|<link[^>]+href="https?:/);
    expect(JSON.stringify(data)).not.toMatch(
      /"(?:rawRequest|rawResponse|apiKey|authorization|cliCalls)":/i,
    );
  });
  it('remove fatos e contexto sensíveis ao preparar a edição e não altera o histórico', () => {
    const f = fixture();
    f.brava.items[0].sensitive = true;
    f.brava.items[0].facts = 'SECRET-SENSITIVE-FACT';
    f.brava.items[0].context = 'SECRET-SENSITIVE-CONTEXT';
    const before = JSON.stringify(f.brava);
    const result = f.make();
    expect(JSON.stringify(result)).not.toMatch(/SECRET-SENSITIVE/);
    expect(JSON.stringify(f.brava)).toBe(before);
    expect(result.series.report.standings[0].inputTokens).toBe(600);
  });
  it.each(['missing-response', 'unknown-cost', 'non-finite-cost', 'missing-tokens'] as const)(
    'recusa edição com %s',
    (kind) => {
      const f = fixture(),
        first = f.visual.results[f.visual.items[0].id];
      if (kind === 'missing-response') delete first.clef;
      if (kind === 'unknown-cost') first.clef!.costUsd = null;
      if (kind === 'non-finite-cost') first.clef!.costUsd = NaN;
      if (kind === 'missing-tokens') first.clef!.inputTokens = null;
      expect(f.make).toThrow('respostas e custos completos');
    },
  );
  it('recusa ensaios e reuniões de outra maratona', () => {
    const f = fixture();
    f.series.mode = 'demo';
    expect(f.make).toThrow('reais concluídas');
    f.series.mode = 'live';
    f.series.runIds = ['outro'];
    expect(f.make).toThrow('não correspondem');
  });
  it('serve o HTML pelo estúdio sem tocar no histórico', async () => {
    const store = new Store(':memory:');
    const engine = new Engine(store);
    const app = await buildApp(engine);
    try {
      const res = await app.inject({ url: '/relatorio-conclusao.html' });
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
      expect(res.body).toBe(html);
      expect(store.list()).toEqual([]);
    } finally {
      await app.close();
      engine.close();
      store.close();
    }
  });
});
