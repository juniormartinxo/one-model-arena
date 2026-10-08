import type { Answer, Grade, Question, Provider, Run } from './types';
export function gradeAnswer(q: Question, answer?: Answer): Grade {
  if (!answer || answer.type === 'refusal')
    return { status: 'unavailable', effect: 'Sem decisão utilizável; nenhuma ação simulada.' };
  if (
    q.type === 'predicate' &&
    typeof answer.value === 'number' &&
    answer.value > 0.2 &&
    answer.value < 0.8
  )
    return {
      status: 'uncertain',
      effect: 'Revisão humana: probabilidade na faixa de incerteza (20%–80%).',
    };
  const correct =
    q.type === 'choice'
      ? answer.value === q.expected
      : q.type === 'predicate'
        ? Number(answer.value) >= 0.8 === q.expected
        : Math.abs(Number(answer.value) - Number(q.expected)) <= 0.4;
  return { status: correct ? 'correct' : 'incorrect', effect: correct ? q.success : q.failure };
}
// Multi-class Brier score of the returned distribution against the reference answer:
// 0 is a certain correct answer, 2 a certain wrong one. Lower is better.
export function brier(q: Question, answer?: Answer): number | null {
  if (!answer || answer.type === 'refusal' || !answer.probabilities.length) return null;
  const expected = String(q.expected);
  return answer.probabilities.reduce(
    (sum, p) => sum + (p.probability - (p.value === expected ? 1 : 0)) ** 2,
    0,
  );
}
export function metrics(run: Run, provider: Provider) {
  const results = run.rounds.flatMap((r) => (r.results[provider] ? [r.results[provider]!] : []));
  const timings = results
    .filter((r) => r.answer)
    .map((r) => r.durationMs)
    .sort((a, b) => a - b);
  const n = timings.length;
  const pending = run.rounds.filter((r) => !r.results[provider]).length;
  const interrupted = ['cancelled', 'failed'].includes(run.phase) ? pending : 0;
  return {
    correct: results.filter((r) => r.grade.status === 'correct').length,
    incorrect: results.filter((r) => r.grade.status === 'incorrect').length,
    uncertain: results.filter((r) => r.grade.status === 'uncertain').length,
    unavailable: results.filter((r) => r.grade.status === 'unavailable').length + interrupted,
    total: results.length + interrupted,
    medianMs: n ? (timings[Math.floor((n - 1) / 2)] + timings[Math.floor(n / 2)]) / 2 : null,
    costUsd: results.reduce((sum, r) => sum + (r.costUsd ?? 0), 0),
    unknownCosts: results.filter((r) => r.costUsd === null).length + pending,
  };
}
