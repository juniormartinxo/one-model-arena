import { createHash, randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import type { Run, Health, RoundResult } from '../shared/types';
import { providers, runProviders } from '../shared/types';
import { config, tariff } from './config';
import { Store } from './store';
import { scenarios } from './scenarios';
import { evaluate } from './providers';
import { callClaude, cliStatus, CliFailure } from './claude';
import {
  narrationSchema,
  feedbackSchema,
  judgeSchema,
  blindMapping,
  judgeRotations,
  revealWinner,
  narrationPrompt,
  commentaryPrompt,
  judgePrompt,
  combineVerdicts,
} from './judging';
import { demoResult } from './demo';
import { providerNames } from '../shared/presentation';
export class Engine {
  events = new EventEmitter();
  private controllers = new Map<string, AbortController>();
  constructor(public store: Store) {
    this.events.setMaxListeners(100);
  }
  async health(): Promise<Health> {
    const claude = await cliStatus();
    const keys = {
      jev: !!config.TYPESAFE_API_KEY,
      decisions: !!config.OPENAI_API_KEY,
      clef: !!config.CLOUDFLARE_ACCOUNT_ID && !!config.CLOUDFLARE_API_TOKEN,
    };
    return {
      keys,
      claude,
      models: {
        claude: config.CLAUDE_MODEL,
        jev: config.JEV_MODEL,
        decisions: config.OPENAI_MODEL,
        clef: config.CLEF_MODEL,
      },
      ready: providers.every((p) => keys[p]) && claude.available && claude.authenticated === true,
    };
  }
  persist(run: Run) {
    this.store.save(run);
    this.events.emit(run.id, structuredClone(run));
  }
  async create(scenarioId: string, mode: Run['mode']): Promise<Run> {
    if (this.store.list().some((r) => !['complete', 'cancelled', 'failed'].includes(r.phase)))
      throw new Error('Conclua ou encerre a reunião ativa antes de iniciar outra.');
    const scenario = scenarios.find((s) => s.id === scenarioId);
    if (!scenario) throw new Error('Cenário desconhecido.');
    if (mode === 'live') {
      const health = await this.health();
      if (!health.claude.available || health.claude.authenticated !== true)
        throw new Error(
          health.claude.error ?? 'Verifique o login do Claude CLI no perfil configurado.',
        );
      if (!health.ready)
        throw new Error(
          'Configure as chaves de OpenAI, TypeSafe e Cloudflare no .env antes da execução real.',
        );
    }
    // Recheck after the asynchronous preflight: two start requests must not create concurrent runs.
    if (this.store.list().some((r) => !['complete', 'cancelled', 'failed'].includes(r.phase)))
      throw new Error('Já existe uma reunião ativa.');
    const run: Run = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      mode,
      phase: 'preparing',
      scenario: structuredClone(scenario),
      scenarioHash: createHash('sha256').update(JSON.stringify(scenario)).digest('hex'),
      providers: [...providers],
      rounds: [],
      cliCalls: [],
      tariff,
    };
    const controller = new AbortController();
    this.controllers.set(run.id, controller);
    this.persist(run);
    void this.prepare(run, controller.signal);
    return run;
  }
  private async prepare(run: Run, signal: AbortSignal) {
    try {
      if (run.mode === 'demo')
        run.narration = {
          introduction:
            'Ensaio de interface. Vamos percorrer um roteiro fictício; respostas e comentários são exemplos locais, sem chamadas de IA.',
          rounds: run.scenario.rounds.map((r) => ({
            id: r.id,
            transition: `Vamos analisar: ${r.title.toLocaleLowerCase('pt-BR')}.`,
          })),
        };
      else {
        const { value, call } = await callClaude(
          'moderator',
          narrationPrompt(run),
          narrationSchema,
          signal,
        );
        run.cliCalls.push(call);
        if (value.rounds.some((r, i) => r.id !== run.scenario.rounds[i].id))
          throw new Error('O moderador alterou a sequência de rodadas.');
        run.narration = value;
      }
      signal.throwIfAborted();
      run.phase = 'ready';
      this.persist(run);
    } catch (e) {
      this.fail(run, e, signal);
    }
  }
  advance(id: string) {
    const run = this.store.get(id);
    if (!run) throw new Error('Reunião não encontrada.');
    if (run.phase !== 'ready') throw new Error('Aguarde a rodada atual antes de avançar.');
    const controller = this.controllers.get(id);
    if (!controller) throw new Error('Esta execução não está mais ativa.');
    run.phase = 'evaluating';
    this.persist(run);
    void this.round(run, controller.signal);
    return run;
  }
  private async round(run: Run, signal: AbortSignal) {
    try {
      const index = run.rounds.length;
      const round = run.scenario.rounds[index];
      if (!round) throw new Error('Não há mais rodadas.');
      const current: RoundResult = { roundId: round.id, results: {} };
      run.rounds.push(current);
      this.persist(run);
      const participants = runProviders(run);
      await Promise.all(
        participants.map(async (p) => {
          const result =
            run.mode === 'demo'
              ? demoResult(p, run, round, index)
              : await evaluate(p, run.scenario, round, signal);
          signal.throwIfAborted();
          current.results[p] = result;
          this.persist(run);
        }),
      );
      signal.throwIfAborted();
      run.phase = 'commenting';
      this.persist(run);
      if (run.mode === 'demo') {
        const correct = participants.filter((p) => current.results[p]!.grade.status === 'correct');
        const winner = correct.length === 1 ? correct[0] : 'tie';
        current.feedback = {
          winner,
          text: `Comentário sintético: ${round.question.rationale} ${winner === 'tie' ? 'Neste exemplo, nenhum participante se destaca sozinho.' : `Neste exemplo, só ${providerNames[winner]} adere à regra e ganha o ponto.`} Isso demonstra o painel, não mede os modelos.`,
        };
      } else {
        try {
          const mapping = blindMapping(participants);
          const { value, call } = await callClaude(
            'commentator',
            commentaryPrompt(run, mapping, round.id),
            feedbackSchema,
            signal,
          );
          run.cliCalls.push(call);
          const missing = participants.some(
            (p) => !current.results[p]?.answer || current.results[p]?.answer?.type === 'refusal',
          );
          current.feedback = {
            winner: missing ? 'inconclusive' : revealWinner(mapping, value.winner),
            text: value.text,
            mapping,
          };
        } catch (e) {
          if (signal.aborted) throw e;
          if (e instanceof CliFailure) run.cliCalls.push(e.call);
          current.feedback = {
            winner: 'inconclusive',
            text: 'O comentário do Opus não ficou disponível. Os resultados objetivos foram preservados.',
            error: safeError(e),
          };
        }
      }
      signal.throwIfAborted();
      this.persist(run);
      if (run.rounds.length === run.scenario.rounds.length) await this.finish(run, signal);
      else {
        run.phase = 'ready';
        this.persist(run);
      }
    } catch (e) {
      this.fail(run, e, signal);
    }
  }
  private async finish(run: Run, signal: AbortSignal) {
    run.phase = 'judging';
    this.persist(run);
    if (run.mode === 'demo')
      run.verdict = {
        winner: 'inconclusive',
        summary:
          'Ensaio concluído. Dados e comentários sintéticos não permitem comparar a qualidade real dos modelos.',
        passes: [],
      };
    else {
      const passes = [];
      try {
        for (const map of judgeRotations(runProviders(run))) {
          const { value, call } = await callClaude(
            'judge',
            judgePrompt(run, map),
            judgeSchema,
            signal,
          );
          run.cliCalls.push(call);
          if (value.evidence.some((e) => !run.scenario.rounds.some((r) => r.id === e.roundId)))
            throw new Error('O juiz citou uma rodada inexistente.');
          passes.push({ mapping: map, result: value });
          signal.throwIfAborted();
          this.persist(run);
        }
        run.verdict = combineVerdicts(passes, run);
      } catch (e) {
        if (signal.aborted) throw e;
        if (e instanceof CliFailure) run.cliCalls.push(e.call);
        run.verdict = {
          winner: 'inconclusive',
          summary:
            'O julgamento final não pôde ser concluído. As respostas e o placar objetivo permanecem disponíveis.',
          passes,
          error: safeError(e),
        };
      }
    }
    signal.throwIfAborted();
    run.phase = 'complete';
    this.persist(run);
    this.controllers.delete(run.id);
  }
  cancel(id: string) {
    const run = this.store.get(id);
    if (!run) throw new Error('Reunião não encontrada.');
    if (['complete', 'cancelled', 'failed'].includes(run.phase)) return run;
    this.controllers.get(id)?.abort();
    this.controllers.delete(id);
    run.phase = 'cancelled';
    this.persist(run);
    return run;
  }
  private fail(run: Run, error: unknown, signal: AbortSignal) {
    if (signal.aborted) return;
    if (error instanceof CliFailure) run.cliCalls.push(error.call);
    run.phase = 'failed';
    run.error = safeError(error);
    this.persist(run);
    this.controllers.delete(run.id);
  }
  close() {
    for (const id of this.controllers.keys()) this.cancel(id);
  }
}
function safeError(error: unknown) {
  return error instanceof Error
    ? error.name === 'ZodError'
      ? 'A resposta do CLI não corresponde ao formato esperado.'
      : error.message
    : 'Falha inesperada na execução.';
}
