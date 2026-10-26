import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { Analytics } from '@vercel/analytics/react';
import {
  ArrowRight,
  AudioLines,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Download,
  History,
  Layers,
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
  Users,
  X,
} from 'lucide-react';
import type {
  Health,
  Run,
  RunSummary,
  Scenario,
  Series,
  SeriesSnapshot,
  SeriesSummary,
  BravaKind,
  BravaSummary,
  BravaView,
} from '../shared/types';
import { isProvider, providers, runProviders } from '../shared/types';
import { metrics } from '../shared/scoring';
import { api } from './api';
import { Competitor, names, money } from './Competitor';
import { FinalVerdict, VerdictDialog } from './FinalResult';
import { HistorySummary } from './HistorySummary';
import { batteryCountdownLabel, CountdownOverlay, SeriesProgress } from './Autopilot';
import { enterFullscreen, exitFullscreen } from './recording';
import { SeriesReportDialog, SeriesReportView } from './SeriesReport';
import { BravaLive, BravaReportDialog, BravaReportView } from './Brava';
import { revealParticipants, roundNames } from '../shared/presentation';
import {
  hrefOf,
  isSpace,
  Lobby,
  phaseLabel,
  RoundTabs,
  rounds,
  spaces,
  SpaceTitle,
  viewFromHash,
  winnerName,
  type Space,
  type View,
} from './Spaces';
const terminal = (run: Pick<Run, 'phase'>) =>
  ['complete', 'failed', 'cancelled'].includes(run.phase);
