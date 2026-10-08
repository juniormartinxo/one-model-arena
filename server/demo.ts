import type { Provider, ProviderResult, Round, Run } from '../shared/types';
import { gradeAnswer } from '../shared/scoring';
import { requestFor } from './providers';
export function demoResult(
  provider: Provider,
  run: Run,
  round: Round,
  index: number,
): ProviderResult {
  const q = round.question;
  // Balanced, deterministic fixtures. These are NOT measurements of either model.
  const wrongRound = { jev: 1, decisions: 3, clef: 4 };
  const wrong = index === wrongRound[provider];
  let value: string | number;
  if (q.type === 'choice')
    value = wrong ? q.options!.find((o) => o.value !== q.expected)!.value : String(q.expected);
  else if (q.type === 'predicate') value = Boolean(q.expected) !== wrong ? 0.93 : 0.07;
  else value = wrong ? 0 : Number(q.expected);
  const probabilities =
    q.type === 'predicate'
      ? [
          { value: 'true', label: 'Sim', probability: Number(value) },
          { value: 'false', label: 'Não', probability: 1 - Number(value) },
        ]
      : (
          q.options?.map((o) => ({ value: o.value, label: o.label })) ??
          q.levels!.map((l, i) => ({ value: String(i), label: l.label }))
        ).map((o, _, all) => ({
          ...o,
          probability: o.value === String(value) ? 0.94 : 0.06 / (all.length - 1),
        }));
  const answer = {
    type: q.type,
    value,
    probabilities,
    ...(q.type !== 'predicate' ? { confidence: 0.83 } : {}),
  };
  return {
    provider,
    answer,
    grade: gradeAnswer(q, answer),
    durationMs: 0,
    model: 'fixture-sintetica',
    inputTokens: 0,
    costUsd: 0,
    request: requestFor(provider, run.scenario, round),
    raw: { synthetic: true, answer },
  };
}
