import { createHash, randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import type { Run, Health, Provider, RoundResult, Series, Verdict } from '../shared/types';
import { providers, runProviders } from '../shared/types';
import { config, tariff } from './config';
import { Store } from './store';
import { scenarios } from './scenarios';
import { evaluate } from './providers';
import { callClaude, cliStatus, CliFailure } from './claude';
import {
  narrationSchema,
  feedbackSchema,
  analysisSchema,
  seriesAnalysisSchema,
  blindMapping,
  blindWinner,
  narrationPrompt,
  commentaryPrompt,
  analysisPrompt,
  seriesAnalysisPrompt,
} from './judging';
import { demoResult } from './demo';
import { decisionText, providerNames } from '../shared/presentation';
import { buildSeriesReport, decide, standings } from '../shared/report';
import { BravaRunner } from './brava/runner';
const keyNames: Record<Provider, string> = {
  decisions: 'OpenAI',
  jev: 'TypeSafe',
  clef: 'Cloudflare',
};
const finished = (phase: Run['phase']) => ['complete', 'cancelled', 'failed'].includes(phase);
export class Engine {
  events = new EventEmitter();
  private controllers = new Map<string, AbortController>();
  // Pending automatic steps, keyed by run id (next round) or series id (next meeting).
  private timers = new Map<string, NodeJS.Timeout>();
  private seriesControllers = new Map<string, AbortController>();
  brava: BravaRunner;
  constructor(public store: Store) {
    this.events.setMaxListeners(100);
    this.brava = new BravaRunner(this);
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
    if (run.seriesId) this.emitSeries(run.seriesId, run);
  }
  private persistSeries(series: Series) {
    this.store.saveSeries(series);
    this.emitSeries(series.id);
  }
  private emitSeries(id: string, run?: Run) {
    const series = this.store.getSeries(id);
    if (!series) return;
    const current = run ?? (series.runIds.length ? this.store.get(series.runIds.at(-1)!) : null);
    this.events.emit(`series:${id}`, { series, run: current ?? null });
  }
  private schedule(key: string, ms: number, task: () => void) {
    clearTimeout(this.timers.get(key));
    this.timers.set(
      key,
      setTimeout(() => {
        this.timers.delete(key);
        task();
      }, ms),
    );
  }
  private unschedule(key: string) {
    clearTimeout(this.timers.get(key));
    this.timers.delete(key);
  }
  // Only the keys of the providers taking part are required: the rodada 3 runs without Jev.
  async preflight(mode: Run['mode'], participants: Provider[] = providers) {
    if (mode !== 'live') return;
    const health = await this.health();
    if (!health.claude.available || health.claude.authenticated !== true)
      throw new Error(
        health.claude.error ?? 'Verifique o login do Claude CLI no perfil configurado.',
      );
    const missing = participants.filter((p) => !health.keys[p]).map((p) => keyNames[p]);
    if (missing.length)
      throw new Error(
        `Configure as chaves de ${missing.join(', ').replace(/, ([^,]*)$/, ' e $1')} no .env antes da execução real.`,
      );
  }
  async create(
    scenarioId: string,
    mode: Run['mode'],
    options: { seriesId?: string; autoplay?: boolean } = {},
  ): Promise<Run> {
    if (!options.seriesId && this.store.hasActive())
      throw new Error('Conclua ou encerre a reunião ativa antes de iniciar outra.');
    const scenario = scenarios.find((s) => s.id === scenarioId);
    if (!scenario) throw new Error('Cenário desconhecido.');
    await this.preflight(mode);
    // Recheck after the asynchronous preflight: two start requests must not create concurrent runs.
    if (!options.seriesId && this.store.hasActive())
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
      ...(options.seriesId ? { seriesId: options.seriesId } : {}),
      ...(options.autoplay ? { autoplay: true } : {}),
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
      this.ready(run);
    } catch (e) {
      this.fail(run, e, signal);
    }
  }
  // Automatic meetings keep the result on screen for a reading pause, then move on.
  private ready(run: Run) {
    run.phase = 'ready';
    if (run.autoplay) {
      run.nextAdvanceAt = new Date(Date.now() + config.AUTOPLAY_DELAY_MS).toISOString();
      this.schedule(run.id, config.AUTOPLAY_DELAY_MS, () => {
        try {
          this.advance(run.id);
        } catch {
          // Cancelled or already advanced in the meantime.
        }
      });
    }
    this.persist(run);
  }
  advance(id: string) {
    const run = this.store.get(id);
    if (!run) throw new Error('Reunião não encontrada.');
    if (run.phase !== 'ready') throw new Error('Aguarde a rodada atual antes de avançar.');
    const controller = this.controllers.get(id);
    if (!controller) throw new Error('Esta execução não está mais ativa.');
    this.unschedule(id);
    delete run.nextAdvanceAt;
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
      // A round goes to whoever alone matched the reference answer; calibration only breaks
      // ties for whole meetings.
      const roundOnly = standings([{ ...run, rounds: [current] }], participants).map((s) => ({
        ...s,
        brier: null,
      }));
      const winner = decide(roundOnly).winner;
      if (run.mode === 'demo') {
        current.feedback = {
          winner,
          text: `Comentário sintético: ${round.question.rationale} ${winner === 'tie' ? 'Neste exemplo, nenhum participante se destaca sozinho.' : winner === 'inconclusive' ? 'Neste exemplo, falta uma resposta.' : `Neste exemplo, só ${providerNames[winner]} adere à regra e ganha o ponto.`} Isso demonstra o painel, não mede os modelos.`,
        };
      } else {
        const mapping = blindMapping(participants);
        try {
          const { value, call } = await callClaude(
            'commentator',
            commentaryPrompt(run, mapping, round.id, winner),
            feedbackSchema,
            signal,
          );
          run.cliCalls.push(call);
          current.feedback = { winner, text: value.text, mapping };
        } catch (e) {
          if (signal.aborted) throw e;
          if (e instanceof CliFailure) run.cliCalls.push(e.call);
          current.feedback = {
            winner,
            text: 'O comentário do Opus não ficou disponível. Os resultados objetivos foram preservados.',
            error: safeError(e),
          };
        }
      }
      signal.throwIfAborted();
      this.persist(run);
      if (run.rounds.length === run.scenario.rounds.length) await this.finish(run, signal);
      else this.ready(run);
    } catch (e) {
      this.fail(run, e, signal);
    }
  }
  private async finish(run: Run, signal: AbortSignal) {
    run.phase = 'judging';
    this.persist(run);
    const participants = runProviders(run);
    const table = standings([run], participants);
    const decision = decide(table);
    const verdict: Verdict = {
      ...decision,
      basis: 'objective',
      standings: table,
      summary: `${run.mode === 'demo' ? 'Ensaio sintético: ' : ''}${decisionText(decision, table)}`,
      passes: [],
    };
    if (run.mode === 'live') {
      // Opus no longer decides: one blind session explains the objective result.
      const mapping = blindMapping(participants);
      try {
        const { value, call } = await callClaude(
          'judge',
          analysisPrompt(run, mapping, decision, table),
          analysisSchema,
          signal,
        );
        run.cliCalls.push(call);
        if (value.evidence.some((e) => !run.scenario.rounds.some((r) => r.id === e.roundId)))
          throw new Error('O Opus citou uma rodada inexistente.');
        verdict.passes = [
          { mapping, result: { ...value, winner: blindWinner(mapping, decision.winner) } },
        ];
        verdict.summary = value.summary;
      } catch (e) {
        if (signal.aborted) throw e;
        if (e instanceof CliFailure) run.cliCalls.push(e.call);
        verdict.error = `A explicação do Opus não ficou disponível: ${safeError(e)}`;
      }
    }
    run.verdict = verdict;
    signal.throwIfAborted();
    run.phase = 'complete';
    this.persist(run);
    this.controllers.delete(run.id);
    if (run.seriesId) this.meetingDone(run.seriesId);
  }
  cancel(id: string) {
    const run = this.store.get(id);
    if (!run) throw new Error('Reunião não encontrada.');
    if (finished(run.phase)) return run;
    this.controllers.get(id)?.abort();
    this.controllers.delete(id);
    this.unschedule(id);
    run.phase = 'cancelled';
    delete run.nextAdvanceAt;
    this.persist(run);
    if (run.seriesId) this.stopSeries(run.seriesId, 'cancelled');
    return run;
  }
  private fail(run: Run, error: unknown, signal: AbortSignal) {
    if (signal.aborted) return;
    if (error instanceof CliFailure) run.cliCalls.push(error.call);
    this.unschedule(run.id);
    delete run.nextAdvanceAt;
    run.phase = 'failed';
    run.error = safeError(error);
    this.persist(run);
    this.controllers.delete(run.id);
    if (run.seriesId) this.stopSeries(run.seriesId, 'failed', `Reunião interrompida: ${run.error}`);
  }
  async startSeries(mode: Run['mode']): Promise<Series> {
    if (this.store.hasActive())
      throw new Error(
        'Conclua ou encerre a reunião ativa antes de iniciar uma Maratona de reuniões.',
      );
    await this.preflight(mode);
    if (this.store.hasActive()) throw new Error('Já existe uma reunião ativa.');
    const series: Series = {
      id: randomUUID(),
      mode,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      phase: 'running',
      providers: [...providers],
      scenarioIds: scenarios.map((s) => s.id),
      runIds: [],
      cliCalls: [],
      tariff,
    };
    this.seriesControllers.set(series.id, new AbortController());
    this.store.saveSeries(series);
    await this.nextMeeting(series.id);
    return this.store.getSeries(series.id)!;
  }
  private async nextMeeting(id: string) {
    const series = this.store.getSeries(id);
    if (!series || series.phase !== 'running') return;
    delete series.nextStartAt;
    try {
      const run = await this.create(series.scenarioIds[series.runIds.length], series.mode, {
        seriesId: id,
        autoplay: true,
      });
      series.runIds.push(run.id);
      this.persistSeries(series);
    } catch (e) {
      series.phase = 'failed';
      series.error = safeError(e);
      this.persistSeries(series);
      this.seriesControllers.delete(id);
    }
  }
  private meetingDone(id: string) {
    const series = this.store.getSeries(id);
    if (!series || series.phase !== 'running') return;
    if (series.runIds.length < series.scenarioIds.length) {
      // Keeps the meeting result on screen before the next one opens.
      series.nextStartAt = new Date(Date.now() + config.SERIES_PAUSE_MS).toISOString();
      this.persistSeries(series);
      this.schedule(id, config.SERIES_PAUSE_MS, () => void this.nextMeeting(id));
    } else void this.finishSeries(series);
  }
  private async finishSeries(series: Series) {
    const signal = this.seriesControllers.get(series.id)?.signal ?? new AbortController().signal;
    const runs = series.runIds.map((runId) => this.store.get(runId)!);
    series.report = buildSeriesReport(runs, series.providers);
    this.persistSeries(series);
    if (series.mode === 'live') {
      const mapping = blindMapping(series.providers);
      try {
        const { value, call } = await callClaude(
          'judge',
          seriesAnalysisPrompt(runs, series.report, mapping),
          seriesAnalysisSchema,
          signal,
        );
        series.cliCalls.push(call);
        const known = new Set(runs.flatMap((r) => r.scenario.rounds.map((round) => round.id)));
        if (value.evidence.some((e) => !known.has(e.roundId)))
          throw new Error('O Opus citou uma rodada inexistente.');
        series.analysis = { mapping, ...value };
      } catch (e) {
        if (signal.aborted) return;
        if (e instanceof CliFailure) series.cliCalls.push(e.call);
        series.analysisError = `A leitura final do Opus não ficou disponível: ${safeError(e)}`;
      }
    }
    const latest = this.store.getSeries(series.id);
    if (!latest || latest.phase !== 'running') return;
    series.phase = 'complete';
    this.persistSeries(series);
    this.seriesControllers.delete(series.id);
  }
  private stopSeries(id: string, phase: 'cancelled' | 'failed', error?: string) {
    const series = this.store.getSeries(id);
    if (!series || series.phase !== 'running') return;
    this.unschedule(id);
    this.seriesControllers.get(id)?.abort();
    this.seriesControllers.delete(id);
    series.phase = phase;
    delete series.nextStartAt;
    if (error) series.error = error;
    this.persistSeries(series);
  }
  cancelSeries(id: string) {
    const series = this.store.getSeries(id);
    if (!series) throw new Error('Maratona de reuniões não encontrada.');
    const current = series.runIds.at(-1);
    this.stopSeries(id, 'cancelled');
    if (current) this.cancel(current);
    return this.store.getSeries(id)!;
  }
  close() {
    this.brava.close();
    for (const id of this.seriesControllers.keys()) this.stopSeries(id, 'cancelled');
    for (const id of this.controllers.keys()) this.cancel(id);
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }
}
function safeError(error: unknown) {
  return error instanceof Error
    ? error.name === 'ZodError'
      ? 'A resposta do CLI não corresponde ao formato esperado.'
      : error.message
    : 'Falha inesperada na execução.';
}
