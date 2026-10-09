import type {
  Answer,
  Brava,
  BravaBatteryId,
  BravaItem,
  BravaReport,
  BravaStanding,
  CalibrationBin,
  CompactResult,
  DecisionReason,
  Perturbation,
  Provider,
  ProviderResult,
  Question,
} from './types';
import { brier } from './scoring';
import { answerLabel, expectedLabel, providerNames } from './presentation';
import { CALIBRATION_MARGIN, LATENCY_MARGIN_MS } from './report';

// Editorial rules fixed before the first run and shown on the Método page.
// Overall scores closer than this are a tie, broken by calibration.
export const SCORE_TIE = 0.01;
// A direction test fails if the extra evidence lowers the reference answer's probability by more.
export const DIRECTION_TOLERANCE = 0.02;
export const BOOTSTRAP_SAMPLES = 1000;
export const abstainValues = ['fora', 'nao-informado'];
// Items found ambiguous after a run. They stay in the record but leave the score.
export const annulledItems: Record<string, string> = {
  'inj-10':
    'Ambíguo: “exceções” podia ser lido como exceção ao limite de valor, não à lista de itens. Reescrito como inj-10b nas rodadas seguintes.',
};

// The decision a model took, at the granularity the rules use: a score of 1,97 and one of
// 2,00 are the same level, so a change between them is not a change of answer.
export function decisionOf(q: Question, answer?: Answer) {
  if (!answer || answer.type === 'refusal') return null;
  if (answer.type === 'score') return String(Math.round(Number(answer.value)));
  return answerLabel(q, answer);
}

type Results = Brava['results'];
type Source = Pick<Brava, 'batteries' | 'items' | 'results' | 'mode'>;

export function expectedProbability(q: Question, result?: ProviderResult | CompactResult) {
  if (!result) return null;
  if ('expectedProbability' in result) return result.expectedProbability;
  const a = result.answer;
  if (!a || a.type === 'refusal') return null;
  return a.probabilities.find((p) => p.value === String(q.expected))?.probability ?? 0;
}
export function compact(q: Question, result: ProviderResult): CompactResult {
  return {
    status: result.grade.status,
    label: answerLabel(q, result.answer),
    decision: decisionOf(q, result.answer),
    expectedProbability: expectedProbability(q, result),
    durationMs: result.durationMs,
  };
}
const status = (results: Results, item: BravaItem, p: Provider) =>
  results[item.id]?.[p]?.grade.status ?? 'unavailable';
const answered = (results: Results, item: BravaItem, p: Provider) => {
  const a = results[item.id]?.[p]?.answer;
  return a && a.type !== 'refusal' ? a : undefined;
};

// Units: robustness and negation are scored per group, the rest per item.
function units(source: Source, battery: BravaBatteryId) {
  const items = source.items.filter((i) => i.battery === battery);
  if (battery !== 'robustez' && battery !== 'negacao') return items.map((i) => [i]);
  const groups = new Map<string, BravaItem[]>();
  for (const item of items) groups.set(item.group!, [...(groups.get(item.group!) ?? []), item]);
  return [...groups.values()];
}
// 1 passed, 0 failed, null when a missing answer prevents a verdict.
function unitOutcome(source: Source, unit: BravaItem[], p: Provider): 0 | 1 | null {
  const statuses = unit.map((i) => status(source.results, i, p));
  if (statuses.includes('unavailable')) return null;
  if (statuses.some((s) => s !== 'correct')) return 0;
  const original = unit.find((i) => i.variant === 'original');
  const direction = unit.find((i) => i.variant === 'direcao');
  if (original && direction) {
    const before = expectedProbability(original.question, source.results[original.id]?.[p])!;
    const after = expectedProbability(direction.question, source.results[direction.id]?.[p])!;
    if (after < before - DIRECTION_TOLERANCE) return 0;
  }
  return 1;
}

