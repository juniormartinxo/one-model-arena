export type Provider = 'jev' | 'decisions' | 'clef';
export const providers: Provider[] = ['jev', 'decisions', 'clef'];
// Meetings recorded before Clef joined have no providers field and compared only these two.
export const legacyProviders: Provider[] = ['jev', 'decisions'];
// Rodada 3: only the two models whose APIs accept images take part.
export const visualProviders: Provider[] = ['decisions', 'clef'];
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

// Rodada brava: batteries of harder items, scored per battery and averaged. The rodada 3
// (kind 'visual') reuses the same machinery with photos and only the models that read images.
export type BravaKind = 'brava' | 'visual';
export type BravaBatteryId =
  | 'robustez'
  | 'portugues'
  | 'abstencao'
  | 'negacao'
  | 'injecao'
  | 'contagem'
  | 'relacao'
  | 'profundidade'
  | 'distancia';
export type Perturbation = 'original' | 'ordem' | 'ruido' | 'digitacao' | 'direcao';
export type BravaItem = {
  id: string;
  battery: BravaBatteryId;
  title: string;
  context: string;
  facts: string;
  question: Question;
  // Items scored together: a robustness base question or a negation group.
  group?: string;
  variant?: Perturbation | 'parafrase' | 'escopo' | 'desfeita';
  // Irrelevant text added to the request only, so the catalog stays readable.
  noise?: boolean;
  source?: { dataset: string; id: string; license: string };
  // Real social-media text that may contain hate speech: never shown on screen.
  sensitive?: boolean;
  // Photo sent with the question; the file lives in data/datasets/imagens, outside Git.
  image?: { file: string };
};
export type BravaBattery = {
  id: BravaBatteryId;
  title: string;
  description: string;
  unit: 'grupo' | 'item';
  itemIds: string[];
};
export type CompactResult = {
  status: Grade['status'];
  label: string | null;
  // The decision taken: the option, Sim/Não/Revisão humana, or the nearest scale level.
  decision: string | null;
  // Probability given to the reference answer.
  expectedProbability: number | null;
  durationMs: number;
};
export type BatteryScore = {
  battery: BravaBatteryId;
  provider: Provider;
  score: number;
  passed: number;
  units: number;
  unavailable: number;
};
export type CalibrationBin = {
  from: number;
  to: number;
  count: number;
  accuracy: number;
  confidence: number;
};
export type BravaStanding = Standing & {
  score: number;
  calibration: CalibrationBin[];
  ece: number | null;
  // Share of round 1 questions whose decision changed in each version.
  flipRate: Partial<Record<Perturbation, number>>;
  // Changes split by direction: toward the reference answer or away from it.
  flips: Partial<
    Record<Perturbation, { changed: number; toward: number; away: number; compared: number }>
  >;
  invented: number;
  abstentionItems: number;
};
export type BravaReport = {
  participants: Provider[];
  items: number;
  standings: BravaStanding[];
  batteries: (Pick<BravaBattery, 'id' | 'title' | 'unit'> & {
    units: number;
    scores: Record<Provider, number>;
    leaders: Provider[];
  })[];
  winner: Provider | 'tie' | 'inconclusive';
  reason: DecisionReason;
  // 95% bootstrap interval of the score difference between the winner (or first leader) and each rival.
  margins: { vs: Provider; low: number; high: number; within: boolean }[];
  cheapest: Provider[];
  fastest: Provider[];
  costPerMillion: Partial<Record<Provider, number>>;
  highlights: {
    kind: BravaBatteryId | 'overall' | 'budget' | 'speed';
    title: string;
    providers: Provider[];
    text: string;
  }[];
  // Items removed from scoring after the run, with the reason shown in the report.
  annulled: { itemId: string; title: string; reason: string }[];
  divergences: {
    itemId: string;
    battery: BravaBatteryId;
    title: string;
    question: string;
    facts: string | null;
    expected: string;
    answers: Partial<Record<Provider, { label: string; status: Grade['status'] }>>;
  }[];
  round1?: { seriesId: string; accuracy: Record<Provider, number>; decisions: number };
};
export type BravaComment = { text: string; mapping?: Mapping; error?: string };
export type Brava = {
  id: string;
  // Absent on rodadas bravas recorded before the rodada 3 existed.
  kind?: BravaKind;
  mode: Run['mode'];
  createdAt: string;
  updatedAt: string;
  phase:
    | 'preparing'
    | 'running'
    | 'commenting'
    | 'pause'
    | 'reporting'
    | 'complete'
    | 'cancelled'
    | 'failed';
  providers: Provider[];
  catalogHash: string;
  batteries: BravaBattery[];
  items: BravaItem[];
  results: Record<string, Partial<Record<Provider, ProviderResult>>>;
  currentBattery: number;
  introduction?: string;
  comments: Partial<Record<BravaBatteryId, BravaComment>>;
  nextAt?: string;
  report?: BravaReport;
  analysis?: SeriesAnalysis;
  analysisError?: string;
  skipped?: { battery: BravaBatteryId; reason: string }[];
  cliCalls: CliCall[];
  tariff: Run['tariff'];
  error?: string;
};
// What the screen receives: no request or raw payloads.
export type BravaView = Omit<Brava, 'results'> & {
  results: Record<string, Partial<Record<Provider, CompactResult>>>;
};
export type BravaSummary = Pick<Brava, 'id' | 'mode' | 'createdAt' | 'phase'> & {
  kind: BravaKind;
  items: number;
  winner: BravaReport['winner'] | null;
};
