import { randomUUID } from 'node:crypto';
import type { Brava, BravaKind, BravaView, Participant, Provider, Run } from '../../shared/types';
import { providers } from '../../shared/types';
import { buildBravaReport, compact } from '../../shared/brava-report';
import { config, tariff } from '../config';
import { evaluate } from '../providers';
import { callClaude, CliFailure } from '../claude';
import {
  batteryCommentPrompt,
  bravaAnalysisPrompt,
  bravaIntroPrompt,
  bravaIntroSchema,
  blindMapping,
  feedbackSchema,
  seriesAnalysisSchema,
} from '../judging';
import { asRequest, buildCatalog, demoAnswer } from './catalog';
import { buildVisualCatalog, imageDataUrl, imageFiles, visualProviders } from '../visual/catalog';
import type { Engine } from '../engine';

const finished = (phase: Brava['phase']) => ['complete', 'cancelled', 'failed'].includes(phase);
// Writes and screen updates are spaced out: hundreds of answers arrive in a few minutes.
const SAVE_EVERY_MS = 1000;
const EMIT_EVERY_MS = 350;

export function view(brava: Brava): BravaView {
  return {
    ...brava,
    results: Object.fromEntries(
      Object.entries(brava.results).map(([id, byProvider]) => {
        const q = brava.items.find((i) => i.id === id)!.question;
        return [
          id,
          Object.fromEntries(Object.entries(byProvider).map(([p, r]) => [p, compact(q, r!)])),
        ];
      }),
    ),
  };
}

export class BravaRunner {
  private controllers = new Map<string, AbortController>();
  // The object being filled in by a running brava; cancel must keep its latest answers.
  private live = new Map<string, Brava>();
  private saved = new Map<string, number>();
  private emitted = new Map<string, number>();
  private pending = new Map<string, NodeJS.Timeout>();
  constructor(private engine: Engine) {}

  private persist(brava: Brava, force = false) {
    const now = Date.now();
    if (force || now - (this.saved.get(brava.id) ?? 0) >= SAVE_EVERY_MS) {
      this.engine.store.saveBrava(brava);
      this.saved.set(brava.id, now);
    }
    clearTimeout(this.pending.get(brava.id));
    const emit = () => {
      this.pending.delete(brava.id);
      this.emitted.set(brava.id, Date.now());
      this.engine.events.emit(`brava:${brava.id}`, view(brava));
    };
    const wait = EMIT_EVERY_MS - (now - (this.emitted.get(brava.id) ?? 0));
    if (force || wait <= 0) emit();
    else this.pending.set(brava.id, setTimeout(emit, wait));
  }

  async start(mode: Run['mode'], kind: BravaKind = 'brava'): Promise<Brava> {
    const name = kind === 'visual' ? 'a rodada das imagens' : 'a Resiliência';
    if (this.engine.store.hasActive())
      throw new Error(`Conclua ou encerre a execução ativa antes de iniciar ${name}.`);
    const participants = kind === 'visual' ? visualProviders : providers;
    let catalog;
    if (kind === 'visual') {
      const visual = buildVisualCatalog(config.DATA_DIR);
      if (mode === 'live' && visual.missing)
        throw new Error(
          `Faltam ${visual.missing} fotos do CV-Bench. Rode npm run imagens e tente de novo.`,
        );
      catalog = { ...visual, skipped: [] };
    } else catalog = buildCatalog(config.DATA_DIR);
    if (mode === 'live') {
      await this.engine.preflight('live', participants);
      if (catalog.skipped.length)
        throw new Error(
          'A bateria de português real precisa da amostra dos datasets. Rode npm run datasets e tente de novo.',
        );
    }
    if (this.engine.store.hasActive()) throw new Error('Já existe uma execução ativa.');
    const brava: Brava = {
      id: randomUUID(),
      kind,
      mode,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      phase: 'preparing',
      providers: [...participants],
      catalogHash: catalog.hash,
      batteries: catalog.batteries,
      items: catalog.items,
      results: {},
      currentBattery: 0,
      comments: {},
      ...(catalog.skipped.length ? { skipped: catalog.skipped } : {}),
      cliCalls: [],
      tariff,
    };
    const controller = new AbortController();
    this.controllers.set(brava.id, controller);
    this.live.set(brava.id, brava);
    this.persist(brava, true);
    void this.run(brava, controller.signal);
    return brava;
  }

