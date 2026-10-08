export type Provider = 'jev' | 'decisions' | 'clef';
export const providers: Provider[] = ['jev', 'decisions', 'clef'];
// Meetings recorded before Clef joined have no providers field and compared only these two.
export const legacyProviders: Provider[] = ['jev', 'decisions'];
export const runProviders = (run: Pick<Run, 'providers'>): Provider[] =>
  run.providers ?? legacyProviders;
export const isProvider = (value: unknown): value is Provider =>
  providers.includes(value as Provider);
export type Participant = 'A' | 'B' | 'C';
export type Mapping = { A: Provider; B: Provider; C?: Provider };
export type Option = { value: string; label: string; description: string };
export type Question = {
  id: string;
  type: 'choice' | 'predicate' | 'score';
  text: string;
  options?: Option[];
  levels?: { label: string; description: string }[];
  expected: string | boolean | number;
  rationale: string;
  success: string;
  failure: string;
};
export type Round = { id: string; title: string; facts: string; question: Question };
export type Scenario = {
  id: string;
  title: string;
  description: string;
  context: string;
  rounds: Round[];
};
export type Answer = {
  type: Question['type'] | 'refusal';
  value: string | number;
  probabilities: { value: string; label: string; probability: number }[];
  confidence?: number;
};
export type Grade = {
  status: 'correct' | 'incorrect' | 'uncertain' | 'unavailable';
  effect: string;
};
export type ProviderResult = {
  provider: Provider;
  answer?: Answer;
  error?: string;
  durationMs: number;
  model: string;
  inputTokens: number | null;
  costUsd: number | null;
  grade: Grade;
  request: unknown;
  raw?: unknown;
};
export type RoundFeedback = {
  winner: Provider | 'tie' | 'inconclusive';
  text: string;
  error?: string;
  mapping?: Mapping;
};
export type RoundResult = {
  roundId: string;
  results: Partial<Record<Provider, ProviderResult>>;
  feedback?: RoundFeedback;
};
export type Narration = { introduction: string; rounds: { id: string; transition: string }[] };
export type JudgeResult = {
  winner: Participant | 'tie' | 'inconclusive';
  summary: string;
  evidence: { roundId: string; participant: Participant | 'both'; observation: string }[];
  limitations: string[];
};
export type JudgePass = { mapping: Mapping; result: JudgeResult };
// How the objective winner was decided: more reference points, or equal points broken by
// calibration; 'tie' and 'unavailable' declare no winner.
export type DecisionReason = 'points' | 'calibration' | 'tie' | 'unavailable';
export type Standing = {
  provider: Provider;
  correct: number;
  incorrect: number;
  uncertain: number;
  unavailable: number;
  total: number;
  // Mean Brier score over the rounds every participant answered; null without such rounds.
  brier: number | null;
  costUsd: number;
  unknownCosts: number;
  inputTokens: number;
  medianMs: number | null;
};
export type Verdict = {
  winner: Provider | 'tie' | 'inconclusive';
  summary: string;
  passes: JudgePass[];
  error?: string;
  // Present on meetings decided by the reference answers; older recordings were decided by Opus.
  basis?: 'objective';
  reason?: DecisionReason;
  standings?: Standing[];
};
export type CliCall = {
  role: 'moderator' | 'commentator' | 'judge';
  durationMs: number;
  model: string;
  estimatedUsd: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  prompt: string;
  output: unknown;
};
export type Phase =
  | 'preparing'
  | 'ready'
  | 'evaluating'
  | 'commenting'
  | 'judging'
  | 'complete'
  | 'cancelled'
  | 'failed';
export type Run = {
  id: string;
  mode: 'demo' | 'live';
  createdAt: string;
  updatedAt: string;
  phase: Phase;
  scenario: Scenario;
  scenarioHash: string;
  providers?: Provider[];
  seriesId?: string;
  autoplay?: boolean;
  nextAdvanceAt?: string;
  narration?: Narration;
  rounds: RoundResult[];
  cliCalls: CliCall[];
  verdict?: Verdict;
  error?: string;
  tariff: { date: string } & Partial<Record<Provider, number>>;
};
export type RunSummary = Pick<Run, 'id' | 'mode' | 'createdAt' | 'phase'> & {
  title: string;
  completedRounds: number;
  providers: Provider[];
  winner: Verdict['winner'] | null;
  costs: Partial<Record<Provider, { knownUsd: number; unknown: number }>>;
  cheapest: Provider | 'tie' | null;
};
export type Health = {
  keys: Record<Provider, boolean>;
  claude: {
    available: boolean;
    authenticated: boolean | null;
    version?: string;
    authMethod?: string;
    error?: string;
  };
  models: { claude: string } & Record<Provider, string>;
  ready: boolean;
};
export type Battery = {
  id: string;
  label: string;
  total: number;
  correct: Record<Provider, number>;
};
export type Divergence = {
  scenarioTitle: string;
  roundId: string;
  title: string;
  question: string;
  expected: string;
  answers: Partial<Record<Provider, { label: string; status: Grade['status'] }>>;
};
export type Recommendation = {
  kind: 'accuracy' | 'budget' | 'speed';
  title: string;
  providers: Provider[];
  text: string;
};
export type SeriesReport = {
  participants: Provider[];
  decisions: number;
  standings: Standing[];
  batteries: Battery[];
  winner: Provider | 'tie' | 'inconclusive';
  reason: DecisionReason;
  mostAccurate: Provider[];
  bestCalibrated: Provider[];
  cheapest: Provider[];
  fastest: Provider[];
  // Projected USD for one million decisions like these, from input-token prices only.
  costPerMillion: Partial<Record<Provider, number>>;
  divergences: Divergence[];
  recommendations: Recommendation[];
};
export type SeriesAnalysis = {
  mapping: Mapping;
  headline: string;
  summary: string;
  evidence: { roundId: string; participant: Participant | 'both'; observation: string }[];
  limitations: string[];
};
export type Series = {
  id: string;
  mode: Run['mode'];
  createdAt: string;
  updatedAt: string;
  phase: 'running' | 'complete' | 'cancelled' | 'failed';
  providers: Provider[];
  scenarioIds: string[];
  runIds: string[];
  nextStartAt?: string;
  report?: SeriesReport;
  analysis?: SeriesAnalysis;
  analysisError?: string;
  cliCalls: CliCall[];
  tariff: Run['tariff'];
  error?: string;
};
export type SeriesSummary = Pick<Series, 'id' | 'mode' | 'createdAt' | 'phase'> & {
  totalMeetings: number;
  completedMeetings: number;
  winner: SeriesReport['winner'] | null;
  cheapest: Provider[];
};
export type SeriesSnapshot = { series: Series; run: Run | null };
