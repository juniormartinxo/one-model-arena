import { ArrowRight, LoaderCircle } from 'lucide-react';
import type { BravaSummary, Provider, RunSummary, SeriesSummary } from '../shared/types';
import { providers, visualProviders } from '../shared/types';
import { names } from './Competitor';

// Each kind of session lives in its own space, with its own address.
export type Space = 'maratona' | 'brava' | 'imagens' | 'sala';
export type View = 'home' | Space | 'history' | 'method' | 'settings';
export const rounds = ['maratona', 'brava', 'imagens'] as const;
export const isSpace = (view: View): view is Space =>
  view === 'sala' || (rounds as readonly string[]).includes(view);

const routes: Record<View, string> = {
  home: '',
  maratona: '#/maratona',
  brava: '#/brava',
  imagens: '#/imagens',
  sala: '#/sala',
  history: '#/historico',
  method: '#/metodo',
  settings: '#/conexoes',
};
export const hrefOf = (view: View) => routes[view] || '#/';
export const viewFromHash = (hash: string): View =>
  (Object.keys(routes) as View[]).find((v) => routes[v] && routes[v] === hash) ?? 'home';

export const spaces: Record<
  Space,
  {
    kicker: string;
    title: string;
    tab: string;
    summary: string;
    volume: string;
    tone: string;
    providers: Provider[];
  }
> = {
  maratona: {
    kicker: 'Rodada 1 · piloto automático',
    title: 'Maratona',
    tab: '1 · Maratona',
    summary: 'Os seis cenários em sequência, sem cliques, com o Opus comentando cada rodada.',
    volume: '6 reuniões · 36 decisões por modelo',
    tone: 'marathon',
    providers,
  },
  brava: {
    kicker: 'Rodada 2 · mais difícil',
    title: 'Rodada brava',
    tab: '2 · Brava',
    summary: 'Robustez, português real, saber dizer “não sei”, negação e injeção.',
    volume: 'quase 300 testes por modelo',
    tone: 'brava',
    providers,
  },
  imagens: {
    kicker: 'Rodada 3 · imagens',
    title: 'Rodada das imagens',
    tab: '3 · Imagens',
    summary: 'Contagem, posição, profundidade e distância em fotos reais do CV‑Bench.',
    volume: '80 fotos · só modelos que leem imagens',
    tone: 'visual',
    providers: visualProviders,
  },
  sala: {
    kicker: 'Reunião avulsa',
    title: 'Sala de reuniões',
    tab: 'Sala de reuniões',
    summary: 'Escolha um cenário e avance uma rodada de cada vez, no seu ritmo.',
    volume: '6 rodadas por cenário',
    tone: 'room',
    providers,
  },
};

const finished = (phase: string) => ['complete', 'failed', 'cancelled'].includes(phase);
export const phaseLabel = (phase: string) =>
  phase === 'complete'
    ? 'Concluída'
    : phase === 'cancelled'
      ? 'Encerrada'
      : phase === 'failed'
        ? 'Interrompida'
        : 'Em andamento';
export const winnerName = (winner: string) =>
  winner === 'tie'
    ? 'Empate'
    : winner === 'inconclusive'
      ? 'Inconclusivo'
      : names[winner as Provider];
type Latest = Pick<RunSummary, 'createdAt' | 'mode'> & { phase: string; winner?: string | null };
function latestLine(item?: Latest) {
  if (!item) return 'Nenhum registro ainda';
  const date = new Date(item.createdAt).toLocaleDateString('pt-BR');
  const mode = item.mode === 'demo' ? 'ensaio' : 'real';
  const winner =
    item.phase === 'complete' && item.mode === 'live' && item.winner
      ? ` · ${winnerName(item.winner)}${item.winner in names ? ' venceu' : ''}`
      : '';
  return `Último: ${date} · ${mode} · ${phaseLabel(item.phase).toLowerCase()}${winner}`;
}

export function SpaceTitle({ list }: { list: Provider[] }) {
  return (
    <h1>
      {list.map((p, i) => (
        <span key={p}>
          {i > 0 && <span className="versus"> × </span>}
          {names[p]}
        </span>
      ))}
    </h1>
  );
}

export function RoundTabs({ current, onGo }: { current: Space; onGo: (space: Space) => void }) {
  return (
    <nav className="round-tabs" aria-label="Rodadas">
      {rounds.map((r) => (
        <a
          key={r}
          href={hrefOf(r)}
          aria-current={current === r ? 'page' : undefined}
          onClick={(e) => {
            e.preventDefault();
            onGo(r);
          }}
        >
          {spaces[r].tab}
        </a>
      ))}
    </nav>
  );
}

export function Lobby({
  history,
  seriesHistory,
  bravaHistory,
  scenarioCount,
  live,
  onGo,
}: {
  history: RunSummary[];
  seriesHistory: SeriesSummary[];
  bravaHistory: BravaSummary[];
  scenarioCount: number;
  live: Space | 'history' | null;
  onGo: (view: View) => void;
}) {
  const latest: Record<Space, Latest | undefined> = {
    maratona: seriesHistory[0],
    brava: bravaHistory.find((b) => b.kind === 'brava'),
    imagens: bravaHistory.find((b) => b.kind === 'visual'),
    sala: history[0],
  };
  const card = (space: Space) => {
    const s = spaces[space];
    const item = latest[space];
    return (
      <a
        key={space}
        className={`space-card ${s.tone}`}
        href={hrefOf(space)}
        onClick={(e) => {
          e.preventDefault();
          onGo(space);
        }}
      >
        <span className={`space-kicker ${s.tone}`}>{s.kicker}</span>
        <h3>{s.title}</h3>
        <p>{s.summary}</p>
        <span className="space-facts">
          {s.providers.map((p) => names[p]).join(' × ')} ·{' '}
          {space === 'sala' && scenarioCount ? `${scenarioCount} cenários · ` : ''}
          {s.volume}
        </span>
        <span className="space-footer">
          <span className={item && !finished(item.phase) ? 'space-live' : undefined}>
            {item && !finished(item.phase) && <span className="status-dot" />}
            {latestLine(item)}
          </span>
          <span className="space-enter">
            Entrar
            <ArrowRight size={15} />
          </span>
        </span>
      </a>
    );
  };
  return (
    <section className="lobby" aria-label="Início">
      <div className="arena-heading">
        <div>
          <SpaceTitle list={providers} />
          <p>Três decisões. Os mesmos fatos. Opus na análise. Escolha onde começar.</p>
        </div>
      </div>
      {live && (
        <div className="notice live-notice" role="status">
          <LoaderCircle size={17} className="spin" />
          <span>
            {live === 'history'
              ? 'Há uma sessão em andamento.'
              : `${spaces[live].title}: sessão em andamento.`}
          </span>
          <button className="text-button" onClick={() => onGo(live)}>
            {live === 'history' ? 'Retomar pelo histórico' : 'Acompanhar'}
          </button>
        </div>
      )}
      <h2 className="lobby-label">Rodadas</h2>
      <div className="lobby-rounds">{rounds.map(card)}</div>
      <h2 className="lobby-label">Sala de reuniões</h2>
      <div className="lobby-room">{card('sala')}</div>
    </section>
  );
}
