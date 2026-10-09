import { describe, expect, it } from 'vitest';
import { createPublication, publicBrava, publicSeries } from '../scripts/public-edition';
import { publicationSchema } from '../shared/publication';
import type { Brava, BravaItem, Provider, Run, Series } from '../shared/types';
import { gradeAnswer } from '../shared/scoring';

const id = '11111111-1111-4111-8111-111111111111';
const date = '2026-10-09T10:00:00.000Z';
function fixture(): Brava {
  const providers: Provider[] = ['decisions', 'clef'];
  const items: BravaItem[] = [0, 1].map((i) => ({
    id: `item-${i}`,
    battery: 'abstencao',
    title: `Pergunta ${i}`,
    context: 'PRIVATE_CONTEXT',
    facts: 'PRIVATE_DATASET_TEXT',
    source: { dataset: 'Dataset de teste', id: String(i), license: 'PRIVATE_LICENSE_TEXT' },
    question: {
      id: `q-${i}`,
      type: 'choice',
      text: 'PRIVATE_QUESTION',
      expected: 'yes',
      rationale: 'PRIVATE_RATIONALE',
      success: '',
      failure: '',
      options: [
        { value: 'yes', label: 'Sim', description: '' },
        { value: 'no', label: 'Não', description: '' },
      ],
    },
  }));
  return {
    id,
    kind: 'brava',
    mode: 'live',
    phase: 'complete',
    createdAt: date,
    updatedAt: date,
    providers,
    catalogHash: 'a'.repeat(64),
    currentBattery: 0,
    batteries: [
      {
        id: 'abstencao',
        title: 'Abstenção',
        description: 'PRIVATE_BATTERY_DESCRIPTION',
        unit: 'item',
        itemIds: items.map((i) => i.id),
      },
    ],
    items,
    results: Object.fromEntries(
      items.map((item) => [
        item.id,
        Object.fromEntries(
          providers.map((provider) => {
            const answer = {
              type: 'choice' as const,
              value: 'yes',
              confidence: 0.8,
              probabilities: [
                { value: 'yes', label: 'Sim', probability: 0.8 },
                { value: 'no', label: 'Não', probability: 0.2 },
              ],
            };
            return [
              provider,
              {
                provider,
                model: 'fixture-model',
                answer,
                grade: gradeAnswer(item.question, answer),
                durationMs: 200,
                inputTokens: 10,
                costUsd: 0.0001,
                request: { token: 'PRIVATE_API_KEY' },
                raw: { text: 'PRIVATE_RAW_PAYLOAD' },
              },
            ];
          }),
        ),
      ]),
    ),
    introduction: 'PRIVATE_INTRO',
    comments: { abstencao: { text: 'PRIVATE_COMMENT' } },
    analysis: {
      mapping: { A: 'decisions', B: 'clef' },
      headline: 'PRIVATE_STALE_HEADLINE',
      summary: 'PRIVATE_STALE_SUMMARY',
      evidence: [],
      limitations: [],
    },
    cliCalls: [{ purpose: 'PRIVATE_CALL', prompt: 'PRIVATE_CLI_PROMPT' } as never],
    tariff: { date },
  };
}
const metadata = {
  id: 'edicao-teste',
  title: 'Edição de teste',
  preparedAt: date,
  codeRevision: 'c'.repeat(40),
  rulesHash: 'd'.repeat(64),
};
describe('public edition boundary', () => {
  it('only exports explicit aggregate fields and recomputes the report from saved results', () => {
    const brava = fixture();
    brava.report = { winner: 'jev', standings: [{ score: 0 }] } as never;
    const published = createPublication({ ...metadata, bravas: [brava] });
    expect(published.status).toBe('published');
    if (published.status !== 'published') throw new Error('missing edition');
    expect(published.edition.results[0].standings[0].score).toBe(1);
    expect(published.edition.results[0].winner).toBe('tie');
    expect(published.edition.results[0].sampleReferences).toEqual([
      { dataset: 'Dataset de teste', id: '0' },
      { dataset: 'Dataset de teste', id: '1' },
    ]);
    expect(JSON.stringify(published)).not.toContain('PRIVATE_');
    expect(JSON.stringify(published)).not.toMatch(
      /"(?:request|raw|cliCalls|facts|analysis|tariff)":/,
    );
  });
  it.each(['demo', 'running', 'cancelled'])('rejects an ineligible %s execution', (state) => {
    const b = fixture();
    if (state === 'demo') b.mode = 'demo';
    else b.phase = state as Brava['phase'];
    expect(() => publicBrava(b)).toThrow(/reais e concluídas/);
  });
  it('rejects unknown/private keys in the published artifact and duplicated kinds', () => {
    const valid = createPublication({ ...metadata, bravas: [fixture()] });
    expect(() => publicationSchema.parse({ ...valid, secrets: {} })).toThrow();
    if (valid.status !== 'published') throw new Error('missing edition');
    expect(() =>
      publicationSchema.parse({
        ...valid,
        edition: { ...valid.edition, results: [{ ...valid.edition.results[0], raw: 'private' }] },
      }),
    ).toThrow();
    expect(() => createPublication({ ...metadata, bravas: [fixture(), fixture()] })).toThrow();
  });
  it('requires an explicitly selected result and rejects empty catalogs', () => {
    expect(() => createPublication({ ...metadata, bravas: [] })).toThrow();
    const b = fixture();
    b.items = [];
    expect(() => publicBrava(b)).toThrow(/Catálogo incompleto/);
  });
  it('rejects incomplete/mismatched marathon meetings and synthetic meetings', () => {
    const series = { id, mode: 'live', phase: 'complete', runIds: [id] } as Series;
    expect(() => publicSeries(series, [])).toThrow(/incompletas/);
    expect(() => publicSeries(series, [{ id, mode: 'demo', phase: 'complete' } as Run])).toThrow(
      /reais/,
    );
  });
});
