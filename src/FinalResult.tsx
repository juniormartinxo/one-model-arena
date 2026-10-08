import { useEffect, useRef, type CSSProperties } from 'react';
import {
  ArrowRight,
  AudioLines,
  CircleHelp,
  Download,
  Maximize2,
  Play,
  Scale,
  ShieldCheck,
  Trophy,
  X,
} from 'lucide-react';
import type { Run } from '../shared/types';
import { runProviders } from '../shared/types';
import { useCountdown } from './Autopilot';
import { metrics } from '../shared/scoring';
import {
  providerNames,
  resultPresentation,
  revealParticipants,
  verdictSummary,
} from '../shared/presentation';

const icons = { winner: Trophy, tie: Scale, inconclusive: CircleHelp, demo: Play };

function FinalScore({ run }: { run: Run }) {
  return (
    <div
      className="final-scoreboard"
      aria-label="Placar final por gabarito"
      style={{ '--competitors': runProviders(run).length } as CSSProperties}
    >
      {runProviders(run).map((provider) => {
        const m = metrics(run, provider);
        const selected = run.mode === 'live' && run.verdict?.winner === provider;
        const model = run.rounds.find((r) => r.results[provider])?.results[provider]?.model;
        const standing = run.verdict?.standings?.find((s) => s.provider === provider);
        return (
          <div
            key={provider}
            className={`final-score-team ${provider} ${selected ? 'selected-winner' : ''}`}
          >
            <div className="final-score-name">
              <span>{providerNames[provider]}</span>
              {selected && (
                <Trophy
                  size={18}
                  aria-label={
                    run.verdict?.basis === 'objective'
                      ? 'Vencedor pelo gabarito'
                      : 'Vencedor segundo o Opus'
                  }
                />
              )}
            </div>
            <div className="final-score-number">
              <strong>{m.correct}</strong>
              <span>/ {run.scenario.rounds.length}</span>
            </div>
            <p>pontos pelo gabarito</p>
            {run.verdict?.reason === 'calibration' && standing?.brier != null && (
              <p className="final-brier">
                Brier {standing.brier.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}
              </p>
            )}
            <small>
              {run.mode === 'demo' ? 'Dados sintéticos' : (model ?? 'Sem resposta utilizável')}
            </small>
          </div>
        );
      })}
    </div>
  );
}

export function FinalVerdict({ run, onReveal }: { run: Run; onReveal: () => void }) {
  const verdict = run.verdict!;
  const result = resultPresentation(run);
  const Icon = icons[result.Icon];
  return (
    <section className={`final-verdict result-${result.kind}`} aria-label="Veredito da reunião">
      <div className="final-heading-row">
        <div className="final-title">
          <Icon size={30} />
          <h2>{result.title}</h2>
        </div>
        <button id="show-final-result" className="primary-button" onClick={onReveal}>
          <Maximize2 size={16} />
          Ver resultado
        </button>
      </div>
      <p className="final-subtitle">{result.subtitle}</p>
      <FinalScore run={run} />
      <div className="final-analysis">
        <h3>
          <AudioLines size={18} />
          {run.mode === 'demo' ? 'Comentário de exemplo' : 'Por que esse resultado?'}
        </h3>
        <p>{verdictSummary(verdict)}</p>
      </div>
      {verdict.error && <p className="error-copy">{verdict.error}</p>}
      {verdict.passes.map((pass, i) => (
        <details key={i}>
          <summary>
            {verdict.basis === 'objective' ? 'Explicação cega do Opus' : `Julgamento ${i + 1} · `}
            {verdict.basis === 'objective'
              ? ''
              : i === 0
                ? 'primeira avaliação cega'
                : verdict.passes.length > 2
                  ? 'posições rotacionadas'
                  : 'identidades invertidas'}
          </summary>
          <p>{revealParticipants(pass.result.summary, pass.mapping)}</p>
          <ul>
            {pass.result.evidence.map((e, index) => (
              <li key={index}>
                <strong>
                  {e.roundId} ·{' '}
                  {e.participant === 'both'
                    ? pass.mapping.C
                      ? 'Todos'
                      : 'Ambos'
                    : (providerNames[pass.mapping[e.participant]!] ?? e.participant)}
                  :{' '}
                </strong>
                {revealParticipants(e.observation, pass.mapping)}
              </li>
            ))}
          </ul>
          <p>{revealParticipants(pass.result.limitations.join(' '), pass.mapping)}</p>
        </details>
      ))}
      <p className="muted">
        Esta é uma amostra pequena e contextual. O resultado não estabelece um vencedor universal.
      </p>
    </section>
  );
}

