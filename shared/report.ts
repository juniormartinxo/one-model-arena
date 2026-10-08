import type {
  Battery,
  DecisionReason,
  Divergence,
  Provider,
  Recommendation,
  Run,
  SeriesReport,
  Standing,
} from './types';
import { brier } from './scoring';
import { answerLabel, expectedLabel, providerNames } from './presentation';

// Editorial thresholds, fixed before any run and shown on the Método page.
// Mean Brier differences below this are noise for a few dozen questions.
export const CALIBRATION_MARGIN = 0.005;
// Network jitter makes closer medians indistinguishable.
export const LATENCY_MARGIN_MS = 50;

const batteries: Record<string, { id: string; label: string }> = {
  loja: { id: 'basicos', label: 'Básicos' },
  produto: { id: 'basicos', label: 'Básicos' },
  fornecedor: { id: 'basicos', label: 'Básicos' },
  'lancamento-avancado': { id: 'avancados', label: 'Avançados' },
  'conversas-avancadas': { id: 'avancados', label: 'Avançados' },
  'dossie-estresse': { id: 'estresse', label: 'Estresse' },
};

const answered = (round: Run['rounds'][number], p: Provider) => {
  const answer = round.results[p]?.answer;
  return answer && answer.type !== 'refusal' ? answer : undefined;
};

export function standings(runs: Run[], participants: Provider[]): Standing[] {
  const timed = runs.every((r) => r.mode === 'live');
  return participants.map((provider) => {
    const s: Standing = {
      provider,
      correct: 0,
      incorrect: 0,
      uncertain: 0,
      unavailable: 0,
      total: 0,
      brier: null,
      costUsd: 0,
      unknownCosts: 0,
      inputTokens: 0,
      medianMs: null,
    };
    const scores: number[] = [];
    const durations: number[] = [];
    for (const run of runs)
      for (const round of run.rounds) {
        const question = run.scenario.rounds.find((r) => r.id === round.roundId)!.question;
        const result = round.results[provider];
        s.total++;
        const status = result?.grade.status ?? 'unavailable';
        s[status === 'correct' ? 'correct' : status]++;
        if (typeof result?.costUsd === 'number') s.costUsd += result.costUsd;
        else s.unknownCosts++;
        s.inputTokens += result?.inputTokens ?? 0;
        const answer = answered(round, provider);
        if (answer && result) durations.push(result.durationMs);
        // Calibration only compares rounds that every participant answered.
        if (participants.every((p) => answered(round, p))) scores.push(brier(question, answer)!);
      }
    if (scores.length) s.brier = scores.reduce((a, b) => a + b, 0) / scores.length;
    if (timed && durations.length) {
      durations.sort((a, b) => a - b);
      const n = durations.length;
      s.medianMs = (durations[Math.floor((n - 1) / 2)] + durations[Math.floor(n / 2)]) / 2;
    }
    return s;
  });
}

// The winner has the most reference points; equal points are broken by calibration.
// A missing answer could have been a point, so it must not be able to change the leader.
export function decide(table: Standing[]): {
  winner: Provider | 'tie' | 'inconclusive';
  reason: DecisionReason;
} {
  const best = Math.max(...table.map((s) => s.correct));
  let leaders = table.filter((s) => s.correct === best);
  let reason: DecisionReason = 'points';
  if (leaders.length > 1) {
    const ranked = [...leaders].sort((a, b) => (a.brier ?? Infinity) - (b.brier ?? Infinity));
    if (
      ranked.every((s) => s.brier !== null) &&
      ranked[1].brier! - ranked[0].brier! >= CALIBRATION_MARGIN
    ) {
      leaders = [ranked[0]];
      reason = 'calibration';
    }
  }
  const missing = table.some((s) => s.unavailable > 0);
  if (leaders.length > 1)
    return missing
      ? { winner: 'inconclusive', reason: 'unavailable' }
      : { winner: 'tie', reason: 'tie' };
  const winner = leaders[0];
  const contestable = table.some(
    (s) => s !== winner && s.unavailable > 0 && s.correct + s.unavailable >= winner.correct,
  );
  return contestable
    ? { winner: 'inconclusive', reason: 'unavailable' }
    : { winner: winner.provider, reason };
}

const within = (table: Standing[], value: (s: Standing) => number | null, margin: number) => {
  const values = table.map(value);
  if (values.some((v) => v === null)) return [];
  const min = Math.min(...(values as number[]));
  return table.filter((_, i) => (values[i] as number) - min <= margin).map((s) => s.provider);
};
const list = (items: string[]) =>
  items.length > 1 ? `${items.slice(0, -1).join(', ')} e ${items.at(-1)}` : (items[0] ?? '');
const names = (items: Provider[]) => list(items.map((p) => providerNames[p]));
const decimal = (value: number, digits = 1) =>
  value.toLocaleString('pt-BR', { maximumFractionDigits: digits, minimumFractionDigits: 0 });

