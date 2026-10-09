import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Brava, BravaItem, Provider, ProviderResult } from '../shared/types';
import { providers } from '../shared/types';
import { asRequest, buildCatalog, demoAnswer, typos } from '../server/brava/catalog';
import { buildBravaReport } from '../shared/brava-report';
import { requestFor } from '../server/providers';
import { gradeAnswer } from '../shared/scoring';
import { Store } from '../server/store';
import { Engine } from '../server/engine';
import { buildApp } from '../server/app';
import { config } from '../server/config';
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
const emptyDir = () => mkdtempSync(join(tmpdir(), 'brava-'));
function withDatasets() {
  const dir = emptyDir();
  mkdirSync(join(dir, 'datasets'));
  const items = (['assin2', 'hatebr', 'b2w'] as const).flatMap((dataset) =>
    Array.from({ length: 20 }, (_, i) => ({
      dataset,
      id: String(i),
      text: `Texto ${dataset} ${i}`,
      label: i < 10,
    })),
  );
  writeFileSync(join(dir, 'datasets', 'portugues.json'), JSON.stringify({ items }));
  return dir;
}
function engine() {
  const store = new Store(':memory:');
  stores.push(store);
  return new Engine(store);
}
// Answers an item with a chosen probability for the reference answer.
function answer(item: BravaItem, p: Provider, expectedProbability: number): ProviderResult {
  const q = item.question;
  const keys =
    q.type === 'predicate'
      ? ['true', 'false']
      : (q.options?.map((o) => o.value) ?? q.levels!.map((_, i) => String(i)));
  const expected = String(q.expected);
  const probabilities = keys.map((k) => ({
    value: k,
    label: k,
    probability:
      k === expected ? expectedProbability : (1 - expectedProbability) / (keys.length - 1),
  }));
  const top = probabilities.reduce((a, b) => (b.probability > a.probability ? b : a)).value;
  const value =
    q.type === 'predicate'
      ? probabilities.find((x) => x.value === 'true')!.probability
      : q.type === 'score'
        ? Number(top)
        : top;
  const a = { type: q.type, value, probabilities, confidence: 0.9 };
  return {
    ...demoAnswer(p, item),
    answer: a,
    grade: gradeAnswer(q, a),
    costUsd: 0.00001,
    durationMs: 300,
    inputTokens: 300,
  };
}

describe('rodada brava catalog', () => {
  it('builds five batteries with grouped robustness and negation items and a stable hash', () => {
    const catalog = buildCatalog(withDatasets());
    const count = (id: string) => catalog.items.filter((i) => i.battery === id).length;
    expect(catalog.batteries.map((b) => b.id)).toEqual([
      'robustez',
      'portugues',
      'abstencao',
      'negacao',
      'injecao',
    ]);
    expect([
      count('robustez'),
      count('portugues'),
      count('abstencao'),
      count('negacao'),
      count('injecao'),
    ]).toEqual([144, 60, 30, 48, 16]);
    expect(new Set(catalog.items.map((i) => i.id)).size).toBe(catalog.items.length);
    expect(catalog.items.filter((i) => i.sensitive)).toHaveLength(20);
    expect(buildCatalog(withDatasets()).hash).toBe(catalog.hash);
    for (const item of catalog.items) {
      const q = item.question;
      if (q.type === 'choice') expect(q.options!.some((o) => o.value === q.expected)).toBe(true);
    }
  });
  it('skips the Portuguese battery without the downloaded sample, and says how to get it', () => {
    const catalog = buildCatalog(emptyDir());
    expect(catalog.batteries.map((b) => b.id)).not.toContain('portugues');
    expect(catalog.skipped[0].reason).toContain('npm run datasets');
  });
  it('perturbs form only: typos keep negations, noise lives only in the request, order is reversed', () => {
    const text =
      'Nenhum estagiário pode acessar o servidor de produção sem a presença de um supervisor, exceto CAPTURADAS.';
    const changed = typos(text);
    expect(changed).not.toBe(text);
    expect(changed).toContain('Nenhum');
    expect(changed).toContain('exceto');
    expect(changed).toContain('CAPTURADAS');
    expect(changed.split(' ')).toHaveLength(text.split(' ').length);
    const items = buildCatalog(emptyDir()).items;
    const noisy = items.find((i) => i.noise)!;
    expect(noisy.facts).not.toContain('Anotações sem relação');
    expect(asRequest(noisy).round.facts).toContain('Anotações sem relação');
    const original = items.find((i) => i.id === 'rob-l1-original')!;
    const reversed = items.find((i) => i.id === 'rob-l1-ordem')!;
    expect(reversed.question.options).toEqual([...original.question.options!].reverse());
    for (const item of items.filter((i) => i.variant !== 'direcao')) {
      const body = JSON.stringify(
        requestFor('jev', asRequest(item).scenario, asRequest(item).round),
      );
      // A rationale that quotes the stated policy is not a leak; any other must stay out.
      if (!item.context.includes(item.question.rationale))
        expect(body).not.toContain(item.question.rationale);
      expect(body).not.toContain('"expected"');
    }
  });
});

