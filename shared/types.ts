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
export type Verdict = {
  winner: Provider | 'tie' | 'inconclusive';
  summary: string;
  passes: JudgePass[];
  error?: string;
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
