import { afterEach, describe, it, expect, vi } from 'vitest';
import { Store } from '../server/store';
import { Engine } from '../server/engine';
import { buildApp } from '../server/app';
import { blindData } from '../server/judging';
import { metrics } from '../shared/scoring';
import type { Run } from '../shared/types';
import { providers } from '../shared/types';
import * as cli from '../server/claude';
import * as provider from '../server/providers';
import { config } from '../server/config';
import { demoResult } from '../server/demo';
import { scenarios } from '../server/scenarios';
const stores: Store[] = [];
const originalConfig = { ...config };
function create() {
  const store = new Store(':memory:');
  stores.push(store);
  return { store, engine: new Engine(store) };
}
afterEach(() => {
  stores.forEach((s) => s.close());
  stores.length = 0;
  vi.restoreAllMocks();
  Object.assign(config, originalConfig);
});
async function finishDemo(engine: Engine, scenarioId = 'loja') {
  const run = await engine.create(scenarioId, 'demo');
  for (let i = 0; i < 6; i++) {
    await vi.waitFor(() => expect(engine.store.get(run.id)?.phase).toBe('ready'));
    engine.advance(run.id);
  }
  await vi.waitFor(() => expect(engine.store.get(run.id)?.phase).toBe('complete'));
  return engine.store.get(run.id)!;
}
describe('meeting lifecycle and evidence', () => {
  it.each(['lancamento-avancado', 'conversas-avancadas', 'dossie-estresse'])(
    'completes all advanced rounds offline and uses only each question’s own rubric: %s',
    async (scenarioId) => {
      const calls = vi.spyOn(cli, 'callClaude');
      const decisions = vi.spyOn(provider, 'evaluate');
      const { engine } = create();
      const run = await finishDemo(engine, scenarioId);
      expect(run.rounds).toHaveLength(6);
      expect(run.providers).toEqual(providers);
      expect(run.rounds.every((r) => r.feedback && providers.every((p) => r.results[p]))).toBe(
        true,
      );
      expect(run.verdict).toMatchObject({ winner: 'tie', reason: 'tie', basis: 'objective' });
      expect(calls).not.toHaveBeenCalled();
      expect(decisions).not.toHaveBeenCalled();
      for (const r of run.rounds) {
        const data = blindData(run, { A: 'jev', B: 'decisions', C: 'clef' }, r.roundId);
        expect(data.rounds).toHaveLength(1);
        const item = data.rounds[0];
        expect(item.A!.points).toBe(r.results.jev?.grade.status === 'correct' ? 1 : 0);
        expect(item.C!.points).toBe(r.results.clef?.grade.status === 'correct' ? 1 : 0);
        expect(item.A!.answer).not.toHaveProperty('confidence');
        expect(item.C!.answer).not.toHaveProperty('probabilities');
        if (item.question.type === 'choice') {
          expect(item.scoringRule).not.toContain('0.8');
          expect(item.scoringRule).not.toContain('0.4');
        } else if (item.question.type === 'predicate') {
          expect(item.scoringRule).toContain('0.8');
          expect(item.scoringRule).not.toContain('0.4');
        } else {
          expect(item.scoringRule).toContain('0.4');
          expect(item.scoringRule).not.toContain('0.8');
        }
      }
    },
  );
  it('requires Cloudflare credentials before a real three-way run', async () => {
    config.OPENAI_API_KEY = 'test-placeholder';
    config.TYPESAFE_API_KEY = 'test-placeholder';
    config.CLOUDFLARE_ACCOUNT_ID = '';
    config.CLOUDFLARE_API_TOKEN = 'test-placeholder';
    vi.spyOn(cli, 'cliStatus').mockResolvedValue({ available: true, authenticated: true });
    const { engine, store } = create();
    const health = await engine.health();
    expect(health.keys).toEqual({ jev: true, decisions: true, clef: false });
    expect(health.ready).toBe(false);
    await expect(engine.create('loja', 'live')).rejects.toThrow('Cloudflare');
    expect(store.list()).toHaveLength(0);
  });
  it('blocks real runs before creating evidence or making calls when the CLI has no login', async () => {
    config.OPENAI_API_KEY = 'test-placeholder';
    config.TYPESAFE_API_KEY = 'test-placeholder';
    config.CLOUDFLARE_ACCOUNT_ID = 'test-placeholder';
    config.CLOUDFLARE_API_TOKEN = 'test-placeholder';
    vi.spyOn(cli, 'cliStatus').mockResolvedValue({
      available: true,
      authenticated: false,
      error: 'Claude CLI sem login.',
    });
    const calls = vi.spyOn(cli, 'callClaude');
    const decisions = vi.spyOn(provider, 'evaluate');
    const { engine, store } = create();
    expect((await engine.health()).ready).toBe(false);
    await expect(engine.create('loja', 'live')).rejects.toThrow('sem login');
    expect(store.list()).toHaveLength(0);
    expect(calls).not.toHaveBeenCalled();
    expect(decisions).not.toHaveBeenCalled();
  });
  it('coordinates the complete live path using isolated stand-ins: 18 decisions, 6 comments and one blind explanation', async () => {
    config.OPENAI_API_KEY = 'test-placeholder';
    config.TYPESAFE_API_KEY = 'test-placeholder';
    config.CLOUDFLARE_ACCOUNT_ID = 'test-placeholder';
    config.CLOUDFLARE_API_TOKEN = 'test-placeholder';
    vi.spyOn(cli, 'cliStatus').mockResolvedValue({
      available: true,
      authenticated: true,
      version: 'fixture',
    });
    const calls = vi.spyOn(cli, 'callClaude').mockImplementation(async (role, prompt) => {
      const value =
        role === 'moderator'
          ? {
              introduction: 'Abertura de teste',
              rounds: scenarios[0].rounds.map((r) => ({
                id: r.id,
                transition: 'Transição de teste',
              })),
            }
          : role === 'commentator'
            ? { text: 'Comentário de teste' }
            : {
                summary: 'Explicação de teste',
                evidence: [
                  { roundId: 'l2', participant: 'both', observation: 'Evidência de teste' },
                ],
                limitations: ['Fixtures, sem IA real'],
              };
      return {
        value,
        call: {
          role,
          prompt,
          durationMs: 1,
          model: 'fixture-opus',
          estimatedUsd: null,
          inputTokens: 10,
          outputTokens: 10,
          output: value,
        },
      } as any;
    });
    const decisions = vi
      .spyOn(provider, 'evaluate')
      .mockImplementation(async (p, s, r) =>
        demoResult(p, { scenario: s } as Run, r, s.rounds.indexOf(r)),
      );
    const { engine } = create();
    const run = await engine.create('loja', 'live');
    for (let i = 0; i < 6; i++) {
      await vi.waitFor(() => expect(engine.store.get(run.id)?.phase).toBe('ready'));
      engine.advance(run.id);
    }
    await vi.waitFor(() => expect(engine.store.get(run.id)?.phase).toBe('complete'));
    const saved = engine.store.get(run.id)!;
    expect(decisions).toHaveBeenCalledTimes(18);
    expect(calls).toHaveBeenCalledTimes(8);
    expect(saved.rounds.filter((r) => r.feedback)).toHaveLength(6);
    expect(saved.cliCalls).toHaveLength(8);
    // Round 2 is the only one Jev misses in the fixtures: the others share that round.
    expect(saved.rounds[1].feedback?.winner).toBe('tie');
    expect(saved.rounds[0].feedback?.winner).toBe('tie');
    const passes = saved.verdict!.passes;
    expect(passes).toHaveLength(1);
    // Equal points; Jev's miss is a 0.93 probability, the others' a 0.94 wrong choice.
    expect(saved.verdict).toMatchObject({ winner: 'jev', reason: 'calibration' });
    expect(passes[0].mapping[passes[0].result.winner as 'A']).toBe('jev');
    expect(saved.verdict!.summary).toBe('Explicação de teste');
    for (const [role, prompt] of calls.mock.calls)
      if (role === 'commentator' || role === 'judge') {
        expect(prompt).toContain('[[C]]');
        expect(prompt).toContain('não muda');
      }
    for (const [role, prompt] of calls.mock.calls)
      if (role !== 'moderator') {
        expect(prompt).not.toContain('fixture-sintetica');
        expect(prompt).not.toContain('durationMs');
        expect(prompt).not.toContain('request');
      }
  });
  it('completes six rounds offline, comments every round, stores snapshots and labels synthetic results', async () => {
    const call = vi.spyOn(cli, 'callClaude');
    const { engine, store } = create();
    const run = await finishDemo(engine);
    expect(call).not.toHaveBeenCalled();
    expect(run.rounds.every((r) => r.feedback)).toBe(true);
    expect(run.verdict).toMatchObject({ winner: 'jev', reason: 'calibration' });
    expect(run.verdict?.summary).toContain('Ensaio sintético');
    expect(metrics(run, 'jev').correct).toBe(5);
    expect(metrics(run, 'decisions').correct).toBe(5);
    expect(metrics(run, 'clef').correct).toBe(5);
    expect(store.events(run.id).length).toBeGreaterThan(25);
    expect(run.scenarioHash).toHaveLength(64);
  });
  it('prevents overlapping rounds and duplicate active meetings', async () => {
    const { engine } = create();
    const run = await engine.create('loja', 'demo');
    await expect(engine.create('produto', 'demo')).rejects.toThrow('ativa');
    engine.advance(run.id);
    expect(() => engine.advance(run.id)).toThrow('Aguarde');
    await vi.waitFor(() => expect(engine.store.get(run.id)?.phase).toBe('ready'));
    engine.cancel(run.id);
    expect(() => engine.advance(run.id)).toThrow();
    expect(engine.store.get(run.id)?.rounds).toHaveLength(1);
  });
  it('cancelled state cannot be overwritten by late completions', async () => {
    const { engine } = create();
    const run = await engine.create('loja', 'demo');
    engine.advance(run.id);
    engine.cancel(run.id);
    await new Promise((r) => setTimeout(r, 20));
    expect(engine.store.get(run.id)?.phase).toBe('cancelled');
  });
  it('keeps unreported cost unknown when cancellation interrupts an API call', async () => {
    const { engine } = create();
    const run = await engine.create('loja', 'demo');
    engine.advance(run.id);
    engine.cancel(run.id);
    const saved = engine.store.get(run.id)!;
    delete saved.rounds[0].results.jev;
    expect(metrics(saved, 'jev').unknownCosts).toBe(1);
    expect(metrics(saved, 'jev').unavailable).toBe(1);
  });
  it('marks interrupted meetings as failed when reopening without losing their data', async () => {
    const { engine, store } = create();
    const run = await engine.create('loja', 'demo');
    engine.advance(run.id);
    await vi.waitFor(() => expect(store.get(run.id)?.phase).toBe('ready'));
    store.recover();
    expect(store.get(run.id)?.phase).toBe('failed');
    expect(store.get(run.id)?.rounds).toHaveLength(1);
    engine.close();
  });
  it('blinds the data Opus reads', async () => {
    const { engine } = create();
    const run = await finishDemo(engine);
    const data = JSON.stringify(blindData(run, { A: 'jev', B: 'decisions', C: 'clef' }));
    for (const forbidden of [
      'fixture-sintetica',
      'durationMs',
      'costUsd',
      'confidenceRouting',
      'request',
      'provider',
    ])
      expect(data).not.toContain(forbidden);
    delete run.providers;
    for (const round of run.rounds) delete round.results.clef;
    expect(JSON.stringify(blindData(run, { A: 'jev', B: 'decisions' }))).not.toContain('"C"');
  });
  it('validates local origin and preserves evidence on export', async () => {
    const { engine } = create();
    const app = await buildApp(engine);
    const blocked = await app.inject({
      method: 'POST',
      url: '/api/runs',
      headers: { origin: 'https://attacker.example' },
      payload: { mode: 'demo', scenarioId: 'loja' },
    });
    expect(blocked.statusCode).toBe(403);
    const dns = await app.inject({ url: '/api/scenarios', headers: { host: 'attacker.example' } });
    expect(dns.statusCode).toBe(403);
    const invalid = await app.inject({
      method: 'POST',
      url: '/api/runs',
      payload: { mode: 'unknown', scenarioId: 'loja' },
    });
    expect(invalid.statusCode).toBe(400);
    const run = await finishDemo(engine);
    const exported = await app.inject({ url: `/api/runs/${run.id}/export` });
    expect(exported.statusCode).toBe(200);
    expect(exported.json().run.scenarioHash).toBe(run.scenarioHash);
    expect(exported.json().events.length).toBeGreaterThan(0);
    const count = engine.store.events(run.id).length;
    await app.inject({ url: `/api/runs/${run.id}` });
    expect(engine.store.events(run.id)).toHaveLength(count);
    await app.close();
  });
  it('deletes selected history and events, clears all terminal runs, and preserves a running meeting', async () => {
    const { engine, store } = create();
    const complete = await finishDemo(engine);
    const cancelled = await engine.create('loja', 'demo');
    engine.cancel(cancelled.id);
    const failed = structuredClone(complete);
    failed.id = '11111111-1111-4111-8111-111111111111';
    failed.phase = 'failed';
    store.save(failed);
    const active = await engine.create('produto', 'demo');
    const app = await buildApp(engine);
    const activeEvents = store.events(active.id).length;
    const blocked = await app.inject({
      method: 'DELETE',
      url: `/api/runs/${complete.id}`,
      headers: { origin: 'https://attacker.example' },
    });
    expect(blocked.statusCode).toBe(403);
    expect((await app.inject({ method: 'DELETE', url: `/api/runs/${active.id}` })).statusCode).toBe(
      400,
    );
    expect(
      (await app.inject({ method: 'DELETE', url: `/api/runs/${complete.id}` })).json(),
    ).toEqual({ removed: 1 });
    expect(store.get(complete.id)).toBeUndefined();
    expect(store.events(complete.id)).toHaveLength(0);
    expect((await app.inject({ url: `/api/runs/${complete.id}/export` })).statusCode).toBe(404);
    expect(
      (await app.inject({ method: 'DELETE', url: `/api/runs/${complete.id}` })).statusCode,
    ).toBe(404);
    // Clearing must also remove entries older than the 100 rows displayed by list().
    for (let i = 0; i < 101; i++) store.save({ ...failed, id: `old-${i}` });
    expect((await app.inject({ method: 'DELETE', url: '/api/runs' })).json()).toEqual({
      removed: 103,
    });
    expect(store.list().map((r) => r.id)).toEqual([active.id]);
    expect(store.events(cancelled.id)).toHaveLength(0);
    expect(store.events(failed.id)).toHaveLength(0);
    expect(store.events('old-100')).toHaveLength(0);
    expect(store.events(active.id)).toHaveLength(activeEvents);
    expect((await app.inject({ method: 'DELETE', url: '/api/runs' })).json()).toEqual({
      removed: 0,
    });
    engine.advance(active.id);
    await vi.waitFor(() => expect(store.get(active.id)?.phase).toBe('ready'));
    engine.cancel(active.id);
    await app.close();
  });
});