describe('rodada brava report', () => {
  const catalog = buildCatalog(emptyDir());
  const source = (fill: (item: BravaItem, p: Provider) => number | null) => {
    const results: Brava['results'] = {};
    for (const item of catalog.items)
      for (const p of providers) {
        const v = fill(item, p);
        if (v !== null) (results[item.id] ??= {})[p] = answer(item, p, v);
      }
    return { mode: 'live' as const, batteries: catalog.batteries, items: catalog.items, results };
  };
  it('scores groups whole, applies the direction rule and counts guesses where it should abstain', () => {
    const report = buildBravaReport(
      source((item, p) => {
        if (p === 'jev' && item.id === 'rob-l2-ruido') return 0.1; // one robustness flip
        if (p === 'jev' && item.id === 'rob-l3-direcao') return 0.9; // correct, but lower than…
        if (p === 'jev' && item.id === 'rob-l3-original') return 0.99; // …the original: fails
        if (p === 'decisions' && item.id === 'neg-voo-escopo') return 0.1; // breaks one group
        if (p === 'clef' && item.id === 'abs-fila-3') return 0.1; // guesses a queue
        return 0.97;
      }),
      providers,
    );
    const robustness = report.batteries.find((b) => b.id === 'robustez')!;
    expect(robustness.units).toBe(36);
    expect(robustness.scores.jev).toBeCloseTo(34 / 36);
    expect(robustness.scores.clef).toBe(1);
    const negation = report.batteries.find((b) => b.id === 'negacao')!;
    expect(negation.scores.decisions).toBeCloseTo(11 / 12);
    const by = Object.fromEntries(report.standings.map((s) => [s.provider, s]));
    expect(by.clef.invented).toBe(1);
    expect(by.clef.abstentionItems).toBe(15);
    expect(by.jev.flipRate.ruido).toBeCloseTo(1 / 36);
    expect(by.jev.flipRate.ordem).toBe(0);
    expect(report.divergences.map((d) => d.itemId).sort()).toEqual(
      ['abs-fila-3', 'neg-voo-escopo', 'rob-l2-ruido'].sort(),
    );
  });
  it('counts changes of decision, not of decimals, and tells corrections from regressions', () => {
    const data = source((item, p) =>
      // Wrong on the original wording, fixed in every other version: corrections.
      p === 'decisions' && item.id === 'rob-l2-original' ? 0.1 : 0.97,
    );
    // Same level with different decimals, as in the real run: not a change of answer.
    data.results['rob-l3-original'].clef!.answer!.value = 1.98;
    data.results['rob-l3-ruido'].clef!.answer!.value = 1.97;
    const report = buildBravaReport(data, providers);
    const by = Object.fromEntries(report.standings.map((s) => [s.provider, s]));
    expect(by.clef.flips.ruido).toMatchObject({ changed: 0, compared: 36 });
    expect(by.decisions.flips.direcao).toMatchObject({ changed: 1, toward: 1, away: 0 });
    expect(by.decisions.flips.ruido).toMatchObject({ changed: 1, toward: 1, away: 0 });
  });
  it('keeps an annulled item on record but out of every score', () => {
    const base = source((item, p) => (p === 'clef' && item.id === 'inj-1' ? 0.1 : 0.97));
    const items = base.items.map((i) => (i.id === 'inj-1' ? { ...i, id: 'inj-10' } : i));
    const results = { ...base.results, 'inj-10': base.results['inj-1'] };
    const report = buildBravaReport({ ...base, items, results }, providers);
    expect(report.annulled).toEqual([expect.objectContaining({ itemId: 'inj-10' })]);
    expect(report.items).toBe(catalog.items.length - 1);
    expect(report.batteries.find((b) => b.id === 'injecao')!.scores.clef).toBe(1);
    expect(report.divergences.map((d) => d.itemId)).not.toContain('inj-10');
  });
  it('declares a winner by mean battery score, breaks near ties by calibration and reports the margin', () => {
    const clear = buildBravaReport(
      source((item, p) => (p === 'decisions' && item.battery === 'injecao' ? 0.1 : 0.97)),
      providers,
    );
    expect(clear.winner).toBe('tie');
    const tied = buildBravaReport(
      source((item, p) => {
        if (p === 'decisions' && item.battery === 'injecao') return 0.1;
        return p === 'clef' ? 0.99 : 0.9;
      }),
      providers,
    );
    expect(tied.winner).toBe('clef');
    expect(tied.reason).toBe('calibration');
    expect(tied.margins.find((m) => m.vs === 'jev')).toMatchObject({
      low: 0,
      high: 0,
      within: true,
    });
    const decisive = tied.margins.find((m) => m.vs === 'decisions')!;
    expect(decisive.within).toBe(false);
    expect(decisive.low).toBeGreaterThan(0);
  });
  it('withholds a winner when missing answers could change it', () => {
    const report = buildBravaReport(
      source((item, p) =>
        p === 'jev' && item.battery === 'injecao'
          ? null
          : p === 'decisions' && item.battery === 'negacao'
            ? 0.1
            : 0.97,
      ),
      providers,
    );
    expect(report.winner).toBe('inconclusive');
    expect(report.reason).toBe('unavailable');
  });
});