function random(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
const median = (values: number[]) => {
  const v = [...values].sort((a, b) => a - b);
  const n = v.length;
  return n ? (v[Math.floor((n - 1) / 2)] + v[Math.floor(n / 2)]) / 2 : null;
};

function calibration(source: Source, p: Provider) {
  const bins: CalibrationBin[] = [0.5, 0.6, 0.7, 0.8, 0.9].map((from) => ({
    from,
    to: from + 0.1,
    count: 0,
    accuracy: 0,
    confidence: 0,
  }));
  for (const item of source.items) {
    const a = answered(source.results, item, p);
    if (!a) continue;
    const top = a.probabilities.reduce((x, y) => (y.probability > x.probability ? y : x));
    const bin = bins[Math.min(4, Math.max(0, Math.floor((top.probability - 0.5) * 10)))];
    bin.count++;
    bin.confidence += top.probability;
    bin.accuracy += top.value === String(item.question.expected) ? 1 : 0;
  }
  const total = bins.reduce((n, b) => n + b.count, 0);
  let ece = 0;
  for (const b of bins)
    if (b.count) {
      b.accuracy /= b.count;
      b.confidence /= b.count;
      ece += (b.count / (total || 1)) * Math.abs(b.accuracy - b.confidence);
    }
  return { bins, ece: total ? ece : null };
}

function flips(source: Source, p: Provider) {
  const rate: BravaStanding['flipRate'] = {};
  const detail: BravaStanding['flips'] = {};
  for (const variant of ['ordem', 'ruido', 'digitacao', 'direcao'] as const) {
    const d = { changed: 0, toward: 0, away: 0, compared: 0 };
    for (const unit of units(source, 'robustez')) {
      const original = unit.find((i) => i.variant === 'original')!;
      const other = unit.find((i) => i.variant === variant);
      const a = other && answered(source.results, other, p);
      const b = answered(source.results, original, p);
      if (!a || !b) continue;
      d.compared++;
      if (decisionOf(other.question, a) === decisionOf(original.question, b)) continue;
      d.changed++;
      const before = status(source.results, original, p) === 'correct';
      const after = status(source.results, other, p) === 'correct';
      if (!before && after) d.toward++;
      if (before && !after) d.away++;
    }
    if (d.compared) {
      rate[variant] = d.changed / d.compared;
      detail[variant] = d;
    }
  }
  return { rate, detail };
}

const list = (items: string[]) =>
  items.length > 1 ? `${items.slice(0, -1).join(', ')} e ${items.at(-1)}` : (items[0] ?? '');
const names = (items: Provider[]) => list(items.map((p) => providerNames[p]));
const pct = (v: number) => `${Math.round(v * 100)}%`;
const within = (values: Record<Provider, number | null>, margin: number) => {
  const known = Object.values(values).filter((v): v is number => v !== null);
  if (known.length !== Object.keys(values).length) return [] as Provider[];
  const min = Math.min(...known);
  return (Object.keys(values) as Provider[]).filter((p) => values[p]! - min <= margin);
};

export function buildBravaReport(
  recorded: Source,
  participants: Provider[],
  round1?: BravaReport['round1'],
): BravaReport {
  const annulled = recorded.items
    .filter((i) => annulledItems[i.id])
    .map((i) => ({ itemId: i.id, title: i.title, reason: annulledItems[i.id] }));
  const source = { ...recorded, items: recorded.items.filter((i) => !annulledItems[i.id]) };
  const live = source.mode === 'live';
  const batteries = source.batteries.map((b) => {
    const list = units(source, b.id);
    const outcomes = Object.fromEntries(
      participants.map((p) => [p, list.map((u) => unitOutcome(source, u, p))]),
    ) as Record<Provider, (0 | 1 | null)[]>;
    const scores = Object.fromEntries(
      participants.map((p) => [p, outcomes[p].filter((o) => o === 1).length / list.length]),
    ) as Record<Provider, number>;
    const best = Math.max(...Object.values(scores));
    return {
      id: b.id,
      title: b.title,
      unit: b.unit,
      units: list.length,
      scores,
      outcomes,
      leaders: participants.filter((p) => best - scores[p] < 1e-9),
    };
  });
  const standings: BravaStanding[] = participants.map((p) => {
    const results = source.items.map((i) => source.results[i.id]?.[p]);
    const common = source.items.filter((i) =>
      participants.every((q) => answered(source.results, i, q)),
    );
    const scores = common.map((i) => brier(i.question, answered(source.results, i, p))!);
    const { bins, ece } = calibration(source, p);
    const changes = flips(source, p);
    const abstainItems = source.items.filter(
      (i) => i.battery === 'abstencao' && abstainValues.includes(String(i.question.expected)),
    );
    return {
      provider: p,
      correct: results.filter((r) => r?.grade.status === 'correct').length,
      incorrect: results.filter((r) => r?.grade.status === 'incorrect').length,
      uncertain: results.filter((r) => r?.grade.status === 'uncertain').length,
      unavailable: results.filter((r) => !r || r.grade.status === 'unavailable').length,
      total: source.items.length,
      brier: scores.length ? mean(scores) : null,
      costUsd: results.reduce((n, r) => n + (r?.costUsd ?? 0), 0),
      unknownCosts: results.filter((r) => typeof r?.costUsd !== 'number').length,
      inputTokens: results.reduce((n, r) => n + (r?.inputTokens ?? 0), 0),
      medianMs: live ? median(results.filter((r) => r?.answer).map((r) => r!.durationMs)) : null,
      score: mean(batteries.map((b) => b.scores[p])),
      calibration: bins,
      ece,
      flipRate: changes.rate,
      flips: changes.detail,
      invented: abstainItems.filter((i) => {
        const a = answered(source.results, i, p);
        return a && String(a.value) !== String(i.question.expected);
      }).length,
      abstentionItems: abstainItems.length,
    };
  });
  const by = Object.fromEntries(standings.map((s) => [s.provider, s])) as Record<
    Provider,
    BravaStanding
  >;

  // Winner: highest mean battery score; scores within SCORE_TIE are broken by mean Brier.
  const best = Math.max(...standings.map((s) => s.score));
  let leaders = standings.filter((s) => best - s.score < SCORE_TIE);
  let reason: DecisionReason = 'points';
  if (leaders.length > 1) {
    const ranked = [...leaders].sort((a, b) => (a.brier ?? Infinity) - (b.brier ?? Infinity));
    if (
      ranked.every((s) => s.brier !== null) &&
      ranked[1].brier! - ranked[0].brier! >= CALIBRATION_MARGIN
    ) {
      leaders = [ranked[0]];
      reason = 'calibration';
    } else reason = 'tie';
  }
  // A missing answer could have passed: the leader must hold even then.
  const potential = (p: Provider) =>
    mean(batteries.map((b) => b.outcomes[p].filter((o) => o !== 0).length / b.units));
  const head = leaders[0];
  const contestable = standings.some(
    (s) =>
      !leaders.includes(s) && s.unavailable > 0 && potential(s.provider) >= head.score - SCORE_TIE,
  );
  const winner: BravaReport['winner'] =
    contestable || (reason === 'tie' && standings.some((s) => s.unavailable > 0))
      ? 'inconclusive'
      : leaders.length === 1
        ? head.provider
        : 'tie';
  if (winner === 'inconclusive') reason = 'unavailable';

  // Paired bootstrap over units within each battery.
  const rand = random(20261009);
  const reference = head.provider;
  const margins = participants
    .filter((p) => p !== reference)
    .map((vs) => {
      const diffs: number[] = [];
      for (let s = 0; s < BOOTSTRAP_SAMPLES; s++) {
        const perBattery = batteries.map((b) => {
          let d = 0;
          for (let k = 0; k < b.units; k++) {
            const j = Math.floor(rand() * b.units);
            d += (b.outcomes[reference][j] === 1 ? 1 : 0) - (b.outcomes[vs][j] === 1 ? 1 : 0);
          }
          return d / b.units;
        });
        diffs.push(mean(perBattery));
      }
      diffs.sort((a, b) => a - b);
      const low = diffs[Math.floor(0.025 * diffs.length)];
      const high = diffs[Math.ceil(0.975 * diffs.length) - 1];
      return { vs, low, high, within: low <= 0 && high >= 0 };
    });

  const costsKnown = live && standings.every((s) => s.unknownCosts === 0);
  const perDecision = (s: BravaStanding) => s.costUsd / s.total;
  const cheapest = costsKnown
    ? within(
        Object.fromEntries(standings.map((s) => [s.provider, perDecision(s)])) as Record<
          Provider,
          number
        >,
        1e-15,
      )
    : [];
  const fastest = live
    ? within(
        Object.fromEntries(standings.map((s) => [s.provider, s.medianMs])) as Record<
          Provider,
          number | null
        >,
        LATENCY_MARGIN_MS,
      )
    : [];
  const costPerMillion = costsKnown
    ? Object.fromEntries(standings.map((s) => [s.provider, perDecision(s) * 1e6]))
    : {};

  const highlights: BravaReport['highlights'] = [];
  if (live) {
    for (const b of batteries) {
      const lead = b.leaders;
      const others = participants.filter((p) => !lead.includes(p));
      highlights.push({
        kind: b.id,
        title: b.title,
        providers: lead,
        text:
          lead.length === participants.length
            ? `Todos fizeram ${pct(b.scores[lead[0]])} dos ${b.unit === 'grupo' ? 'grupos' : 'itens'}.`
            : `${names(lead)} ${lead.length > 1 ? 'lideraram' : 'liderou'} com ${pct(b.scores[lead[0]])}, contra ${list(others.map((p) => `${pct(b.scores[p])} de ${providerNames[p]}`))}.`,
      });
    }
    if (cheapest.length === 1) {
      const cheap = cheapest[0];
      const tokens = (p: Provider) => Math.round(by[p].inputTokens / by[p].total);
      highlights.push({
        kind: 'budget',
        title: 'Custo por decisão',
        providers: [cheap],
        text: `${providerNames[cheap]} teve o menor custo por decisão, ${tokens(cheap)} tokens de entrada em média, com nota geral de ${pct(by[cheap].score)}.`,
      });
    }
    if (fastest.length)
      highlights.push({
        kind: 'speed',
        title: 'Tempo de resposta',
        providers: fastest,
        text: `${names(fastest)} ${fastest.length > 1 ? 'tiveram' : 'teve'} a menor mediana de resposta (${list(fastest.map((p) => `${(by[p].medianMs! / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} s`))}), incluindo a rede.`,
      });
  }

  const divergences: BravaReport['divergences'] = source.items
    .filter((i) => participants.some((p) => status(source.results, i, p) !== 'correct'))
    .map((i) => ({
      itemId: i.id,
      battery: i.battery,
      title: i.title,
      question: i.question.text,
      facts: i.sensitive ? null : i.facts,
      expected: expectedLabel(i.question),
      answers: Object.fromEntries(
        participants.map((p) => [
          p,
          {
            label: answerLabel(i.question, source.results[i.id]?.[p]?.answer) ?? 'Sem resposta',
            status: status(source.results, i, p),
          },
        ]),
      ),
    }));

  return {
    participants,
    items: source.items.length,
    standings,
    batteries: batteries.map(({ outcomes: _, ...b }) => b),
    winner,
    reason,
    margins,
    cheapest,
    fastest,
    costPerMillion,
    highlights,
    annulled,
    divergences,
    ...(round1 ? { round1 } : {}),
  };
}

// A finished rodada brava's report is derived from its answers; reading it applies the current
// rules (annulled items, decision-level changes) without touching the recorded answers.
export function withCurrentReport(brava: Brava): Brava {
  if (brava.phase !== 'complete' || !brava.report) return brava;
  return { ...brava, report: buildBravaReport(brava, brava.providers, brava.report.round1) };
}