  private sleep(brava: Brava, ms: number, signal: AbortSignal) {
    brava.nextAt = new Date(Date.now() + ms).toISOString();
    this.persist(brava, true);
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        delete brava.nextAt;
        resolve();
      }, ms);
      signal.addEventListener(
        'abort',
        () => {
          clearTimeout(timer);
          reject(signal.reason);
        },
        { once: true },
      );
    });
  }

  private async opus<T>(
    brava: Brava,
    role: 'moderator' | 'commentator' | 'judge',
    prompt: string,
    schema: Parameters<typeof callClaude<T>>[2],
    signal: AbortSignal,
  ): Promise<T> {
    try {
      const { value, call } = await callClaude(role, prompt, schema, signal);
      brava.cliCalls.push(call);
      return value;
    } catch (e) {
      if (e instanceof CliFailure) brava.cliCalls.push(e.call);
      throw e;
    }
  }

  private async run(brava: Brava, signal: AbortSignal) {
    const live = brava.mode === 'live';
    const visual = brava.kind === 'visual';
    const pace = live ? 0 : Math.min(60, config.AUTOPLAY_DELAY_MS / 50);
    const photos = visual ? imageFiles(config.DATA_DIR) : new Map<string, string>();
    try {
      brava.introduction = live
        ? (await this.opus(brava, 'moderator', bravaIntroPrompt(brava), bravaIntroSchema, signal))
            .introduction
        : `Ensaio da ${visual ? 'rodada das imagens' : 'Resiliência'}: respostas sintéticas, sem chamadas de IA, só para conferir a tela.`;
      await this.sleep(brava, config.AUTOPLAY_DELAY_MS, signal);
      for (const [index, battery] of brava.batteries.entries()) {
        brava.currentBattery = index;
        brava.phase = 'running';
        this.persist(brava, true);
        const tasks = battery.itemIds.flatMap((id) => brava.providers.map((p) => ({ id, p })));
        // A small pool per provider keeps every API under a modest, equal request rate.
        await Promise.all(
          brava.providers.map(async (p) => {
            const mine = tasks.filter((t) => t.p === p);
            const workers = Array.from({ length: config.BRAVA_CONCURRENCY }, async () => {
              for (let t = mine.shift(); t; t = mine.shift()) {
                const item = brava.items.find((i) => i.id === t.id)!;
                const { scenario, round } = asRequest(item);
                // Each photo is read when its question is sent, not kept in memory for the round.
                const result = live
                  ? await evaluate(
                      t.p,
                      scenario,
                      round,
                      signal,
                      fetch,
                      item.image ? [imageDataUrl(photos.get(item.image.file)!)] : [],
                    )
                  : demoAnswer(t.p, item);
                if (pace) await new Promise((r) => setTimeout(r, pace));
                signal.throwIfAborted();
                (brava.results[item.id] ??= {})[t.p] = result;
                this.persist(brava);
              }
            });
            await Promise.all(workers);
          }),
        );
        signal.throwIfAborted();
        brava.phase = 'commenting';
        this.persist(brava, true);
        const partial = buildBravaReport(
          {
            mode: brava.mode,
            batteries: [battery],
            items: brava.items.filter((i) => i.battery === battery.id),
            results: brava.results,
          },
          brava.providers,
        );
        const scores = partial.batteries[0].scores;
        if (live) {
          const mapping = blindMapping(brava.providers);
          const blind = Object.fromEntries(
            (['A', 'B', 'C'] as Participant[])
              .filter((l) => mapping[l])
              .map((l) => [l, Number(scores[mapping[l]!].toFixed(3))]),
          ) as Record<Participant, number>;
          try {
            const value = await this.opus(
              brava,
              'commentator',
              batteryCommentPrompt(brava, battery, mapping, blind),
              feedbackSchema,
              signal,
            );
            brava.comments[battery.id] = { text: value.text, mapping };
          } catch (e) {
            if (signal.aborted) throw e;
            brava.comments[battery.id] = {
              text: 'O comentário do Opus não ficou disponível. As notas objetivas foram preservadas.',
              error: e instanceof Error ? e.message : 'Falha no CLI.',
            };
          }
        } else
          brava.comments[battery.id] = {
            text: `Comentário sintético da bateria ${battery.title}. Isso demonstra o painel, não mede os modelos.`,
          };
        brava.phase = 'pause';
        await this.sleep(brava, config.AUTOPLAY_DELAY_MS, signal);
      }
      brava.phase = 'reporting';
      this.persist(brava, true);
      const series = visual ? undefined : this.engine.store.latestSeries(brava.mode);
      const round1 = series?.report && {
        seriesId: series.id,
        decisions: series.report.decisions,
        accuracy: Object.fromEntries(
          series.report.standings.map((s) => [s.provider, s.correct / s.total]),
        ) as Record<Provider, number>,
      };
      brava.report = buildBravaReport(brava, brava.providers, round1 || undefined);
      if (live) {
        const mapping = blindMapping(brava.providers);
        try {
          const value = await this.opus(
            brava,
            'judge',
            bravaAnalysisPrompt(brava, brava.report, mapping),
            seriesAnalysisSchema,
            signal,
          );
          const known = new Set(brava.items.map((i) => i.id));
          if (value.evidence.some((e) => !known.has(e.roundId)))
            throw new Error('O Opus citou um item inexistente.');
          brava.analysis = { mapping, ...value };
        } catch (e) {
          if (signal.aborted) throw e;
          brava.analysisError = `A leitura final do Opus não ficou disponível: ${e instanceof Error ? e.message : 'falha no CLI'}`;
        }
      }
      brava.phase = 'complete';
      this.persist(brava, true);
    } catch (e) {
      if (signal.aborted) return;
      brava.phase = 'failed';
      delete brava.nextAt;
      brava.error =
        e instanceof Error
          ? e.message
          : `Falha inesperada na ${visual ? 'rodada das imagens' : 'Resiliência'}.`;
      this.persist(brava, true);
    } finally {
      if (!signal.aborted) {
        this.controllers.delete(brava.id);
        this.live.delete(brava.id);
      }
    }
  }

  get(id: string) {
    return this.live.get(id) ?? this.engine.store.getBrava(id);
  }
  cancel(id: string) {
    const brava = this.live.get(id) ?? this.engine.store.getBrava(id);
    if (!brava) throw new Error('Resiliência não encontrada.');
    if (finished(brava.phase)) return brava;
    this.controllers.get(id)?.abort();
    this.controllers.delete(id);
    this.live.delete(id);
    clearTimeout(this.pending.get(id));
    brava.phase = 'cancelled';
    delete brava.nextAt;
    this.persist(brava, true);
    return brava;
  }

  close() {
    for (const id of this.controllers.keys()) this.cancel(id);
    for (const timer of this.pending.values()) clearTimeout(timer);
  }
}