function recommend(report: Omit<SeriesReport, 'recommendations'>): Recommendation[] {
  const byProvider = Object.fromEntries(report.standings.map((s) => [s.provider, s])) as Record<
    Provider,
    Standing
  >;
  const n = report.decisions;
  const out: Recommendation[] = [];
  const top = report.mostAccurate;
  const leader = report.winner !== 'tie' && report.winner !== 'inconclusive' ? report.winner : null;
  const hits = byProvider[top[0]].correct;
  out.push({
    kind: 'accuracy',
    title: 'Quando errar custa caro',
    providers: leader ? [leader] : top,
    text:
      top.length === 1
        ? `${names(top)} acertou ${hits} de ${n} decisões, mais que qualquer outro.`
        : leader
          ? `${names(top)} empataram com ${hits} de ${n} acertos; ${providerNames[leader]} desempatou com probabilidades mais bem calibradas.`
          : `${names(top)} empataram com ${hits} de ${n} acertos, sem diferença relevante de calibração.`,
  });
  if (report.cheapest.length === 1) {
    const cheap = report.cheapest[0];
    const reference = leader ?? top[0];
    const perDecision = (p: Provider) => byProvider[p].costUsd / byProvider[p].total;
    const ratio = perDecision(reference) / perDecision(cheap);
    const gap = byProvider[reference].correct - byProvider[cheap].correct;
    out.push({
      kind: 'budget',
      title: 'Quando o volume é alto',
      providers: [cheap],
      text: top.includes(cheap)
        ? `${providerNames[cheap]} teve o menor custo por decisão e também está entre os que mais acertaram.`
        : `${providerNames[cheap]} custa ${decimal(ratio)}× menos por decisão que ${providerNames[reference]} e acertou ${gap} ${gap === 1 ? 'decisão' : 'decisões'} a menos (${byProvider[cheap].correct} contra ${byProvider[reference].correct} de ${n}).`,
    });
  }
  if (report.fastest.length === 1) {
    const fast = report.fastest[0];
    out.push({
      kind: 'speed',
      title: 'Quando a resposta precisa ser imediata',
      providers: [fast],
      text: `${providerNames[fast]} teve a menor mediana de resposta: ${decimal(byProvider[fast].medianMs! / 1000, 2)} s por decisão, incluindo a rede.`,
    });
  }
  return out;
}

export function buildSeriesReport(runs: Run[], participants: Provider[]): SeriesReport {
  const table = standings(runs, participants);
  const live = runs.every((r) => r.mode === 'live');
  const decisions = table[0]?.total ?? 0;
  const groups = new Map<string, Battery>();
  for (const run of runs) {
    const battery = batteries[run.scenario.id] ?? { id: 'outros', label: 'Outros' };
    const entry =
      groups.get(battery.id) ??
      ({
        ...battery,
        total: 0,
        correct: Object.fromEntries(participants.map((p) => [p, 0])),
      } as Battery);
    for (const round of run.rounds) {
      entry.total++;
      for (const p of participants)
        if (round.results[p]?.grade.status === 'correct') entry.correct[p]++;
    }
    groups.set(battery.id, entry);
  }
  const divergences: Divergence[] = [];
  for (const run of runs)
    for (const round of run.rounds) {
      const statuses = participants.map((p) => round.results[p]?.grade.status ?? 'unavailable');
      if (statuses.every((s) => s === 'correct')) continue;
      const original = run.scenario.rounds.find((r) => r.id === round.roundId)!;
      divergences.push({
        scenarioTitle: run.scenario.title,
        roundId: round.roundId,
        title: original.title,
        question: original.question.text,
        expected: expectedLabel(original.question),
        answers: Object.fromEntries(
          participants.map((p, i) => [
            p,
            {
              label: answerLabel(original.question, round.results[p]?.answer) ?? 'Sem resposta',
              status: statuses[i],
            },
          ]),
        ),
      });
    }
  const costsKnown = live && table.every((s) => s.unknownCosts === 0 && s.total > 0);
  const costPerMillion = costsKnown
    ? Object.fromEntries(table.map((s) => [s.provider, (s.costUsd / s.total) * 1e6]))
    : {};
  const best = Math.max(...table.map((s) => s.correct));
  const base = {
    participants,
    decisions,
    standings: table,
    batteries: [...groups.values()],
    ...decide(table),
    mostAccurate: table.filter((s) => s.correct === best).map((s) => s.provider),
    bestCalibrated: within(table, (s) => s.brier, CALIBRATION_MARGIN),
    cheapest: costsKnown ? within(table, (s) => s.costUsd / s.total, 1e-15) : ([] as Provider[]),
    fastest: live ? within(table, (s) => s.medianMs, LATENCY_MARGIN_MS) : [],
    costPerMillion,
    divergences,
  };
  return { ...base, recommendations: live ? recommend(base) : [] };
}
