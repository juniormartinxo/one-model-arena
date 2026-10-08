import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  ArrowRight,
  AudioLines,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Columns2,
  Download,
  History,
  LoaderCircle,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Square,
  Trophy,
  Trash2,
  TriangleAlert,
  X,
} from 'lucide-react';
import type {
  Health,
  Provider,
  Run,
  RunSummary,
  Scenario,
  Series,
  SeriesSnapshot,
  SeriesSummary,
} from '../shared/types';
import { isProvider, providers, runProviders } from '../shared/types';
import { metrics } from '../shared/scoring';
import { api } from './api';
import { Competitor, names, money } from './Competitor';
import { FinalVerdict, VerdictDialog } from './FinalResult';
import { HistorySummary } from './HistorySummary';
import { SeriesProgress } from './Autopilot';
import { SeriesReportDialog, SeriesReportView } from './SeriesReport';
import { revealParticipants } from '../shared/presentation';
const terminal = (run: Pick<Run, 'phase'>) =>
  ['complete', 'failed', 'cancelled'].includes(run.phase);
const phaseNames: Record<Run['phase'], string> = {
  preparing: 'Opus prepara a reunião',
  ready: 'Pronto para a próxima rodada',
  evaluating: 'Os participantes estão decidindo',
  commenting: 'Opus está comentando a rodada',
  judging: 'Opus está fazendo os julgamentos finais',
  complete: 'Reunião concluída',
  cancelled: 'Reunião encerrada',
  failed: 'Execução interrompida',
};
const winnerName = (winner: string) =>
  winner === 'tie'
    ? 'Empate'
    : winner === 'inconclusive'
      ? 'Inconclusivo'
      : names[winner as Provider];
