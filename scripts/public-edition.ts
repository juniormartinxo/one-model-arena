import type { Brava, Provider, ProviderResult, Run, Series, Standing } from '../shared/types';
import { buildSeriesReport } from '../shared/report';
import { buildBravaReport } from '../shared/brava-report';
import { publicationSchema, type Publication, type PublicResult } from '../shared/publication';

function assertReal(record: { mode: string; phase: string }) {
  if (record.mode !== 'live' || record.phase !== 'complete')
    throw new Error('Somente execuções reais e concluídas podem ser publicadas.');
}
function row(
  s: Standing,
  answers: (ProviderResult | undefined)[],
  score: number,
  ece: number | null,
  costPerMillion: number | undefined,
): PublicResult['standings'][number] {
  return {
    provider: s.provider,
    models: [...new Set(answers.map((r) => r?.model).filter((m): m is string => !!m))],
    score,
    correct: s.correct,
    incorrect: s.incorrect,
    uncertain: s.uncertain,
    unavailable: s.unavailable,
    total: s.total,
    brier: s.brier,
    ece,
    medianMs: s.medianMs,
    costUsd: s.costUsd,
    unknownCosts: s.unknownCosts,
    costPerMillion: costPerMillion ?? null,
  };
}
export function publicSeries(series: Series, meetings: Run[]): PublicResult {
  assertReal(series);
  if (
    !series.runIds.length ||
    series.runIds.length !== meetings.length ||
    series.runIds.some((id, i) => meetings[i]?.id !== id)
  )
    throw new Error('Reuniões incompletas ou fora da edição selecionada.');
  for (const run of meetings) {
    assertReal(run);
    if (
      run.rounds.length !== run.scenario.rounds.length ||
      new Set(run.rounds.map((r) => r.roundId)).size !== run.scenario.rounds.length ||
      run.scenario.rounds.some((q) => !run.rounds.some((r) => r.roundId === q.id))
    )
      throw new Error('Uma reunião contém rodadas incompletas.');
  }
  const report = buildSeriesReport(meetings, series.providers);
  return {
    kind: 'maratona',
    sourceId: series.id,
    executedAt: series.createdAt,
    catalogHashes: meetings.map((r) => r.scenarioHash),
    winner: report.winner,
    reason: report.reason,
    standings: report.standings.map((s) =>
      row(
        s,
        meetings.flatMap((r) => r.rounds.map((round) => round.results[s.provider])),
        s.correct / s.total,
        null,
        report.costPerMillion[s.provider],
      ),
    ),
    batteries: report.batteries.map((b) => ({
      id: b.id,
      title: b.label,
      unit: 'item',
      units: b.total,
      scores: series.providers.map((provider) => ({
        provider,
        score: b.correct[provider] / b.total,
      })),
    })),
    margins: [],
    annulled: [],
    sampleReferences: [],
    excludedBatteries: [],
  };
}
export function publicBrava(brava: Brava): PublicResult {
  assertReal(brava);
  if (
    !brava.items.length ||
    brava.batteries.some(
      (b) => !b.itemIds.length || b.itemIds.some((id) => !brava.items.some((i) => i.id === id)),
    )
  )
    throw new Error('Catálogo incompleto.');
  const report = buildBravaReport(brava, brava.providers);
  return {
    kind: brava.kind === 'visual' ? 'imagens' : 'brava',
    sourceId: brava.id,
    executedAt: brava.createdAt,
    catalogHashes: [brava.catalogHash],
    winner: report.winner,
    reason: report.reason,
    standings: report.standings.map((s) =>
      row(
        s,
        brava.items.map((i) => brava.results[i.id]?.[s.provider]),
        s.score,
        s.ece,
        report.costPerMillion[s.provider],
      ),
    ),
    batteries: report.batteries.map((b) => ({
      id: b.id,
      title: b.title,
      unit: b.unit,
      units: b.units,
      scores: brava.providers.map((provider) => ({ provider, score: b.scores[provider] })),
    })),
    margins: report.margins.map((m) => ({ vs: m.vs, low: m.low, high: m.high, within: m.within })),
    annulled: report.annulled.map((a) => ({ itemId: a.itemId, title: a.title, reason: a.reason })),
    sampleReferences: brava.items
      .filter((i) => i.source)
      .map((i) => ({ dataset: i.source!.dataset, id: i.source!.id })),
    excludedBatteries: brava.skipped?.map((b) => b.battery) ?? [],
  };
}
export function createPublication(input: {
  id: string;
  title: string;
  preparedAt: string;
  codeRevision: string;
  rulesHash: string;
  series?: { series: Series; meetings: Run[] };
  bravas: Brava[];
}): Publication {
  const results = [
    ...(input.series ? [publicSeries(input.series.series, input.series.meetings)] : []),
    ...input.bravas.map(publicBrava),
  ];
  return publicationSchema.parse({
    schemaVersion: 1,
    status: 'published',
    edition: {
      id: input.id,
      title: input.title,
      preparedAt: input.preparedAt,
      codeRevision: input.codeRevision,
      rulesHash: input.rulesHash,
      results,
    },
  });
}
