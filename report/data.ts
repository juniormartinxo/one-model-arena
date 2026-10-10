import type {
  Brava,
  BravaItem,
  Provider,
  ProviderResult,
  Question,
  Run,
  Series,
} from '../shared/types';
import { buildSeriesReport } from '../shared/report';
import { buildBravaReport } from '../shared/brava-report';
import { answerLabel, expectedLabel, revealParticipants } from '../shared/presentation';

function evidence(
  id: string,
  title: string,
  question: Question,
  facts: string,
  results: Partial<Record<Provider, ProviderResult>>,
  sensitive = false,
) {
  return {
    id,
    title,
    question: question.text,
    type: question.type,
    facts: sensitive ? 'Texto sensível omitido, como na arena.' : facts,
    sensitive,
    expected: expectedLabel(question),
    rationale: question.rationale,
    results: (['jev', 'decisions', 'clef'] as const)
      .filter((provider) => results[provider])
      .map((provider) => {
        const r = results[provider]!;
        return {
          provider,
          label: answerLabel(question, r!.answer) ?? 'Sem resposta',
          value: r!.answer?.value,
          probabilities: r!.answer?.probabilities ?? [],
          status: r!.grade.status,
          effect: r!.grade.effect,
          durationMs: r!.durationMs,
          inputTokens: r!.inputTokens,
          costUsd: r!.costUsd,
        };
      }),
  };
}

function real(record: { mode: string; phase: string }) {
  if (record.mode !== 'live' || record.phase !== 'complete')
    throw new Error('A conclusão exige execuções reais concluídas.');
}
function complete(results: (ProviderResult | undefined)[]) {
  if (
    results.some(
      (r) =>
        !r ||
        r.error ||
        !r.answer ||
        r.answer.type === 'refusal' ||
        r.costUsd == null ||
        !Number.isFinite(r.costUsd) ||
        r.costUsd < 0 ||
        r.inputTokens == null ||
        !Number.isFinite(r.inputTokens) ||
        r.inputTokens < 0,
    )
  )
    throw new Error(
      'Esta edição exige todas as respostas e custos completos. Preserve as tentativas com falhas separadamente.',
    );
}
function analysis(value: Series['analysis']) {
  return value
    ? {
        headline: revealParticipants(value.headline, value.mapping, true),
        summary: revealParticipants(value.summary, value.mapping, true),
        limitations: value.limitations.map((s) => revealParticipants(s, value.mapping, true)),
      }
    : null;
}
function battery(brava: Brava) {
  real(brava);
  complete(brava.items.flatMap((i) => brava.providers.map((p) => brava.results[i.id]?.[p])));
  return {
    id: brava.id,
    createdAt: brava.createdAt,
    hash: brava.catalogHash,
    tariff: brava.tariff,
    report: buildBravaReport(brava, brava.providers),
    analysis: analysis(brava.analysis),
    batteries: brava.batteries.map((b) => ({
      ...b,
      comment: revealParticipants(
        brava.comments[b.id]?.text ?? '',
        brava.comments[b.id]?.mapping,
        true,
      ),
      items: brava.items
        .filter((i) => i.battery === b.id)
        .map((i: BravaItem) => ({
          ...evidence(i.id, i.title, i.question, i.facts, brava.results[i.id] ?? {}, i.sensitive),
          context: i.sensitive ? '' : i.context,
          source: i.source,
          group: i.group,
          variant: i.variant,
        })),
    })),
  };
}
export function buildConclusionData(
  series: Series,
  meetings: Run[],
  brava: Brava,
  visual: Brava,
  previous: Brava[],
  provenance: { preparedAt: string; revision: string; rulesHash: string },
) {
  real(series);
  if (
    series.runIds.length !== meetings.length ||
    series.runIds.some((id, i) => meetings[i]?.id !== id)
  )
    throw new Error('As reuniões não correspondem à maratona selecionada.');
  if ((brava.kind ?? 'brava') !== 'brava' || visual.kind !== 'visual')
    throw new Error('Tipos de rodada incompatíveis.');
  const allResults: Partial<Record<Provider, ProviderResult>>[] = [];
  for (const run of meetings) {
    real(run);
    if (
      run.rounds.length !== run.scenario.rounds.length ||
      run.scenario.rounds.some((q) => !run.rounds.some((r) => r.roundId === q.id))
    )
      throw new Error('Reunião incompleta.');
    complete(run.rounds.flatMap((r) => series.providers.map((p) => r.results[p])));
    allResults.push(...run.rounds.map((r) => r.results));
  }
  allResults.push(...Object.values(brava.results), ...Object.values(visual.results));
  return {
    schemaVersion: 1,
    ...provenance,
    models: series.providers.map((p) => ({
      provider: p,
      versions: [...new Set(allResults.map((r) => r[p]?.model).filter((s): s is string => !!s))],
    })),
    series: {
      id: series.id,
      createdAt: series.createdAt,
      tariff: series.tariff,
      report: buildSeriesReport(meetings, series.providers),
      analysis: analysis(series.analysis),
      meetings: meetings.map((run) => ({
        id: run.id,
        scenarioId: run.scenario.id,
        hash: run.scenarioHash,
        title: run.scenario.title,
        description: run.scenario.description,
        context: run.scenario.context,
        report: buildSeriesReport([run], series.providers),
        opus: revealParticipants(run.verdict?.summary ?? '', run.verdict?.passes[0]?.mapping, true),
        rounds: run.scenario.rounds.map((q) =>
          evidence(
            q.id,
            q.title,
            q.question,
            q.facts,
            run.rounds.find((r) => r.roundId === q.id)!.results,
          ),
        ),
      })),
    },
    brava: battery(brava),
    visual: battery(visual),
    previous: previous
      .filter(
        (b) =>
          b.kind === 'visual' &&
          b.mode === 'live' &&
          b.id !== visual.id &&
          b.createdAt < visual.createdAt,
      )
      .map((b) => ({
        id: b.id,
        createdAt: b.createdAt,
        phase: b.phase,
        recorded: Object.values(b.results).reduce((n, rs) => n + Object.keys(rs).length, 0),
        errors: Object.values(b.results)
          .flatMap((rs) => Object.values(rs))
          .filter((r) => r?.error)
          .map((r) => ({
            provider: r!.provider,
            kind: /daily free allocation|Cota gratuita diária/i.test(r!.error!)
              ? 'Cota diária'
              : /413/.test(r!.error!)
                ? '413 · tamanho/contexto'
                : /429/.test(r!.error!)
                  ? '429 · capacidade'
                  : /504/.test(r!.error!)
                    ? '504 · timeout'
                    : 'Falha de serviço',
          })),
      })),
  };
}
export type ConclusionData = ReturnType<typeof buildConclusionData>;
export type Evidence = ReturnType<typeof evidence>;
