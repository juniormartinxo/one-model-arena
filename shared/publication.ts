import { z } from 'zod';

const provider = z.enum(['jev', 'decisions', 'clef']);
const finite = z.number().finite();
const count = finite.int().nonnegative();
const fraction = finite.min(0).max(1);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const standing = z
  .object({
    provider,
    models: z.array(z.string().min(1).max(160)).min(1),
    score: fraction,
    correct: count,
    incorrect: count,
    uncertain: count,
    unavailable: count,
    total: count.positive(),
    brier: finite.min(0).max(2).nullable(),
    ece: fraction.nullable(),
    medianMs: finite.nonnegative().nullable(),
    costUsd: finite.nonnegative(),
    unknownCosts: count,
    costPerMillion: finite.nonnegative().nullable(),
  })
  .strict();
export const publicResultSchema = z
  .object({
    kind: z.enum(['maratona', 'brava', 'imagens']),
    sourceId: z.uuid(),
    executedAt: z.iso.datetime(),
    catalogHashes: z.array(hash).min(1),
    winner: z.union([provider, z.enum(['tie', 'inconclusive'])]),
    reason: z.enum(['points', 'calibration', 'tie', 'unavailable']),
    standings: z.array(standing).min(2).max(3),
    batteries: z
      .array(
        z
          .object({
            id: z.string(),
            title: z.string(),
            unit: z.enum(['item', 'grupo']),
            units: count.positive(),
            scores: z
              .array(z.object({ provider, score: fraction }).strict())
              .min(2)
              .max(3),
          })
          .strict(),
      )
      .min(1),
    margins: z.array(
      z.object({ vs: provider, low: finite, high: finite, within: z.boolean() }).strict(),
    ),
    annulled: z.array(
      z.object({ itemId: z.string(), title: z.string(), reason: z.string() }).strict(),
    ),
    sampleReferences: z.array(z.object({ dataset: z.string(), id: z.string() }).strict()),
    excludedBatteries: z.array(z.string()),
  })
  .strict();
export const publicationSchema = z.discriminatedUnion('status', [
  z
    .object({ schemaVersion: z.literal(1), status: z.literal('pending'), edition: z.null() })
    .strict(),
  z
    .object({
      schemaVersion: z.literal(1),
      status: z.literal('published'),
      edition: z
        .object({
          id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
          title: z.string().min(1).max(120),
          preparedAt: z.iso.datetime(),
          codeRevision: z.string().regex(/^[a-f0-9]{40}(?:-dirty)?$/),
          rulesHash: hash,
          results: z
            .array(publicResultSchema)
            .min(1)
            .max(3)
            .refine(
              (results) => new Set(results.map((r) => r.kind)).size === results.length,
              'Uma execução por tipo de teste em cada edição.',
            ),
        })
        .strict(),
    })
    .strict(),
]);
export type PublicResult = z.infer<typeof publicResultSchema>;
export type Publication = z.infer<typeof publicationSchema>;