const cheapestName = (cheapest: SeriesSummary['cheapest'] = []) =>
  cheapest.length === 1
    ? names[cheapest[0]]
    : cheapest.length > 1
      ? `Empate (${cheapest.map((p) => names[p]).join(', ')})`
      : 'não comparável (custos incompletos)';
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
export function App() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]),
    [health, setHealth] = useState<Health | null>(null),
    [history, setHistory] = useState<RunSummary[]>([]);
  const [scenarioId, setScenarioId] = useState('loja'),
    [view, setViewState] = useState<View>(() => viewFromHash(location.hash)),
    [lastRound, setLastRound] = useState<Space>('maratona');
  // Every space has its own address, so reloads and the back button keep the place.
  const setView = useCallback((next: View) => {
    setViewState(next);
    if (location.hash !== hrefOf(next) && !(next === 'home' && !location.hash))
      window.history.pushState(null, '', hrefOf(next));
  }, []);
  useEffect(() => {
    const follow = () => setViewState(viewFromHash(location.hash));
    window.addEventListener('popstate', follow);
    window.addEventListener('hashchange', follow);
    return () => {
      window.removeEventListener('popstate', follow);
      window.removeEventListener('hashchange', follow);
    };
  }, []);
  useEffect(() => {
    if ((rounds as readonly string[]).includes(view)) setLastRound(view as Space);
    window.scrollTo(0, 0);
  }, [view]);
  // A session restored after a reload opens in its own space, unless the address names another.
  const follow = useCallback(
    (space: Space) => {
      if (!location.hash || location.hash === '#/') setView(space);
    },
    [setView],
  );
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
  const [brava, setBrava] = useState<BravaView | null>(null),
    [bravaHistory, setBravaHistory] = useState<BravaSummary[]>([]),
    [bravaReportOpen, setBravaReportOpen] = useState(false);
  const seriesRunning = series?.phase === 'running';
  const bravaRunning = !!brava && !['complete', 'cancelled', 'failed'].includes(brava.phase);
  const historyRequest = useRef(0);
  const record = useCallback((on: boolean) => {
    setRecording(on);
    if (on) enterFullscreen();
    else exitFullscreen();
  }, []);
  useEffect(() => {
    const follow = () => {
      if (!document.fullscreenElement) setRecording(false);
    };
    document.addEventListener('fullscreenchange', follow);
    return () => document.removeEventListener('fullscreenchange', follow);
  }, []);
  const refreshHistory = useCallback(async () => {
    const request = ++historyRequest.current;
    const [items, marathons, bravas] = await Promise.all([
      api<RunSummary[]>('/runs'),
      api<SeriesSummary[]>('/series'),
      api<BravaSummary[]>('/bravas'),
    ]);
    if (request === historyRequest.current) {
      setHistory(items);
      setSeriesHistory(marathons);
      setBravaHistory(bravas);
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
    const bravaId = sessionStorage.getItem('brava');
    if (bravaId) {
      void api<BravaView>(`/bravas/${bravaId}`)
        .then((value) => {
          presentedResults.current.add(value.id);
          setBrava(value);
          follow(value.kind === 'visual' ? 'imagens' : 'brava');
        })
        .catch(() => sessionStorage.removeItem('brava'));
      return;
    }
    const seriesId = sessionStorage.getItem('series');
    if (seriesId) {
      void api<SeriesSnapshot>(`/series/${seriesId}`)
        .then((snapshot) => {
          // A reload must not replay the presentations already shown.
          presentedResults.current.add(snapshot.series.id);
          if (snapshot.run) presentedResults.current.add(snapshot.run.id);
          showSeries(snapshot);
          follow('maratona');
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
          follow(r.seriesId ? 'maratona' : 'sala');
        })
        .catch(() => sessionStorage.removeItem('meeting'));
  }, [refresh, showSeries, follow]);
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
  useEffect(() => {
    if (!brava || !bravaRunning) return;
    const source = new EventSource(`/api/bravas/${brava.id}/events`);
    source.onopen = () => setConnected(true);
    source.onmessage = (e) => {
      setBrava(JSON.parse(e.data));
      setConnected(true);
    };
    source.onerror = () => setConnected(false);
    return () => source.close();
  }, [brava?.id, bravaRunning]);
  useEffect(() => {
    if (brava?.phase === 'complete' && !presentedResults.current.has(brava.id)) {
      presentedResults.current.add(brava.id);
      setBravaReportOpen(true);
    }
    if (brava && !bravaRunning) void refreshHistory().catch(() => {});
  }, [brava?.id, brava?.phase, bravaRunning, refreshHistory]);
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
      if (event.key === 'Escape' && !document.querySelector('dialog[open]')) record(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [record]);
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
      // A finished session from another space leaves the screen.
      clearRun();
      setRun(value);
      sessionStorage.setItem('meeting', value.id);
      setView('sala');
    });
  }
  function startSeries(mode: Run['mode']) {
    setVerdictOpen(false);
    setReportOpen(false);
    void act(async () => {
      const snapshot = await api<SeriesSnapshot>('/series', { mode });
      clearRun();
      sessionStorage.setItem('series', snapshot.series.id);
      showSeries(snapshot);
      setView('maratona');
      record(true);
    });
  }
  function startBrava(mode: Run['mode'], kind: BravaKind = 'brava') {
    void act(async () => {
      const value = await api<BravaView>('/bravas', { mode, kind });
      clearRun();
      sessionStorage.setItem('brava', value.id);
      setBrava(value);
      setView(kind === 'visual' ? 'imagens' : 'brava');
      record(true);
    });
  }
  function cancelBrava() {
    if (brava)
      void act(async () => setBrava(await api<BravaView>(`/bravas/${brava.id}/cancel`, {})));
  }
  function openBrava(id: string) {
    void act(async () => {
      const value = await api<BravaView>(`/bravas/${id}`);
      clearRun();
      presentedResults.current.add(id);
      sessionStorage.setItem('brava', id);
      setBrava(value);
      setView(value.kind === 'visual' ? 'imagens' : 'brava');
      setBravaReportOpen(value.phase === 'complete');
    });
  }
  function deleteBrava(item: BravaSummary) {
    if (
      !window.confirm(
        `Excluir esta ${roundNames[item.kind].name} e todas as respostas? Esta ação não pode ser desfeita.`,
      )
    )
      return;
    void act(async () => {
      await api(`/bravas/${item.id}`, undefined, 'DELETE');
      if (brava?.id === item.id) clearRun();
      await refreshHistory();
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
      setView('maratona');
      setReportOpen(snapshot.series.phase === 'complete');
    });
  }
  function deleteSeries(item: SeriesSummary) {
    if (
      !window.confirm(
        'Excluir esta Maratona de reuniões, suas seis reuniões e todos os registros? Esta ação não pode ser desfeita.',
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
        setBrava(null);
        setBravaReportOpen(false);
        sessionStorage.removeItem('brava');
        sessionStorage.setItem('meeting', id);
      }
      setScenarioId(value.scenario.id);
      setReplay(terminal(value));
      setCursor(0);
      setPlaying(false);
      setView(value.seriesId ? 'maratona' : 'sala');
    });
  }
  function clearRun() {
    setVerdictOpen(false);
    setReportOpen(false);
    setBrava(null);
    setBravaReportOpen(false);
    sessionStorage.removeItem('brava');
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
  const sessionSpace: Space | null = brava
    ? brava.kind === 'visual'
      ? 'imagens'
      : 'brava'
    : series || run?.seriesId
      ? 'maratona'
      : run
        ? 'sala'
        : null;
  const space = isSpace(view) ? view : null;
  // The loaded session shows only in its own space; any other space shows its own setup.
  const here = !!space && space === sessionSpace;
  const countdown = !here
    ? null
    : seriesRunning && series?.nextStartAt
      ? { until: series.nextStartAt, label: 'Próxima reunião' }
      : !replay && run?.autoplay && run.phase === 'ready' && run.nextAdvanceAt
        ? { until: run.nextAdvanceAt, label: run.rounds.length ? 'Próxima rodada' : 'Começa' }
        : bravaRunning && brava?.nextAt
          ? { until: brava.nextAt, label: batteryCountdownLabel(brava) }
          : null;
  const shown = here ? run : null;
  const at = shown ? cursor : 0;
  const scenario = shown?.scenario ?? scenarios.find((s) => s.id === scenarioId);
  const round = scenario?.rounds[at];
  const result = shown?.rounds[at];
  const visibleRun = shown && replay ? { ...shown, rounds: shown.rounds.slice(0, at + 1) } : shown;
  const active = !!run && !terminal(run);
  const waiting = run && ['preparing', 'evaluating', 'commenting', 'judging'].includes(run.phase);
  const latest = run ? cursor >= run.rounds.length - 1 : true;
  const roundWinner = result?.feedback?.winner;
  const hasActiveHistory =
    history.some((r) => !['complete', 'failed', 'cancelled'].includes(r.phase)) ||
    seriesHistory.some((s) => s.phase === 'running') ||
    bravaHistory.some((b) => !['complete', 'failed', 'cancelled'].includes(b.phase)) ||
    !!seriesRunning ||
    bravaRunning ||
    active;
  // Where the running session can be followed: its space when loaded, otherwise the history.
  const live: Space | 'history' | null =
    sessionSpace && (seriesRunning || bravaRunning || active)
      ? sessionSpace
      : hasActiveHistory
        ? 'history'
        : null;
  const meetings = series
    ? series.runIds.map((id, i) => ({
        id,
        title: scenarios.find((s) => s.id === series.scenarioIds[i])?.title ?? id,
      }))
    : [];
  const finalVisible = run?.phase === 'complete' && (!replay || cursor === run.rounds.length - 1);
  const participants = here
    ? run
      ? runProviders(run)
      : (brava?.providers ?? providers)
    : spaces[space ?? 'sala'].providers;
  // The rodada 3 needs only the keys of the two models that read images.
  const visualReady =
    !!health?.keys.decisions &&
    !!health.keys.clef &&
    health.claude.available &&
    health.claude.authenticated === true;
  const bravaGroups = (['brava', 'visual'] as const)
    .map((kind) => ({ kind, items: bravaHistory.filter((h) => h.kind === kind) }))
    .filter((g) => g.items.length);
  const modeTag = (mode: Run['mode']) => (
    <span className={`history-mode ${mode}`}>
      {mode === 'demo' ? 'Ensaio sintético' : 'Execução real'}
    </span>
  );
  const bravaRow = (h: BravaSummary) => (
    <article key={h.id}>
      <div className="history-description">
        {modeTag(h.mode)}
        <h2>
          {roundNames[h.kind].title} · {h.items} {h.kind === 'visual' ? 'fotos' : 'testes'}
        </h2>
        <p>
          {new Date(h.createdAt).toLocaleString('pt-BR')} · {phaseLabel(h.phase)}
          {h.phase === 'complete' && h.mode === 'live'
            ? ` · Vencedor: ${winnerName(h.winner ?? 'inconclusive')}`
            : ''}
          {h.phase === 'complete' && h.mode === 'live'
            ? ` · Mais barato: ${cheapestName(h.cheapest)}`
            : ''}
        </p>
      </div>
      <div className="history-actions">
        <button className="secondary-button" disabled={busy} onClick={() => openBrava(h.id)}>
          <Play size={15} />
          {h.phase === 'complete' ? 'Abrir boletim' : 'Abrir rodada'}
        </button>
        <button
          className="secondary-button danger-button"
          disabled={busy || !['complete', 'failed', 'cancelled'].includes(h.phase)}
          onClick={() => deleteBrava(h)}
          aria-label={`Excluir ${roundNames[h.kind].name}`}
        >
          <Trash2 size={15} />
          Excluir
        </button>
      </div>
    </article>
  );
  const seriesRow = (h: SeriesSummary) => (
    <article key={h.id}>
      <div className="history-description">
        {modeTag(h.mode)}
        <h2>Maratona de reuniões · {h.totalMeetings} reuniões</h2>
        <p>
          {new Date(h.createdAt).toLocaleString('pt-BR')} · {phaseLabel(h.phase)}
          {h.phase === 'complete' && h.mode === 'live'
            ? ` · Vencedor: ${winnerName(h.winner ?? 'inconclusive')}`
            : ''}
          {h.phase === 'complete' && h.mode === 'live'
            ? ` · Mais barato: ${cheapestName(h.cheapest)}`
            : ''}
        </p>
      </div>
      <div className="history-actions">
        <button className="secondary-button" disabled={busy} onClick={() => openSeries(h.id)}>
          <Play size={15} />
          {h.phase === 'complete' ? 'Abrir boletim' : 'Abrir Maratona de reuniões'}
        </button>
        <button
          className="secondary-button danger-button"
          disabled={busy || h.phase === 'running'}
          onClick={() => deleteSeries(h)}
          aria-label="Excluir Maratona de reuniões"
        >
          <Trash2 size={15} />
          Excluir
        </button>
      </div>
    </article>
  );
  const runRow = (h: RunSummary) => (
    <article key={h.id}>
      <div className="history-description">
        {modeTag(h.mode)}
        <h2>{h.title}</h2>
        <p>
          {new Date(h.createdAt).toLocaleString('pt-BR')} · {h.completedRounds} rodadas ·{' '}
          {phaseNames[h.phase]}
        </p>
      </div>
      <div className="history-actions">
        <button className="secondary-button" disabled={busy} onClick={() => openRun(h.id)}>
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
            terminal(h) ? 'Excluir reunião e seus registros' : 'Encerre a reunião antes de excluir'
          }
        >
          <Trash2 size={15} />
          Excluir
        </button>
      </div>
      {h.costs && <HistorySummary run={h} />}
    </article>
  );
  const records: Record<Space, ReactNode[]> = {
    maratona: seriesHistory.slice(0, 3).map(seriesRow),
    brava: bravaHistory
      .filter((b) => b.kind === 'brava')
      .slice(0, 3)
      .map(bravaRow),
    imagens: bravaHistory
      .filter((b) => b.kind === 'visual')
      .slice(0, 3)
      .map(bravaRow),
    sala: history.slice(0, 3).map(runRow),
  };
  const setupHint = (ready: boolean, readyText: string) => (
    <p className="setup-hint">
      {live ? (
        <>
          {live === 'history'
            ? 'Há uma sessão em andamento.'
            : `${spaces[live].title}: sessão em andamento.`}{' '}
          <button className="text-button" onClick={() => setView(live)}>
            {live === 'history' ? 'Retome pelo histórico.' : 'Acompanhar.'}
          </button>
        </>
      ) : ready ? (
        readyText
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
  );
  const roundSetups = {
    maratona: {
      headline: 'Maratona de reuniões: 6 reuniões, 36 decisões por modelo',
      description:
        'Os seis cenários rodam em sequência, sem cliques, com o Opus comentando cada rodada. No fim, um boletim com acertos, calibração, custo e velocidade.',
      tone: '',
      liveLabel: 'Iniciar Maratona de reuniões real',
      demoLabel: 'Ensaio da Maratona de reuniões',
      ready: !!health?.ready,
      demoReady: scenarios.length > 0,
      onLive: () => startSeries('live'),
      onDemo: () => startSeries('demo'),
      readyText: 'Execução real usa Jev, Decisions, Clef e Claude Code usando a CLI.',
    },
    brava: {
      headline: 'Resiliência: quase 300 testes por modelo',
      description:
        'Robustez, português real com rótulo humano, saber dizer “não sei”, negação e injeção. Roda sozinha e termina num boletim próprio, separado da Maratona de reuniões.',
      tone: 'brava-setup',
      liveLabel: 'Iniciar Resiliência',
      demoLabel: 'Ensaio da Resiliência',
      ready: !!health?.ready,
      demoReady: true,
      onLive: () => startBrava('live'),
      onDemo: () => startBrava('demo'),
      readyText: 'Execução real usa Jev, Decisions, Clef e Claude Code usando a CLI.',
    },
    imagens: {
      headline: 'Rodada das imagens: Decisions × Clef em 80 fotos reais',
      description:
        'Contagem, posição relativa, profundidade e distância real, com perguntas e gabaritos do CV‑Bench. Só entram os modelos cujas APIs leem imagens. Roda sozinha e termina num boletim próprio.',
      tone: 'brava-setup visual-setup',
      liveLabel: 'Iniciar rodada das imagens',
      demoLabel: 'Ensaio da rodada das imagens',
      ready: visualReady,
      demoReady: true,
      onLive: () => startBrava('live', 'visual'),
      onDemo: () => startBrava('demo', 'visual'),
      readyText: 'Execução real usa Decisions, Clef e Claude Code usando a CLI.',
    },
  };
  const sessionBar = (
    <div className="session-bar">
      <div className={`session-mode ${shown?.mode ?? 'standby'}`}>
        <span className="status-dot" />
        {shown
          ? shown.mode === 'demo'
            ? 'ENSAIO SINTÉTICO'
            : 'EXECUÇÃO REAL'
          : 'PRONTO PARA COMEÇAR'}
        {shown && replay && <span className="replay-label">REPLAY</span>}
      </div>
      <span className="session-scenario">{scenario?.title ?? 'Carregando cenários…'}</span>
      <span className="round-count">
        {shown ? `Rodada ${at + 1} de ${scenario?.rounds.length}` : '6 rodadas · português'}
      </span>
    </div>
  );
  // The question, the competitors and the Opus panel: a live meeting or the preview of one.
  const stage = round && (
    <>
      <section className="question-section">
        <div className="question-meta">
          <span>
            {shown
              ? `${String(at + 1).padStart(2, '0')} / ${String(scenario!.rounds.length).padStart(2, '0')}`
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
        {shown?.narration && (
          <p className="moderator-transition">
            <AudioLines size={15} />
            <span>{shown.narration.rounds[at]?.transition}</span>
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
            pending={shown?.phase === 'evaluating' && latest}
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
            <h2>{shown?.mode === 'demo' ? 'Comentário de exemplo' : 'Opus 5.5'}</h2>
            <span>
              {shown?.mode === 'demo'
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
              {result.feedback.error && <p className="error-copy">{result.feedback.error}</p>}
            </>
          ) : shown?.phase === 'commenting' && latest ? (
            <p className="working">
              <LoaderCircle size={17} className="spin" />O Opus está comparando as decisões, sem ver
              as marcas…
            </p>
          ) : (
            <p>
              {shown?.narration && shown.rounds.length === 0
                ? shown.narration.introduction
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
            Escolha exata: +1. Probabilidade: +1 ao acertar com ≥80% para sim ou ≤20% para não;
            faixa intermediária é revisão. Escala: +1 se a distância do nível esperado for ≤0,4.
            Demais casos: 0. Indisponibilidade não é erro semântico.
          </p>
        </details>
      )}
    </>
  );
  const recordsSection = (s: Space) => (
    <section className="space-records" aria-label={`Registros: ${spaces[s].title}`}>
      <div className="space-records-head">
        <h2>Registros recentes</h2>
        <button className="text-button" onClick={() => setView('history')}>
          Ver o histórico completo
        </button>
      </div>
      {records[s].length ? (
        <div className="history-list">{records[s]}</div>
      ) : (
        <p className="space-empty">
          Nenhum registro ainda. O ensaio não chama nenhuma IA e serve para conferir o roteiro.
        </p>
      )}
    </section>
  );
  const setup = (s: Space) => {
    if (s === 'sala')
      return (
        <>
          {sessionBar}
          <section className="setup">
            <div>
              <label htmlFor="scenario">Cenário da reunião</label>
              <select
                id="scenario"
                value={scenarioId}
                onChange={(e) => setScenarioId(e.target.value)}
              >
                {scenarios.map((sc) => (
                  <option key={sc.id} value={sc.id}>
                    {sc.title}
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
            {setupHint(
              !!health?.ready,
              'Execução real usa Jev, Decisions, Clef e Claude Code usando a CLI. Avance uma rodada de cada vez.',
            )}
          </section>
          {stage}
          {recordsSection('sala')}
        </>
      );
    const r = roundSetups[s];
    return (
      <>
        <section className={`marathon-setup ${r.tone}`}>
          <div>
            <h2>{r.headline}</h2>
            <p>{r.description}</p>
          </div>
          <div className="setup-actions">
            <button
              className="primary-button"
              disabled={busy || !r.ready || hasActiveHistory}
              onClick={r.onLive}
            >
              <Radio size={17} />
              {r.liveLabel}
            </button>
            <button
              className="secondary-button"
              disabled={busy || !r.demoReady || hasActiveHistory}
              onClick={r.onDemo}
            >
              <Play size={16} />
              {r.demoLabel}
            </button>
          </div>
          {setupHint(r.ready, r.readyText)}
        </section>
        {recordsSection(s)}
      </>
    );
  };
  const session = (
    <>
      {series && (
        <SeriesProgress
          series={series}
          run={run}
          scenarios={scenarios}
          busy={busy}
          onCancel={cancelSeries}
        />
      )}
      {brava && (
        <>
          <BravaLive brava={brava} busy={busy} onCancel={cancelBrava} />
          {brava.report && brava.phase === 'complete' && (
            <section
              className="report-inline"
              aria-label={`Boletim da ${roundNames[brava.kind ?? 'brava'].name}`}
            >
              <div className="final-heading-row">
                <h2>Boletim da {roundNames[brava.kind ?? 'brava'].name}</h2>
                {!recording && (
                  <button className="primary-button" onClick={() => setBravaReportOpen(true)}>
                    <Maximize2 size={16} />
                    Ver boletim da {roundNames[brava.kind ?? 'brava'].name}
                  </button>
                )}
              </div>
              <BravaReportView brava={brava} summary={recording} />
            </section>
          )}
          {!bravaRunning && !recording && (
            <div className="end-actions">
              <a className="secondary-button" href={`/api/bravas/${brava.id}/export`} download>
                <Download size={16} />
                Exportar {roundNames[brava.kind ?? 'brava'].name}
              </a>
              <button className="primary-button" onClick={clearRun}>
                Nova {roundNames[brava.kind ?? 'brava'].name}
                <ArrowRight size={16} />
              </button>
            </div>
          )}
        </>
      )}
      {!brava && sessionBar}
      {run?.mode === 'demo' && (
        <p className="demo-disclosure">
          Respostas e comentários simulados. Nenhuma IA foi chamada e estes pontos não medem os
          modelos.
        </p>
      )}
      {!brava && stage}
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
                  {waiting ? <LoaderCircle size={17} className="spin" /> : <ArrowRight size={17} />}{' '}
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
        <section className="report-inline" aria-label="Boletim da Maratona de reuniões">
          <div className="final-heading-row">
            <h2>Boletim da Maratona de reuniões</h2>
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
              Exportar Maratona de reuniões
            </a>
          )}
          <button className="primary-button" onClick={clearRun}>
            {sessionSpace === 'maratona' ? 'Nova Maratona de reuniões' : 'Nova reunião'}
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
                <strong>{names[p]}:</strong> {m.correct} acertos · {m.incorrect} divergências ·{' '}
                {m.uncertain} revisões · {m.unavailable} indisponíveis
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
  );
  return (
    <div className={`app ${recording ? 'recording' : ''}`}>
      {countdown && !verdictOpen && <CountdownOverlay {...countdown} />}
      {run?.phase === 'complete' && run.verdict && (
        <VerdictDialog
          run={run}
          open={verdictOpen && here}
          replay={replay}
          onDismiss={closeVerdict}
          nextAt={seriesRunning ? series?.nextStartAt : undefined}
        />
      )}
      {brava?.report && (
        <BravaReportDialog
          brava={brava}
          open={bravaReportOpen && here}
          onDismiss={() => setBravaReportOpen(false)}
        />
      )}
      {series?.report && (
        <SeriesReportDialog
          series={series}
          meetings={meetings}
          open={reportOpen && here}
          onDismiss={() => setReportOpen(false)}
        />
      )}
      <header className="site-header">
        <a
          className="brand"
          href={hrefOf('home')}
          onClick={(e) => {
            e.preventDefault();
            setView('home');
          }}
        >
          <img
            className="brand-mark"
            src="/brand/one-model-arena-96.png"
            alt=""
            width={32}
            height={32}
          />
          <span>
            One Model Arena<span className="brand-dot">.</span>
          </span>
        </a>
        <nav aria-label="Navegação principal">
          {(
            [
              { target: lastRound, label: 'Rodadas', Icon: Layers, on: rounds },
              {
                target: 'sala',
                label: 'Sala de reuniões',
                short: 'Sala',
                Icon: Users,
                on: ['sala'],
              },
              { target: 'history', label: 'Histórico', Icon: History, on: ['history'] },
              { target: 'method', label: 'Método', Icon: BookOpen, on: ['method'] },
              { target: 'settings', label: 'Conexões', Icon: Settings2, on: ['settings'] },
            ] as {
              target: View;
              label: string;
              short?: string;
              Icon: typeof Layers;
              on: readonly View[];
            }[]
          ).map((item) => (
            <button
              key={item.label}
              className={item.on.includes(view) ? 'nav-link active' : 'nav-link'}
              aria-current={item.on.includes(view) ? 'page' : undefined}
              onClick={() => setView(item.target)}
            >
              <item.Icon size={16} />
              <span className={item.short ? 'nav-full' : undefined}>{item.label}</span>
              {item.short && <span className="nav-short">{item.short}</span>}
            </button>
          ))}
          <a className="nav-link" href="/relatorio-conclusao.html">
            <Trophy size={16} />
            <span>Conclusão</span>
          </a>
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
        {view === 'home' && (
          <Lobby
            history={history}
            seriesHistory={seriesHistory}
            bravaHistory={bravaHistory}
            scenarioCount={scenarios.length}
            live={live}
            onGo={setView}
          />
        )}
        {space && (
          <>
            {space !== 'sala' && <RoundTabs current={space} onGo={setView} />}
            <div className="arena-heading">
              <div>
                <span className={`space-kicker ${spaces[space].tone}`}>{spaces[space].kicker}</span>
                <SpaceTitle list={participants} />
                <p>
                  {participants.length === 3 ? 'Três' : 'Duas'} decisões.{' '}
                  {space === 'imagens' ? 'As mesmas fotos.' : 'Os mesmos fatos.'} Opus na análise.
                </p>
              </div>
              <div className="arena-actions" role="group" aria-label="Ações da rodada">
                {recording && here && brava && !bravaRunning && (
                  <>
                    {brava.report && brava.phase === 'complete' && (
                      <button
                        className="secondary-button"
                        aria-label={`Ver boletim da ${roundNames[brava.kind ?? 'brava'].name}`}
                        onClick={() => setBravaReportOpen(true)}
                      >
                        <Maximize2 size={14} /> Ver boletim
                      </button>
                    )}
                    <a
                      className="secondary-button"
                      href={`/api/bravas/${brava.id}/export`}
                      download
                      aria-label={`Exportar ${roundNames[brava.kind ?? 'brava'].name}`}
                    >
                      <Download size={14} /> Exportar
                    </a>
                    <button
                      className="primary-button"
                      onClick={clearRun}
                      aria-label={`Nova ${roundNames[brava.kind ?? 'brava'].name}`}
                    >
                      Nova rodada <ArrowRight size={14} />
                    </button>
                  </>
                )}
                <button
                  className="quiet-button recording-toggle"
                  aria-label={recording ? 'Sair da gravação' : 'Modo gravação'}
                  onClick={() => record(!recording)}
                >
                  {recording ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                  <span>{recording ? 'Sair da gravação' : 'Modo gravação'}</span>
                </button>
              </div>
            </div>
            {here ? session : setup(space)}
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
                    (!history.some(terminal) &&
                      !seriesHistory.some((s) => s.phase !== 'running') &&
                      !bravaHistory.some((b) =>
                        ['complete', 'failed', 'cancelled'].includes(b.phase),
                      ))
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
                <h2 className="history-group">Maratonas de reuniões</h2>
                <div className="history-list">{seriesHistory.map(seriesRow)}</div>
              </>
            )}
            {bravaGroups.map((group) => (
              <Fragment key={group.kind}>
                <h2 className="history-group">{roundNames[group.kind].plural}</h2>
                <div className="history-list">{group.items.map(bravaRow)}</div>
              </Fragment>
            ))}
            {history.length > 0 && (
              <>
                {(seriesHistory.length > 0 || bravaHistory.length > 0) && (
                  <h2 className="history-group">Sala de reuniões</h2>
                )}
                <div className="history-list">{history.map(runRow)}</div>
              </>
            )}
            {!history.length && !seriesHistory.length && !bravaHistory.length && (
              <div className="empty-page">
                <History size={34} />
                <h2>Nada gravado ainda</h2>
                <p>Execuções reais e ensaios das rodadas e da sala de reuniões aparecem aqui.</p>
                <button className="primary-button" onClick={() => setView('home')}>
                  Ir para o início
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
                    Sim correto com ≥80%; não correto com ≤20%. Entre esses valores, a arena marca
                    revisão humana: zero ponto, sem atribuir um pedido de ajuda ao modelo.
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
              2, certeza errada. Ele só compara rodadas que todos responderam e não mede apenas
              calibração. Se uma resposta ausente pudesse mudar a liderança, não há vencedor. Uma
              rodada vai para quem acertou sozinho; se mais de um acertou, é empate.
            </p>
            <h2>A Resiliência</h2>
            <p>
              É uma segunda rodada, com boletim próprio. A rodada 1 mede se o modelo aplica regras
              que estão escritas; a Resiliência testa alterações de apresentação, evidência
              adicional e tarefas com textos reais. São cinco baterias. Robustez: as 36 perguntas da
              rodada 1 com a ordem das alternativas invertida, texto irrelevante, erros de digitação
              ou uma evidência a mais a favor do gabarito; o grupo só conta se todas as versões
              acertarem, e a evidência a mais não pode baixar a probabilidade da resposta certa em
              mais de 2 pontos percentuais. Português real: 60 textos com rótulo humano de ASSIN 2,
              HateBR e B2W-Reviews01, sorteados com semente fixa. Saber dizer “não”: pedidos fora do
              escopo e dados ausentes. Negação: 12 grupos de quatro versões, que só contam inteiros.
              Injeção: instruções escondidas e aprovações falsas, misturadas a exceções legítimas.
            </p>
            <p>
              A nota de cada bateria vai de 0 a 100%, e a nota geral é a média simples, para que
              nenhuma bateria pese mais por ter mais itens. Essa nota não é diretamente comparável à
              proporção de acertos da maratona como medida de evolução. Diferenças abaixo de 1 ponto
              são empate, desempatado pelo Brier. O boletim mostra o intervalo de 95% da diferença
              entre o primeiro e os demais, por bootstrap; quando ele inclui zero, a diferença está
              dentro da margem de erro. O diagrama de calibração e o ECE comparam confiança
              declarada com frequência de acerto por faixa; Brier e ECE podem apontar líderes
              diferentes. Os itens de abstenção, negação e injeção foram escritos antes de consultar
              os modelos e revisados às cegas por outra sessão; os comentários reais do HateBR nunca
              aparecem na tela.
            </p>
            <p>
              A mudança de resposta compara a decisão, não o número: 1,97 e 1,99 na mesma escala são
              a mesma resposta. São 88 comparações de forma e 20 com evidência adicional, separadas
              por tipo. Cada mudança pode corrigir um erro ou afastar do gabarito. Não há controle
              de repetição idêntica para medir a variação normal. Itens considerados ambíguos depois
              de uma rodada são anulados: ficam no registro, saem da nota de todos os modelos e
              aparecem no boletim com o motivo.
            </p>
            <h2>A rodada das imagens</h2>
            <p>
              É a terceira rodada, com boletim próprio, e só para os modelos cujas APIs aceitam
              imagens: Decisions e Clef. São 80 fotos reais do CV-Bench, 20 por bateria, sorteadas
              com semente fixa. Contagem: quantos objetos de um tipo aparecem. Posição relativa: se
              um objeto está à esquerda, à direita, acima ou abaixo de outro. Profundidade: qual de
              dois objetos marcados está mais perto da câmera. Distância real: qual de dois objetos
              está mais perto de um terceiro no mundo, não na foto. Os gabaritos são do dataset; as
              perguntas foram vertidas para o português por frases-padrão, mantendo as alternativas.
            </p>
            <p>
              A foto vai embutida na chamada, em base64, porque nenhuma das duas APIs aceita links.
              O registro guarda só a impressão digital de cada foto, não os bytes. A pontuação é a
              da Resiliência: nota de 0 a 100% por bateria, média simples, empate abaixo de 1 ponto
              desempatado pelo Brier e margem de erro por bootstrap. No chute, a contagem acerta de
              17% a 25% e as outras baterias, 50%. O Opus comenta às cegas e não vê as fotos: lê a
              pergunta, as alternativas, o gabarito e as respostas.
            </p>
            <h2>O papel do Opus</h2>
            <p>
              O Opus abre cada reunião, comenta cada rodada e explica o resultado, sempre em sessões
              novas do CLI e às cegas: recebe os participantes como A, B e C em ordem aleatória, sem
              modelos, marcas, custos ou latência. Ele não muda o vencedor. Reuniões antigas,
              decididas pelo Opus, continuam exibindo seus julgamentos originais.
            </p>
            <h2>A Maratona de reuniões</h2>
            <p>
              Os seis cenários rodam em sequência, em piloto automático, com pausas para leitura. O
              boletim final soma as 36 decisões de cada modelo: acertos por bateria, calibração,
              custo estimado da API e mediana de resposta. As recomendações são frases geradas por
              regras sobre esses números: mais acertos; menor custo por decisão, comparado ao mais
              preciso; e menor mediana, com diferença mínima de 50 ms. Sem consumo conhecido ou em
              ensaio, nenhuma recomendação de custo ou velocidade é feita. A projeção de custo usa
              tokens de entrada e tarifas registradas; exclui Opus, infraestrutura, revisão humana e
              cotas gratuitas.
            </p>
            <h2>O que pode ser auditado</h2>
            <p>
              O JSON exportado inclui o cenário congelado, seu hash, payloads das APIs, respostas
              originais, tempos, consumo reportado, prompts e saídas do CLI, mapeamentos cegos e os
              eventos persistidos. O replay só lê o histórico; não chama modelos.
            </p>
            <h2>Limites e fontes</h2>
            <p>
              Os gabaritos autorais devem ser revisados antes das execuções; os demais vêm dos
              datasets. Correções posteriores precisam ser identificadas e aplicadas a todos. Estas
              amostras não estabelecem superioridade geral. Acesso e qualidade com os modelos reais
              dependem da execução ao vivo.
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
              abertura, seis comentários e uma explicação final. A Maratona de reuniões soma seis
              reuniões e uma leitura final: 36 chamadas por provedor e até 49 do CLI. Na reunião
              avulsa você avança manualmente; na Maratona de reuniões, o piloto automático avança
              sozinho. Você pode encerrar a qualquer momento. Chamadas já enviadas podem consumir
              créditos mesmo após cancelamento.
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
        <span>One Model Arena</span>
        <span>Jev × Decisions × Clef · avaliação em português</span>
        <span>Feito para mostrar as evidências.</span>
      </footer>
      <Analytics />
    </div>
  );
}
