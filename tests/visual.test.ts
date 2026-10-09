import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Provider, ProviderResult } from '../shared/types';
import { buildVisualCatalog, translate, visualItems } from '../server/visual/catalog';
import { asRequest } from '../server/brava/catalog';
import { evaluate, requestFor } from '../server/providers';
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
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
const photo = `data:image/jpeg;base64,${jpeg.toString('base64')}`;
function withPhotos() {
  const dir = mkdtempSync(join(tmpdir(), 'imagens-'));
  mkdirSync(join(dir, 'datasets', 'imagens'), { recursive: true });
  for (const item of visualItems())
    writeFileSync(join(dir, 'datasets', 'imagens', `${item.image!.file}.jpg`), jpeg);
  return dir;
}
function engine() {
  const store = new Store(':memory:');
  stores.push(store);
  return new Engine(store);
}
const liveKeys = {
  AUTOPLAY_DELAY_MS: 0,
  OPENAI_API_KEY: 'x',
  TYPESAFE_API_KEY: '',
  CLOUDFLARE_ACCOUNT_ID: 'x',
  CLOUDFLARE_API_TOKEN: 'x',
};

describe('rodada das imagens catalog', () => {
  it('turns the CV-Bench sample into four Portuguese batteries keyed by the dataset letters', () => {
    const catalog = buildVisualCatalog(mkdtempSync(join(tmpdir(), 'vazio-')));
    expect(catalog.items).toHaveLength(80);
    expect(catalog.batteries.map((b) => [b.id, b.itemIds.length])).toEqual([
      ['contagem', 20],
      ['relacao', 20],
      ['profundidade', 20],
      ['distancia', 20],
    ]);
    expect(new Set(catalog.items.map((i) => i.id)).size).toBe(80);
    expect(catalog.missing).toBe(80);
    expect(buildVisualCatalog(withPhotos())).toMatchObject({ missing: 0, hash: catalog.hash });
    for (const item of catalog.items) {
      const q = item.question;
      expect(q.type).toBe('choice');
      expect(q.options!.map((o) => o.value)).toContain(q.expected);
      expect(`${q.text} ${q.options!.map((o) => o.description).join(' ')}`).not.toMatch(
        /\b(the|highlighted|annotated|left|right|above|below)\b/,
      );
    }
  });
  it('keeps colored boxes, articles and the choice order of each template', () => {
    const base = { idx: 1, source: 'Omni3D', sourceDataset: 'x', answer: '(A)' };
    expect(
      translate({
        ...base,
        task: 'Depth',
        question:
          'Which object is closer to the camera taking this photo, the books (highlighted by a red box) or the table (highlighted by a blue box)?',
        choices: ['books', 'table'],
      }),
    ).toMatchObject({
      text: 'Qual objeto está mais perto da câmera que tirou a foto: os livros (caixa vermelha) ou a mesa (caixa azul)?',
      options: [
        { value: 'A', label: 'Os livros (caixa vermelha)' },
        { value: 'B', label: 'A mesa (caixa azul)' },
      ],
    });
    expect(
      translate({
        ...base,
        task: 'Relation',
        question:
          'Considering the relative positions of the person (annotated by the red box) and the truck in the image provided, where is the person (annotated by the red box) located with respect to the truck?',
        choices: ['left', 'right'],
      }).text,
    ).toBe('Na imagem, onde está a pessoa (caixa vermelha) em relação ao caminhão?');
    expect(() =>
      translate({
        ...base,
        task: 'Count',
        question: 'How many unicorns are in the image?',
        choices: ['1'],
      }),
    ).toThrow('unicorns');
  });
});

describe('rodada das imagens requests', () => {
  const item = visualItems()[0];
  const { scenario, round } = asRequest(item);
  it('sends the photo as a data URL in each API format, and Jev never gets one', () => {
    expect(requestFor('decisions', scenario, round, undefined, [photo])).toMatchObject({
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: expect.stringContaining('Foto real') },
            { type: 'input_image', image_url: photo },
          ],
        },
      ],
    });
    expect(requestFor('clef', scenario, round, undefined, [photo])).toMatchObject({
      images: [photo],
      state: expect.stringContaining('Foto real'),
    });
    expect(requestFor('clef', scenario, round)).not.toHaveProperty('images');
    expect(() => requestFor('jev', scenario, round, undefined, [photo])).toThrow('imagens');
  });
  it('records a fingerprint of the photo, not its bytes', async () => {
    const big = `data:image/jpeg;base64,${Buffer.alloc(30_000, 7).toString('base64')}`;
    let body = '';
    const fetcher = (async (_url: string, init: RequestInit) => {
      body = String(init.body);
      return new Response(
        JSON.stringify({
          success: true,
          errors: [],
          result: {
            model: 'clef',
            usage: { input_tokens: 900, output_tokens: 0 },
            answers: {
              [item.id]: {
                type: 'choice',
                choice: String(item.question.expected),
                confidence: 0.9,
                probabilities: Object.fromEntries(
                  item.question.options!.map((o) => [
                    o.value,
                    o.value === item.question.expected
                      ? 0.94
                      : 0.06 / (item.question.options!.length - 1),
                  ]),
                ),
              },
            },
          },
        }),
      );
    }) as typeof fetch;
    const result = await evaluate('clef', scenario, round, new AbortController().signal, fetcher, [
      big,
    ]);
    expect(result.grade.status).toBe('correct');
    expect(body).toContain(big);
    const saved = JSON.stringify(result.request);
    expect(saved).not.toContain(big.slice(30, 200));
    expect(saved).toMatch(/imagem omitida do registro: 29 KB, sha256 [0-9a-f]{16}/);
  });
});