describe('rodada brava execution', () => {
  it('runs every battery by itself in the rehearsal and ends with a report, without AI calls', async () => {
    Object.assign(config, { AUTOPLAY_DELAY_MS: 0, DATA_DIR: withDatasets() });
    const calls = vi.spyOn(cli, 'callClaude');
    const apis = vi.spyOn(provider, 'evaluate');
    const e = engine();
    const started = await e.brava.start('demo');
    await vi.waitFor(() => expect(e.store.getBrava(started.id)?.phase).toBe('complete'), {
      timeout: 10000,
    });
    const brava = e.store.getBrava(started.id)!;
    expect(Object.keys(brava.results)).toHaveLength(298);
    expect(Object.keys(brava.comments)).toHaveLength(5);
    expect(brava.report?.batteries).toHaveLength(5);
    expect(brava.report?.highlights).toEqual([]);
    expect(calls).not.toHaveBeenCalled();
    expect(apis).not.toHaveBeenCalled();
    await expect(e.create('loja', 'demo')).resolves.toBeDefined();
    const app = await buildApp(e);
    const shown = (await app.inject({ url: `/api/bravas/${brava.id}` })).json();
    expect(JSON.stringify(shown)).not.toContain('"request"');
    expect(shown.results['rob-l1-original'].jev.status).toBeDefined();
    expect((await app.inject({ url: '/api/bravas' })).json()[0]).toMatchObject({
      id: brava.id,
      items: 298,
    });
    await app.close();
    e.close();
  });
  it('asks Opus once to open, once per battery and once at the end, all blind', async () => {
    Object.assign(config, {
      AUTOPLAY_DELAY_MS: 0,
      DATA_DIR: withDatasets(),
      OPENAI_API_KEY: 'x',
      TYPESAFE_API_KEY: 'x',
      CLOUDFLARE_ACCOUNT_ID: 'x',
      CLOUDFLARE_API_TOKEN: 'x',
    });
    vi.spyOn(cli, 'cliStatus').mockResolvedValue({ available: true, authenticated: true });
    const apis = vi
      .spyOn(provider, 'evaluate')
      .mockImplementation(async (p, _s, round) =>
        answer({ ...round, battery: 'injecao', context: '' } as BravaItem, p, 0.95),
      );
    const calls = vi.spyOn(cli, 'callClaude').mockImplementation(async (role, prompt) => {
      const value =
        role === 'moderator'
          ? { introduction: 'Abertura' }
          : role === 'commentator'
            ? { text: 'Comentário' }
            : {
                headline: '[[A]], [[B]] e [[C]] empataram',
                summary: 'Leitura',
                evidence: [{ roundId: 'inj-1', participant: 'both', observation: 'Evidência' }],
                limitations: ['Itens escritos pelo autor'],
              };
      return {
        value,
        call: {
          role,
          prompt,
          durationMs: 1,
          model: 'f',
          estimatedUsd: null,
          inputTokens: 1,
          outputTokens: 1,
          output: value,
        },
      } as any;
    });
    const e = engine();
    const started = await e.brava.start('live');
    await vi.waitFor(() => expect(e.store.getBrava(started.id)?.phase).toBe('complete'), {
      timeout: 10000,
    });
    const brava = e.store.getBrava(started.id)!;
    expect(apis).toHaveBeenCalledTimes(298 * 3);
    expect(calls).toHaveBeenCalledTimes(7);
    expect(brava.analysis?.headline).toContain('[[A]]');
    for (const [role, prompt] of calls.mock.calls.slice(1)) {
      expect(role).not.toBe('moderator');
      for (const brand of ['Jev', 'Decisions', 'Clef', 'costUsd', 'durationMs'])
        expect(prompt).not.toContain(brand);
    }
    e.close();
  });
  it('stops on cancel and keeps the answers received so far', async () => {
    Object.assign(config, { AUTOPLAY_DELAY_MS: 60000, DATA_DIR: emptyDir() });
    const e = engine();
    const started = await e.brava.start('demo');
    e.brava.cancel(started.id);
    expect(e.store.getBrava(started.id)?.phase).toBe('cancelled');
    await expect(e.brava.start('demo')).resolves.toBeDefined();
    e.close();
  });
});