export function App() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]),
    [health, setHealth] = useState<Health | null>(null),
    [history, setHistory] = useState<RunSummary[]>([]);
  const [scenarioId, setScenarioId] = useState('loja'),
    [view, setView] = useState<'arena' | 'history' | 'method' | 'settings'>('arena');
  const [run, setRun] = useState<Run | null>(null),
    [cursor, setCursor] = useState(0),
    [replay, setReplay] = useState(false),
    [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [connected, setConnected] = useState(true),
    [recording, setRecording] = useState(false);
  const [verdictOpen, setVerdictOpen] = useState(false);
  const [series, setSeries] = useState<Series | null>(null),
    [seriesHistory, setSeriesHistory] = useState<SeriesSummary[]>([]),
    [reportOpen, setReportOpen] = useState(false);
  const seriesRunning = series?.phase === 'running';
  const historyRequest = useRef(0);
  const refreshHistory = useCallback(async () => {
    const request = ++historyRequest.current;
    const [items, marathons] = await Promise.all([
      api<RunSummary[]>('/runs'),
      api<SeriesSummary[]>('/series'),
    ]);
    if (request === historyRequest.current) {
      setHistory(items);
      setSeriesHistory(marathons);
    }
  }, []);
  const presentedResults = useRef(new Set<string>());
  const closeVerdict = useCallback(() => setVerdictOpen(false), []);
  useEffect(() => {
    if (
      run?.phase === 'complete' &&
      run.verdict &&
      !replay &&
      !presentedResults.current.has(run.id)
    ) {
      presentedResults.current.add(run.id);
      setPlaying(false);
      setVerdictOpen(true);
    }
  }, [run?.id, run?.phase, replay]);
  const refresh = useCallback(async () => {
    await Promise.all([
      api<Scenario[]>('/scenarios').then(setScenarios),
      api<Health>('/health').then(setHealth),
      refreshHistory(),
    ]);
  }, [refreshHistory]);
  const showSeries = useCallback((snapshot: SeriesSnapshot) => {
    setSeries(snapshot.series);
    setRun(snapshot.run);
    setCursor(Math.max(0, (snapshot.run?.rounds.length ?? 1) - 1));
    setReplay(snapshot.series.phase !== 'running');
    if (snapshot.run) setScenarioId(snapshot.run.scenario.id);
  }, []);
  useEffect(() => {
    void refresh().catch((e) => setError(e.message));
    const seriesId = sessionStorage.getItem('series');
    if (seriesId) {
      void api<SeriesSnapshot>(`/series/${seriesId}`)
        .then((snapshot) => {
          // A reload must not replay the presentations already shown.
          presentedResults.current.add(snapshot.series.id);
          if (snapshot.run) presentedResults.current.add(snapshot.run.id);
          showSeries(snapshot);
        })
        .catch(() => sessionStorage.removeItem('series'));
      return;
    }
    const id = sessionStorage.getItem('meeting');
    if (id)
      void api<Run>(`/runs/${id}`)
        .then((r) => {
          setRun(r);
          setScenarioId(r.scenario.id);
          setCursor(Math.max(0, r.rounds.length - 1));
          setReplay(terminal(r));
        })
        .catch(() => sessionStorage.removeItem('meeting'));
  }, [refresh, showSeries]);
  useEffect(() => {
    if (!series || series.phase !== 'running') return;
    const source = new EventSource(`/api/series/${series.id}/events`);
    source.onopen = () => setConnected(true);
    source.onmessage = (e) => {
      const snapshot: SeriesSnapshot = JSON.parse(e.data);
      setSeries(snapshot.series);
      setRun(snapshot.run);
      setCursor(Math.max(0, (snapshot.run?.rounds.length ?? 1) - 1));
      setReplay(false);
      setConnected(true);
    };
    source.onerror = () => setConnected(false);
    return () => source.close();
  }, [series?.id, series?.phase]);
  // The next meeting replaces the previous result on screen.
  useEffect(() => {
    if (seriesRunning) setVerdictOpen(false);
  }, [run?.id, seriesRunning]);
  useEffect(() => {
    if (series?.phase === 'complete' && !presentedResults.current.has(series.id)) {
      presentedResults.current.add(series.id);
      setVerdictOpen(false);
      setReportOpen(true);
    }
    if (series && series.phase !== 'running') void refreshHistory().catch(() => {});
  }, [series?.id, series?.phase, refreshHistory]);
  // In automatic meetings the page follows the action: question, answers, then commentary.
  useEffect(() => {
    if (!run?.autoplay || replay || !seriesRunning) return;
    const target =
      run.phase === 'evaluating'
        ? '.question-section'
        : run.phase === 'commenting'
          ? '.competition-grid'
          : run.phase === 'ready' && run.rounds.length
            ? '.opus-panel'
            : null;
    if (target)
      document.querySelector(target)?.scrollIntoView({
        behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: target === '.question-section' ? 'start' : 'center',
      });
  }, [run?.id, run?.phase, run?.rounds.length, replay, seriesRunning]);
  useEffect(() => {
    if (!run || terminal(run) || replay || seriesRunning) return;
    const source = new EventSource(`/api/runs/${run.id}/events`);
    source.onopen = () => setConnected(true);
    source.onmessage = (e) => {
      const updated: Run = JSON.parse(e.data);
      setRun(updated);
      setCursor(Math.max(0, updated.rounds.length - 1));
      setConnected(true);
    };
    source.onerror = () => setConnected(false);
    return () => source.close();
  }, [run?.id, run?.phase, replay, seriesRunning]);
  useEffect(() => {
    if (run && terminal(run)) void refreshHistory().catch(() => {});
  }, [run?.phase, refreshHistory]);
  useEffect(() => {
    if (view === 'history') void refreshHistory().catch((e) => setError(e.message));
  }, [view, refreshHistory]);
  useEffect(() => {
    if (!playing || !run) return;
    const timer = setInterval(
      () =>
        setCursor((c) => {
          if (c >= run.rounds.length - 1) {
            setPlaying(false);
            return c;
          }
          return c + 1;
        }),
      5000,
    );
    return () => clearInterval(timer);
  }, [playing, run]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector('dialog[open]')) setRecording(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  async function act(task: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await task();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível concluir a ação.');
    } finally {
      setBusy(false);
    }
  }
  function start(mode: Run['mode']) {
    setVerdictOpen(false);
    void act(async () => {
      const value = await api<Run>('/runs', { scenarioId, mode });
      setRun(value);
      sessionStorage.setItem('meeting', value.id);
      setCursor(0);
      setReplay(false);
      setPlaying(false);
      setView('arena');
    });
  }
  function startSeries(mode: Run['mode']) {
    setVerdictOpen(false);
    setReportOpen(false);
    void act(async () => {
      const snapshot = await api<SeriesSnapshot>('/series', { mode });
      sessionStorage.removeItem('meeting');
      sessionStorage.setItem('series', snapshot.series.id);
      showSeries(snapshot);
      setPlaying(false);
      setView('arena');
      setRecording(true);
    });
  }
  function cancelSeries() {
    if (series)
      void act(async () => {
        showSeries(await api<SeriesSnapshot>(`/series/${series.id}/cancel`, {}));
      });
  }
  function openSeries(id: string) {
    setVerdictOpen(false);
    void act(async () => {
      const snapshot = await api<SeriesSnapshot>(`/series/${id}`);
      sessionStorage.removeItem('meeting');
      sessionStorage.setItem('series', id);
      presentedResults.current.add(id);
      if (snapshot.run) presentedResults.current.add(snapshot.run.id);
      showSeries(snapshot);
      setPlaying(false);
      setView('arena');
      setReportOpen(snapshot.series.phase === 'complete');
    });
  }
  function deleteSeries(item: SeriesSummary) {
    if (
      !window.confirm(
        'Excluir esta maratona, suas seis reuniões e todos os registros? Esta ação não pode ser desfeita.',
      )
    )
      return;
    void act(async () => {
      await api(`/series/${item.id}`, undefined, 'DELETE');
      if (series?.id === item.id) clearRun();
      await refreshHistory();
    });
  }
  function advance() {
    if (run)
      void act(async () => {
        setRun(await api<Run>(`/runs/${run.id}/advance`, {}));
      });
  }
  function cancel() {
    if (run?.seriesId) return cancelSeries();
    if (run)
      void act(async () => {
        setRun(await api<Run>(`/runs/${run.id}/cancel`, {}));
      });
  }
  function openRun(id: string) {
    setVerdictOpen(false);
    setReportOpen(false);
    void act(async () => {
      const value = await api<Run>(`/runs/${id}`);
      setRun(value);
      presentedResults.current.add(id);
      // A meeting opened from its marathon keeps the marathon context on screen.
      if (!value.seriesId || value.seriesId !== series?.id) {
        setSeries(null);
        sessionStorage.removeItem('series');
        sessionStorage.setItem('meeting', id);
      }
      setScenarioId(value.scenario.id);
      setReplay(terminal(value));
      setCursor(0);
      setPlaying(false);
      setView('arena');
    });
  }
  function clearRun() {
    setVerdictOpen(false);
    setReportOpen(false);
    setSeries(null);
    sessionStorage.removeItem('series');
    setRun(null);
    setReplay(false);
    setPlaying(false);
    setCursor(0);
    sessionStorage.removeItem('meeting');
  }
  function deleteHistory(item?: RunSummary) {
    const message = item
      ? `Excluir “${item.title}” e todos os seus registros? Esta ação não pode ser desfeita.`
      : 'Apagar todas as reuniões finalizadas e seus registros? Reuniões em andamento serão preservadas. Esta ação não pode ser desfeita.';
    if (!window.confirm(message)) return;
    void act(async () => {
      await api(item ? `/runs/${item.id}` : '/runs', undefined, 'DELETE');
      if (run && (item ? run.id === item.id : terminal(run))) clearRun();
      await refreshHistory();
    });
  }
  const scenario = run?.scenario ?? scenarios.find((s) => s.id === scenarioId);
  const round = scenario?.rounds[cursor];
  const result = run?.rounds[cursor];
  const visibleRun = run && replay ? { ...run, rounds: run.rounds.slice(0, cursor + 1) } : run;
  const active = !!run && !terminal(run);
  const waiting = run && ['preparing', 'evaluating', 'commenting', 'judging'].includes(run.phase);
  const latest = run ? cursor >= run.rounds.length - 1 : true;
  const roundWinner = result?.feedback?.winner;
  const hasActiveHistory =
    history.some((r) => !['complete', 'failed', 'cancelled'].includes(r.phase)) ||
    seriesHistory.some((s) => s.phase === 'running') ||
    !!seriesRunning;
  const meetings = series
    ? series.runIds.map((id, i) => ({
        id,
        title: scenarios.find((s) => s.id === series.scenarioIds[i])?.title ?? id,
      }))
    : [];
  const finalVisible = run?.phase === 'complete' && (!replay || cursor === run.rounds.length - 1);
  const participants = run ? runProviders(run) : providers;
  return (
    <div className={`app ${recording ? 'recording' : ''}`}>
      {run?.phase === 'complete' && run.verdict && (
        <VerdictDialog
          run={run}
          open={verdictOpen && view === 'arena'}
          replay={replay}
          onDismiss={closeVerdict}
          nextAt={seriesRunning ? series?.nextStartAt : undefined}
        />
      )}
      {series?.report && (
        <SeriesReportDialog
          series={series}
          meetings={meetings}
          open={reportOpen && view === 'arena'}
          onDismiss={() => setReportOpen(false)}
        />
      )}
      <header className="site-header">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setView('arena');
          }}
        >
          <Columns2 size={24} />
          <span>
            Mesa de decisão<span className="brand-dot">.</span>
          </span>
        </a>
        <nav aria-label="Navegação principal">
          {(
            [
              { key: 'arena', label: 'Arena', Icon: Radio },
              { key: 'history', label: 'Histórico', Icon: History },
              { key: 'method', label: 'Método', Icon: BookOpen },
              { key: 'settings', label: 'Conexões', Icon: Settings2 },
            ] as const
          ).map((item) => (
            <button
              key={item.key}
              className={view === item.key ? 'nav-link active' : 'nav-link'}
              onClick={() => setView(item.key)}
            >
              <item.Icon size={16} />
              {item.label}
            </button>
          ))}
        </nav>
        <span className="local-label">
          <span className="status-dot" />
          Estúdio local
        </span>
      </header>
      <main>
        {error && (
          <div className="notice error" role="alert">
            <TriangleAlert size={18} />
            <span>{error}</span>
            <button aria-label="Fechar aviso" onClick={() => setError('')}>
              <X size={17} />
            </button>
          </div>
        )}
        {!connected && active && (
          <div className="notice" role="status">
            Reconectando ao servidor. Não inicie outra rodada até a conexão voltar.
          </div>
        )}
        {view === 'arena' && (
          <>
            <div className="arena-heading">
              <div>
                <h1>
                  {participants.map((p, i) => (
                    <span key={p}>
                      {i > 0 && <span className="versus"> × </span>}
                      {names[p]}
                    </span>
                  ))}
                </h1>
                <p>
                  {participants.length === 3 ? 'Três' : 'Duas'} decisões. Os mesmos fatos. Opus na
                  análise.
                </p>
              </div>
              <button
                className="quiet-button recording-toggle"
                onClick={() => setRecording(!recording)}
              >
                {recording ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                <span>{recording ? 'Sair da gravação' : 'Modo gravação'}</span>
              </button>
            </div>
            {series && (
              <SeriesProgress
                series={series}
                run={run}
                scenarios={scenarios}
                busy={busy}
                onCancel={cancelSeries}
              />
            )}
            <div className="session-bar">
              <div className={`session-mode ${run?.mode ?? 'standby'}`}>
                <span className="status-dot" />
                {run
                  ? run.mode === 'demo'
                    ? 'ENSAIO SINTÉTICO'
                    : 'EXECUÇÃO REAL'
                  : 'PRONTO PARA COMEÇAR'}
                {replay && <span className="replay-label">REPLAY</span>}
              </div>
              <span className="session-scenario">{scenario?.title ?? 'Carregando cenários…'}</span>
              <span className="round-count">
                {run
                  ? `Rodada ${cursor + 1} de ${scenario?.rounds.length}`
                  : '6 rodadas · português'}
              </span>
            </div>
            {run?.mode === 'demo' && (
              <p className="demo-disclosure">
                Respostas e comentários simulados. Nenhuma IA foi chamada e estes pontos não medem
                os modelos.
              </p>
            )}
            {!run && (
              <section className="marathon-setup">
                <div>
                  <span className="marathon-kicker">Piloto automático</span>
                  <h2>Maratona: 6 reuniões, 36 decisões por modelo</h2>
                  <p>
                    Os seis cenários rodam em sequência, sem cliques, com o Opus comentando cada
                    rodada. No fim, um boletim com acertos, calibração, custo e velocidade.
                  </p>
                </div>
                <div className="setup-actions">
                  <button
                    className="primary-button"
                    disabled={busy || !health?.ready || hasActiveHistory}
                    onClick={() => startSeries('live')}
                  >
                    <Radio size={17} />
                    Iniciar maratona real
                  </button>
                  <button
                    className="secondary-button"
                    disabled={busy || !scenarios.length || hasActiveHistory}
                    onClick={() => startSeries('demo')}
                  >
                    <Play size={16} />
                    Ensaio da maratona
                  </button>
                </div>
              </section>
            )}
            {!run && (
              <section className="setup">
                <div>
                  <label htmlFor="scenario">Reunião avulsa, rodada a rodada</label>
                  <select
                    id="scenario"
                    value={scenarioId}
                    onChange={(e) => setScenarioId(e.target.value)}
                  >
                    {scenarios.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title}
                      </option>
                    ))}
                  </select>
                  <p>{scenario?.description}</p>
                </div>
                <div className="setup-actions">
                  <button
                    className="primary-button"
                    disabled={busy || !health?.ready || hasActiveHistory}
                    onClick={() => start('live')}
                  >
                    <Radio size={17} />
                    Iniciar reunião real
                  </button>
                  <button
                    className="secondary-button"
                    disabled={busy || !scenario || hasActiveHistory}
                    onClick={() => start('demo')}
                  >
                    <Play size={16} />
                    Iniciar ensaio
                  </button>
                </div>
                <p className="setup-hint">
                  {hasActiveHistory ? (
                    <>
                      <button className="text-button" onClick={() => setView('history')}>
                        Retome a reunião ativa pelo histórico.
                      </button>
                    </>
                  ) : health?.ready ? (
                    'Execução real usa Jev, Decisions, Clef e seu Claude CLI. Avance uma rodada de cada vez.'
                  ) : (
                    <>
                      O ensaio funciona sem chaves.{' '}
                      <button className="text-button" onClick={() => setView('settings')}>
                        Configurar as conexões
                      </button>{' '}
                      para usar os modelos reais.
                    </>
                  )}
                </p>
              </section>
            )}
            {round && (
              <>
                <section className="question-section">
                  <div className="question-meta">
                    <span>
                      {run
                        ? `${String(cursor + 1).padStart(2, '0')} / ${String(scenario!.rounds.length).padStart(2, '0')}`
                        : 'PRÉVIA DA PRIMEIRA RODADA'}
                    </span>
                    <span>{round.title}</span>
                    <span className="question-type">
                      {round.question.type === 'choice'
                        ? 'Escolha'
                        : round.question.type === 'score'
                          ? 'Escala'
                          : 'Probabilidade'}
                    </span>
                  </div>
                  <h2>{round.question.text}</h2>
                  <p className="facts">{round.facts}</p>
                  {run?.narration && (
                    <p className="moderator-transition">
                      <AudioLines size={15} />
                      <span>{run.narration.rounds[cursor]?.transition}</span>
                    </p>
                  )}
                  <details className="context-detail">
                    <summary>Contexto e critérios da decisão</summary>
                    <p>{scenario!.context}</p>
                    {round.question.options?.map((o) => (
                      <p key={o.value}>
                        <strong>{o.label}:</strong> {o.description}
                      </p>
                    ))}
                    {round.question.levels?.map((l, i) => (
                      <p key={l.label}>
                        <strong>
                          {i} · {l.label}:
                        </strong>{' '}
                        {l.description}
                      </p>
                    ))}
                    {round.question.type === 'predicate' && (
                      <p>Sim a partir de 80%; não até 20%; entre esses limites, revisão humana.</p>
                    )}
                  </details>
                </section>
                <div
                  className={`competition-grid ${participants.length > 2 ? 'stack-narrow' : ''}`}
                  style={{ '--competitors': participants.length } as CSSProperties}
                >
                  {participants.map((p) => (
                    <Competitor
                      key={p}
                      provider={p}
                      run={visibleRun}
                      result={result?.results[p]}
                      question={round.question}
                      pending={run?.phase === 'evaluating' && latest}
                    />
                  ))}
                  {participants.length === 2 && (
                    <div className="center-vs" aria-hidden="true">
                      VS
                    </div>
                  )}
                </div>
                <section
                  className={`opus-panel ${result?.feedback ? 'has-feedback' : ''}`}
                  aria-label="Comentário do Opus"
                >
                  <div className="opus-heading">
                    <span className="opus-symbol">
                      <AudioLines size={21} />
                    </span>
                    <div>
                      <h2>{run?.mode === 'demo' ? 'Comentário de exemplo' : 'Opus 5.5'}</h2>
                      <span>
                        {run?.mode === 'demo'
                          ? 'Roteiro local · sem IA'
                          : 'Avaliador cego · via Claude CLI'}
                      </span>
                    </div>
                    {roundWinner && (
                      <span className={`round-verdict ${roundWinner}`}>
                        <Trophy size={14} />
                        {isProvider(roundWinner)
                          ? `Rodada para ${names[roundWinner]}`
                          : winnerName(roundWinner)}
                      </span>
                    )}
                  </div>
                  <div className="opus-copy" aria-live="polite">
                    {result?.feedback ? (
                      <>
                        <p>{revealParticipants(result.feedback.text, result.feedback.mapping)}</p>
                        {result.feedback.mapping && (
                          <small>Os nomes foram revelados após a avaliação cega do Opus.</small>
                        )}
                        {result.feedback.error && (
                          <p className="error-copy">{result.feedback.error}</p>
                        )}
                      </>
                    ) : run?.phase === 'commenting' && latest ? (
                      <p className="working">
                        <LoaderCircle size={17} className="spin" />O Opus está comparando as
                        decisões, sem ver as marcas…
                      </p>
                    ) : (
                      <p>
                        {run?.narration && run.rounds.length === 0
                          ? run.narration.introduction
                          : 'Depois de cada rodada, o Opus explica os acertos, as divergências e quem contribuiu mais para a decisão.'}
                      </p>
                    )}
                  </div>
                  <div className="opus-footnote">
                    <ShieldCheck size={13} />
                    Os pontos seguem o gabarito. O comentário é uma avaliação separada.
                  </div>
                </section>
                {result && participants.every((p) => result.results[p]) && (
                  <details className="reference-detail">
                    <summary>Conferir o gabarito e a pontuação desta rodada</summary>
                    <p>{round.question.rationale}</p>
                    <p>
                      Escolha exata: +1. Probabilidade: +1 ao acertar com ≥80% para sim ou ≤20% para
                      não; faixa intermediária é revisão. Escala: +1 se a distância do nível
                      esperado for ≤0,4. Demais casos: 0. Indisponibilidade não é erro semântico.
                    </p>
                  </details>
                )}
              </>
            )}
            {run && (
              <div className="run-controls">
                <div className="timeline" aria-label="Rodadas">
                  {run.scenario.rounds.map((r, i) => (
                    <button
                      key={r.id}
                      aria-label={`Ver rodada ${i + 1}: ${r.title}`}
                      aria-current={cursor === i ? 'step' : undefined}
                      className={`${i === cursor ? 'selected' : ''} ${run.rounds[i]?.feedback ? 'done' : ''}`}
                      disabled={i >= run.rounds.length && i !== 0}
                      onClick={() => {
                        setCursor(i);
                        setPlaying(false);
                      }}
                    >
                      {run.rounds[i]?.feedback ? <Check size={13} /> : i + 1}
                    </button>
                  ))}
                </div>
                <div className="control-actions">
                  {replay ? (
                    <>
                      <button
                        className="icon-button"
                        aria-label="Rodada anterior"
                        disabled={cursor === 0}
                        onClick={() => {
                          setCursor(cursor - 1);
                          setPlaying(false);
                        }}
                      >
                        <ChevronLeft size={18} />
                      </button>
                      <button
                        className="secondary-button"
                        onClick={() => {
                          if (cursor === run.rounds.length - 1) setCursor(0);
                          setPlaying(!playing);
                        }}
                      >
                        {playing ? <Pause size={15} /> : <Play size={15} />}{' '}
                        {playing ? 'Pausar replay' : 'Reproduzir'}
                      </button>
                      <button
                        className="icon-button"
                        aria-label="Próxima rodada do replay"
                        disabled={cursor >= run.rounds.length - 1}
                        onClick={() => {
                          setCursor(cursor + 1);
                          setPlaying(false);
                        }}
                      >
                        <ChevronRight size={18} />
                      </button>
                    </>
                  ) : active && run.autoplay ? (
                    <span className="autopilot-label">
                      <span className="status-dot" />
                      Piloto automático
                    </span>
                  ) : active ? (
                    <>
                      <button className="quiet-button" disabled={busy} onClick={cancel}>
                        <Square size={13} />
                        Encerrar
                      </button>
                      <button
                        className="primary-button"
                        disabled={busy || waiting || !connected}
                        onClick={advance}
                      >
                        {waiting ? (
                          <LoaderCircle size={17} className="spin" />
                        ) : (
                          <ArrowRight size={17} />
                        )}{' '}
                        {run.phase === 'ready'
                          ? run.rounds.length === 0
                            ? 'Começar primeira rodada'
                            : 'Próxima rodada'
                          : phaseNames[run.phase]}
                      </button>
                    </>
                  ) : (
                    <button
                      className="secondary-button"
                      onClick={() => {
                        setReplay(true);
                        setCursor(0);
                      }}
                      disabled={run.rounds.length === 0}
                    >
                      <RotateCcw size={16} />
                      Rever reunião
                    </button>
                  )}
                </div>
              </div>
            )}
            {run?.phase === 'cancelled' && (
              <div className="notice" role="status">
                Reunião encerrada. As respostas recebidas foram preservadas; a comparação ficou
                incompleta.
              </div>
            )}
            {run?.error && (
              <div className="notice error" role="alert">
                {run.error}
              </div>
            )}
            {finalVisible && run.verdict && (
              <FinalVerdict run={run} onReveal={() => setVerdictOpen(true)} />
            )}
            {series?.report && series.phase === 'complete' && (
              <section className="report-inline" aria-label="Boletim da maratona">
                <div className="final-heading-row">
                  <h2>Boletim da maratona</h2>
                  <button className="primary-button" onClick={() => setReportOpen(true)}>
                    <Maximize2 size={16} />
                    Ver boletim
                  </button>
                </div>
                <SeriesReportView series={series} meetings={meetings} onOpenMeeting={openRun} />
              </section>
            )}
            {run && terminal(run) && (
              <div className="end-actions">
                <a className="secondary-button" href={`/api/runs/${run.id}/export`} download>
                  <Download size={16} />
                  Exportar evidências
                </a>
                {series && series.phase !== 'running' && (
                  <a className="secondary-button" href={`/api/series/${series.id}/export`} download>
                    <Download size={16} />
                    Exportar maratona
                  </a>
                )}
                <button className="primary-button" onClick={clearRun}>
                  Nova reunião
                  <ArrowRight size={16} />
                </button>
              </div>
            )}
            {visibleRun && (
              <div className="measurement-note">
                {participants.map((p) => {
                  const m = metrics(visibleRun, p);
                  return (
                    <span key={p}>
                      <strong>{names[p]}:</strong> {m.correct} acertos · {m.incorrect} divergências
                      · {m.uncertain} revisões · {m.unavailable} indisponíveis
                    </span>
                  );
                })}
                <span>
                  {run?.mode === 'demo'
                    ? 'Latência e custo de inferência não são medidos no ensaio.'
                    : 'Tempo de resposta inclui rede. Custo das APIs estimado pelos tokens reportados; “?” indica consumo desconhecido.'}
                </span>
              </div>
            )}
          </>
        )}
        {view === 'history' && (
          <section className="page-section">
            <div className="page-heading">
              <div>
                <h1>Reuniões gravadas</h1>
                <p>Reveja as decisões sem repetir chamadas de IA.</p>
              </div>
              <div className="history-actions">
                <button
                  className="secondary-button"
                  disabled={busy}
                  onClick={() => void act(refresh)}
                >
                  <RotateCcw size={16} />
                  Atualizar
                </button>
                <button
                  className="secondary-button danger-button"
                  disabled={
                    busy ||
                    (!history.some(terminal) && !seriesHistory.some((s) => s.phase !== 'running'))
                  }
                  onClick={() => deleteHistory()}
                >
                  <Trash2 size={16} />
                  Limpar histórico
                </button>
              </div>
            </div>
            {seriesHistory.length > 0 && (
              <>
                <h2 className="history-group">Maratonas</h2>
                <div className="history-list">
                  {seriesHistory.map((h) => (
                    <article key={h.id}>
                      <div className="history-description">
                        <span className={`history-mode ${h.mode}`}>
                          {h.mode === 'demo' ? 'Ensaio sintético' : 'Execução real'}
                        </span>
                        <h2>Maratona · {h.totalMeetings} reuniões</h2>
                        <p>
                          {new Date(h.createdAt).toLocaleString('pt-BR')} ·{' '}
                          {h.phase === 'complete'
                            ? 'Concluída'
                            : h.phase === 'running'
                              ? 'Em andamento'
                              : h.phase === 'cancelled'
                                ? 'Encerrada'
                                : 'Interrompida'}
                          {h.phase === 'complete' && h.mode === 'live'
                            ? ` · Vencedor: ${winnerName(h.winner ?? 'inconclusive')}`
                            : ''}
                          {h.cheapest.length === 1 ? ` · Mais barato: ${names[h.cheapest[0]]}` : ''}
                        </p>
                      </div>
                      <div className="history-actions">
                        <button
                          className="secondary-button"
                          disabled={busy}
                          onClick={() => openSeries(h.id)}
                        >
                          <Play size={15} />
                          {h.phase === 'complete' ? 'Abrir boletim' : 'Abrir maratona'}
                        </button>
                        <button
                          className="secondary-button danger-button"
                          disabled={busy || h.phase === 'running'}
                          onClick={() => deleteSeries(h)}
                          aria-label="Excluir maratona"
                        >
                          <Trash2 size={15} />
                          Excluir
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
                {history.length > 0 && <h2 className="history-group">Reuniões avulsas</h2>}
              </>
            )}
            {history.length || seriesHistory.length ? (
              <div className="history-list">
                {history.map((h) => (
                  <article key={h.id}>
                    <div className="history-description">
                      <span className={`history-mode ${h.mode}`}>
                        {h.mode === 'demo' ? 'Ensaio sintético' : 'Execução real'}
                      </span>
                      <h2>{h.title}</h2>
                      <p>
                        {new Date(h.createdAt).toLocaleString('pt-BR')} · {h.completedRounds}{' '}
                        rodadas · {phaseNames[h.phase]}
                      </p>
                    </div>
                    <div className="history-actions">
                      <button
                        className="secondary-button"
                        disabled={busy}
                        onClick={() => openRun(h.id)}
                      >
                        <Play size={15} />
                        {['complete', 'failed', 'cancelled'].includes(h.phase)
                          ? 'Abrir replay'
                          : 'Retomar reunião'}
                      </button>
                      <button
                        className="secondary-button danger-button"
                        disabled={busy || !terminal(h)}
                        onClick={() => deleteHistory(h)}
                        aria-label={`Excluir reunião: ${h.title}`}
                        title={
                          terminal(h)
                            ? 'Excluir reunião e seus registros'
                            : 'Encerre a reunião antes de excluir'
                        }
                      >
                        <Trash2 size={15} />
                        Excluir
                      </button>
                    </div>
                    {h.costs && <HistorySummary run={h} />}
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-page">
                <History size={34} />
                <h2>A primeira reunião começa na arena</h2>
                <p>Execuções reais e ensaios serão identificados separadamente aqui.</p>
                <button className="primary-button" onClick={() => setView('arena')}>
                  Ir para a arena
                  <ArrowRight size={16} />
                </button>
              </div>
            )}
          </section>
        )}
        {view === 'method' && (
          <section className="page-section prose">
            <h1>Um placar que dá para conferir.</h1>
            <p className="lead">
              A comparação combina regras explícitas com uma avaliação cega do Opus. Cada camada tem
              um papel.
            </p>
            <h2>Antes de começar</h2>
            <p>
              Os cenários são fictícios. Contexto, perguntas, alternativas, gabaritos e
              consequências são congelados e recebem um hash. O Opus escreve a abertura e as
              transições; as perguntas estruturadas permanecem iguais para todos os participantes. O
              gabarito não é enviado aos provedores.
            </p>
            <h2>Durante cada rodada</h2>
            <p>
              Jev, Decisions e Clef recebem o mesmo texto e critérios equivalentes, por suas APIs
              nativas. São chamados em paralelo, sem retentativas automáticas. As respostas
              originais são preservadas. A consequência mostrada é uma regra da simulação, não um
              efeito medido numa empresa.
            </p>
            <table>
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Regra de 1 ponto</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Escolha</td>
                  <td>A alternativa corresponde ao gabarito.</td>
                </tr>
                <tr>
                  <td>Probabilidade</td>
                  <td>
                    Sim correto com ≥80%; não correto com ≤20%. Entre esses valores, revisão humana.
                  </td>
                </tr>
                <tr>
                  <td>Escala</td>
                  <td>Distância máxima de 0,4 do nível esperado.</td>
                </tr>
              </tbody>
            </table>
            <p>
              Recusa, erro de API e timeout ficam como indisponibilidade. Não provam que o modelo é
              pior. Confiança declarada não é taxa de acerto; seus valores também não são
              diretamente comparáveis entre fornecedores.
            </p>
            <h2>Quem vence</h2>
            <p>
              O vencedor sai de uma regra fixa, não de opinião: mais pontos pelo gabarito. Em
              empate, vence quem teve o Brier médio menor, com diferença mínima de 0,005. O Brier
              mede a distância entre as probabilidades declaradas e o gabarito: 0 é certeza correta;
              2, certeza errada. Ele só compara rodadas que todos responderam. Se uma resposta
              ausente pudesse mudar a liderança, não há vencedor. Uma rodada vai para quem acertou
              sozinho; se mais de um acertou, é empate.
            </p>
            <h2>O papel do Opus</h2>
            <p>
              O Opus abre cada reunião, comenta cada rodada e explica o resultado, sempre em sessões
              novas do CLI e às cegas: recebe os participantes como A, B e C em ordem aleatória, sem
              modelos, marcas, custos ou latência. Ele não muda o vencedor. Reuniões antigas,
              decididas pelo Opus, continuam exibindo seus julgamentos originais.
            </p>
            <h2>A maratona</h2>
            <p>
              Os seis cenários rodam em sequência, em piloto automático, com pausas para leitura. O
              boletim final soma as 36 decisões de cada modelo: acertos por bateria, calibração,
              custo e mediana de resposta. As recomendações são frases geradas por regras sobre
              esses números: mais acertos; menor custo por decisão, comparado ao mais preciso; e
              menor mediana, com diferença mínima de 50 ms. Sem consumo conhecido ou em ensaio,
              nenhuma recomendação de custo ou velocidade é feita.
            </p>
            <h2>O que pode ser auditado</h2>
            <p>
              O JSON exportado inclui o cenário congelado, seu hash, payloads das APIs, respostas
              originais, tempos, consumo reportado, prompts e saídas do CLI, mapeamentos cegos e os
              eventos persistidos. O replay só lê o histórico; não chama modelos.
            </p>
            <h2>Limites e fontes</h2>
            <p>
              Os gabaritos são parte do roteiro editorial e devem ser revisados antes de publicar o
              vídeo. Seis casos não medem calibração estatística nem estabelecem superioridade
              geral. Acesso e qualidade com os modelos reais dependem da execução ao vivo.
            </p>
            <ul>
              <li>
                <a
                  href="https://developers.openai.com/api/docs/guides/decisions"
                  target="_blank"
                  rel="noreferrer"
                >
                  OpenAI Decisions: tipos e preço
                </a>
              </li>
              <li>
                <a href="https://docs.typesafe.ai/models" target="_blank" rel="noreferrer">
                  Jev: modelos, idiomas e preço
                </a>
              </li>
              <li>
                <a
                  href="https://docs.typesafe.ai/model-jaggedness/jev-1.13"
                  target="_blank"
                  rel="noreferrer"
                >
                  Limitações declaradas do Jev
                </a>
              </li>
              <li>
                <a
                  href="https://developers.cloudflare.com/workers-ai/models/clef/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Clef: API no Workers AI e preço
                </a>
              </li>
              <li>
                <a href="https://code.claude.com/docs/en/headless" target="_blank" rel="noreferrer">
                  Claude CLI em modo não interativo
                </a>
              </li>
            </ul>
          </section>
        )}
        {view === 'settings' && (
          <section className="page-section prose">
            <div className="page-heading">
              <div>
                <h1>Conexões do estúdio</h1>
                <p>As credenciais ficam no servidor local.</p>
              </div>
              <button
                className="secondary-button"
                onClick={() => void act(refresh)}
                disabled={busy}
              >
                <RotateCcw size={16} />
                Verificar novamente
              </button>
            </div>
            <div className="connection-list">
              {[
                {
                  name: 'Claude CLI',
                  ok: health?.claude.authenticated === true,
                  status:
                    health?.claude.authenticated === true
                      ? 'Autenticado'
                      : health?.claude.authenticated === false
                        ? 'Sem login'
                        : 'Pendente',
                  detail:
                    health?.claude.error ??
                    health?.claude.version ??
                    'Instale o CLI e faça login no terminal.',
                  model: health?.models.claude,
                },
                {
                  name: 'Jev · TypeSafe',
                  ok: health?.keys.jev,
                  detail: 'TYPESAFE_API_KEY',
                  model: health?.models.jev,
                },
                {
                  name: 'Decisions · OpenAI',
                  ok: health?.keys.decisions,
                  detail: 'OPENAI_API_KEY',
                  model: health?.models.decisions,
                },
                {
                  name: 'Clef · Cloudflare',
                  ok: health?.keys.clef,
                  detail: 'CLOUDFLARE_ACCOUNT_ID e CLOUDFLARE_API_TOKEN',
                  model: health?.models.clef,
                },
              ].map((c) => (
                <article key={c.name}>
                  <div>
                    <h2>{c.name}</h2>
                    <p>{c.detail}</p>
                    <code>{c.model}</code>
                  </div>
                  <span className={c.ok ? 'connection-ok' : 'connection-missing'}>
                    {c.ok ? <Check size={16} /> : <CircleDot size={16} />}{' '}
                    {c.status ?? (c.ok ? 'Detectado' : 'Pendente')}
                  </span>
                </article>
              ))}
            </div>
            <p>
              O login do Claude é verificado no perfil configurado. Para Jev, Decisions e Clef,
              “Detectado” confirma a presença das credenciais. Saldo, limites e acesso aos modelos
              são validados na execução real.
            </p>
            <h2>Ativar os modelos reais</h2>
            <p>
              Copie <code>.env.example</code> para <code>.env</code> e preencha as chaves de OpenAI,
              TypeSafe e Cloudflare. Faça login no Claude CLI com a modalidade que você já utiliza.
              Reinicie o backend após alterar o arquivo.
            </p>
            <pre>
              <code>
                cp .env.example .env{`\n`}claude auth login{`\n`}npm run dev
              </code>
            </pre>
            <p>
              O Opus usa <code>claude --print</code>, com ferramentas desativadas e sessões
              isoladas. Não precisa de uma chave da Anthropic para reutilizar seu login do CLI.
            </p>
            <h2>Controle de consumo</h2>
            <p>
              Cada reunião real tem seis chamadas por provedor e até oito chamadas do CLI: uma
              abertura, seis comentários e uma explicação final. A maratona soma seis reuniões e uma
              leitura final: 36 chamadas por provedor e até 49 do CLI. Na reunião avulsa você avança
              manualmente; na maratona, o piloto automático avança sozinho. Você pode encerrar a
              qualquer momento. Chamadas já enviadas podem consumir créditos mesmo após
              cancelamento.
            </p>
            <p>
              As tarifas de referência, consultadas em 08/10/2026, são US$ 0,042/M tokens de entrada
              no Jev, US$ 0,10/M no Decisions e US$ 0,24/M no Clef (US$ 0,09/M no Clef-flash). No
              Clef, a cota diária gratuita da Cloudflare não é descontada. São estimativas de texto,
              sem adicionais regionais ou alterações futuras de tarifa. O consumo do CLI segue seu
              plano ou autenticação e fica separado dessas tarifas.
            </p>
            {run && (
              <p>
                Estimativa reportada pelo CLI nesta reunião:{' '}
                {money(run.cliCalls.reduce((n, c) => n + (c.estimatedUsd ?? 0), 0))}
                {run.cliCalls.some((c) => c.estimatedUsd === null)
                  ? ' + consumo desconhecido em uma ou mais chamadas'
                  : ''}
                . Esse valor técnico não é necessariamente uma cobrança adicional da assinatura.
              </p>
            )}
          </section>
        )}
      </main>
      <footer className="site-footer">
        <span>Mesa de decisão</span>
        <span>Jev × Decisions × Clef · avaliação em português</span>
        <span>Feito para mostrar as evidências.</span>
      </footer>
    </div>
  );
}