function correct(p: Provider, round: { id: string; question: any }): ProviderResult {
  const q = round.question;
  const answer = {
    type: 'choice' as const,
    value: String(q.expected),
    confidence: 0.9,
    probabilities: q.options.map((o: { value: string; label: string }) => ({
      value: o.value,
      label: o.label,
      probability: o.value === q.expected ? 0.9 : 0.1 / (q.options.length - 1),
    })),
  };
  return {
    provider: p,
    answer,
    grade: gradeAnswer(q, answer),
    durationMs: 100,
    model: 'f',
    inputTokens: 900,
    costUsd: 0.0001,
    request: {},
  };
}

describe('rodada das imagens execution', () => {
  it('runs the rehearsal with Decisions and Clef only, without photos or AI calls', async () => {
    Object.assign(config, { AUTOPLAY_DELAY_MS: 0, DATA_DIR: mkdtempSync(join(tmpdir(), 'v-')) });
    const calls = vi.spyOn(cli, 'callClaude');
    const apis = vi.spyOn(provider, 'evaluate');
    const e = engine();
    const started = await e.brava.start('demo', 'visual');
    await vi.waitFor(() => expect(e.store.getBrava(started.id)?.phase).toBe('complete'), {
      timeout: 10000,
    });
    const brava = e.store.getBrava(started.id)!;
    expect(brava).toMatchObject({ kind: 'visual', providers: ['decisions', 'clef'] });
    expect(Object.keys(brava.results)).toHaveLength(80);
    expect(brava.report?.standings.map((s) => s.provider)).toEqual(['decisions', 'clef']);
    expect(brava.report?.round1).toBeUndefined();
    expect(calls).not.toHaveBeenCalled();
    expect(apis).not.toHaveBeenCalled();
    const app = await buildApp(e);
    expect((await app.inject({ url: '/api/bravas' })).json()[0]).toMatchObject({
      kind: 'visual',
      items: 80,
    });
    expect(
      (await app.inject({ url: `/api/bravas/${brava.id}/export` })).headers['content-disposition'],
    ).toContain('rodada-imagens-');
    expect((await app.inject({ url: '/api/images/cvbench-21' })).statusCode).toBe(404);
    await app.close();
    e.close();
  });
  it('refuses a live run until the photos are downloaded', async () => {
    Object.assign(config, { ...liveKeys, DATA_DIR: mkdtempSync(join(tmpdir(), 'v-')) });
    vi.spyOn(cli, 'cliStatus').mockResolvedValue({ available: true, authenticated: true });
    await expect(engine().brava.start('live', 'visual')).rejects.toThrow('npm run imagens');
  });
  it('sends each photo, needs no TypeSafe key and keeps Opus blind to brands and photos', async () => {
    Object.assign(config, { ...liveKeys, DATA_DIR: withPhotos() });
    vi.spyOn(cli, 'cliStatus').mockResolvedValue({ available: true, authenticated: true });
    const apis = vi
      .spyOn(provider, 'evaluate')
      .mockImplementation(async (p, _s, round) => correct(p, round));
    const calls = vi.spyOn(cli, 'callClaude').mockImplementation(async (role, prompt) => {
      const value =
        role === 'moderator'
          ? { introduction: 'Abertura' }
          : role === 'commentator'
            ? { text: 'Comentário' }
            : {
                headline: '[[A]] e [[B]] empataram',
                summary: 'Leitura',
                evidence: [],
                limitations: ['Amostra pequena'],
              };
      return { value, call: { role, prompt, output: value } } as any;
    });
    const e = engine();
    const started = await e.brava.start('live', 'visual');
    await vi.waitFor(() => expect(e.store.getBrava(started.id)?.phase).toBe('complete'), {
      timeout: 10000,
    });
    expect(apis).toHaveBeenCalledTimes(160);
    expect(
      apis.mock.calls.every(([p, , , , , images]) => p !== 'jev' && images?.[0] === photo),
    ).toBe(true);
    expect(calls).toHaveBeenCalledTimes(6);
    for (const [role, prompt] of calls.mock.calls) {
      if (role !== 'moderator') expect(prompt).toContain('não vê as fotos');
      for (const brand of ['Jev', 'Decisions', 'Clef', 'costUsd', 'durationMs', 'base64'])
        expect(prompt).not.toContain(brand);
    }
    expect(e.store.getBrava(started.id)?.report?.winner).toBe('tie');
    const app = await buildApp(e);
    const image = await app.inject({ url: '/api/images/cvbench-21' });
    expect(image.headers['content-type']).toBe('image/jpeg');
    expect(image.rawPayload).toEqual(jpeg);
    expect((await app.inject({ url: '/api/images/..%2F..%2F.env' })).statusCode).toBe(400);
    await app.close();
    e.close();
  });
});