export function VerdictDialog({
  run,
  open,
  replay,
  onDismiss,
  nextAt,
}: {
  run: Run;
  open: boolean;
  replay: boolean;
  onDismiss: () => void;
  nextAt?: string;
}) {
  const next = useCountdown(nextAt);
  const ref = useRef<HTMLDialogElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const result = resultPresentation(run);
  const Icon = icons[result.Icon];
  useEffect(() => {
    const dialog = ref.current!;
    if (open && !dialog.open) {
      previousFocus.current =
        document.activeElement instanceof HTMLElement && document.activeElement !== document.body
          ? document.activeElement
          : null;
      dialog.showModal();
      if (contentRef.current) contentRef.current.scrollTop = 0;
    } else if (!open && dialog.open) {
      dialog.close();
      const target = previousFocus.current?.isConnected
        ? previousFocus.current
        : document.getElementById('show-final-result');
      target?.focus({ preventScroll: true });
    }
    if (!open) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={`verdict-modal result-${result.kind}`}
      aria-labelledby="verdict-modal-title"
      aria-describedby="verdict-modal-subtitle verdict-modal-origin"
      onCancel={(e) => {
        e.preventDefault();
        onDismiss();
      }}
      onKeyDown={(e) => {
        if (e.key !== 'Tab') return;
        const controls = e.currentTarget.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href]',
        );
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }}
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        const b = e.currentTarget.getBoundingClientRect();
        if (e.clientX < b.left || e.clientX > b.right || e.clientY < b.top || e.clientY > b.bottom)
          onDismiss();
      }}
    >
      <div className="verdict-modal-shell">
        <button
          className="verdict-close"
          aria-label="Fechar resultado"
          onClick={onDismiss}
          autoFocus
        >
          <X size={22} />
        </button>
        <div className="verdict-modal-content" ref={contentRef}>
          <div className="verdict-hero">
            <div className="verdict-emblem" aria-hidden="true">
              <Icon size={38} strokeWidth={1.5} />
            </div>
            <h2 id="verdict-modal-title">{result.title}</h2>
            <p id="verdict-modal-subtitle">{result.subtitle}</p>
            <p className="verdict-scenario" id="verdict-modal-origin">
              {replay && 'Replay · '}
              {run.mode === 'demo' ? 'Ensaio sintético' : 'Execução real'} · {run.scenario.title}
            </p>
          </div>
          <FinalScore run={run} />
          <div className="final-analysis">
            <h3>
              <AudioLines size={18} />
              {run.mode === 'demo' ? 'Comentário de exemplo' : 'A leitura do Opus'}
            </h3>
            <p>{verdictSummary(run.verdict!)}</p>
          </div>
          {run.verdict?.error && <p className="error-copy">{run.verdict.error}</p>}
          <p className="verdict-caveat">
            <ShieldCheck size={15} />
            <span>
              {run.mode === 'demo'
                ? 'Este ensaio demonstra o painel e não avalia os modelos.'
                : run.verdict?.basis === 'objective'
                  ? 'O vencedor sai do gabarito; o Opus só explica, sem ver as marcas.'
                  : 'O placar segue o gabarito. O veredito do Opus é uma avaliação desta amostra.'}
            </span>
          </p>
        </div>
        <footer className="verdict-modal-footer">
          {next !== null && (
            <span className="verdict-next" aria-live="polite">
              Próxima reunião em {next} s
            </span>
          )}
          <a className="secondary-button" href={`/api/runs/${run.id}/export`} download>
            <Download size={16} />
            Exportar evidências
          </a>
          <button className="primary-button" onClick={onDismiss}>
            Voltar à reunião
            <ArrowRight size={16} />
          </button>
        </footer>
      </div>
    </dialog>
  );
}
