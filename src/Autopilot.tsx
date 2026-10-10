import { useEffect, useState } from 'react';
import { Check, LoaderCircle, Square, Timer } from 'lucide-react';
import type { BravaView, Run, Scenario, Series } from '../shared/types';

function secondsUntil(until?: string) {
  const remaining = until ? Date.parse(until) - Date.now() : NaN;
  return Number.isFinite(remaining) ? Math.max(0, Math.ceil(remaining / 1000)) : null;
}

// Follow the server's deadline without rerendering the battery grid on every clock tick.
export function useCountdown(until?: string) {
  const [clock, setClock] = useState(() => ({ until, seconds: secondsUntil(until) }));
  useEffect(() => {
    const update = () => {
      const seconds = secondsUntil(until);
      setClock((previous) =>
        previous.until === until && previous.seconds === seconds ? previous : { until, seconds },
      );
      return seconds;
    };
    if (!update()) return;
    const timer = setInterval(() => {
      if (!update()) clearInterval(timer);
    }, 100);
    return () => clearInterval(timer);
  }, [until]);
  // A new deadline must not reuse the previous pause's clock on its first render.
  return clock.until === until ? clock.seconds : secondsUntil(until);
}

export function CountdownOverlay({ until, label }: { until?: string; label: string }) {
  const seconds = useCountdown(until);
  if (seconds === null || seconds === 0) return null;
  return (
    <div className="countdown-overlay" role="timer" aria-label={`${label}: ${seconds} segundos`}>
      <span key={`${until}-${seconds}`} className="countdown-number" aria-hidden="true">
        {seconds}
      </span>
    </div>
  );
}

export function batteryCountdownLabel(brava: BravaView) {
  if (brava.phase === 'preparing') return 'Começa';
  return brava.currentBattery === brava.batteries.length - 1 ? 'Boletim' : 'Próxima bateria';
}

const activity: Partial<Record<Run['phase'], string>> = {
  preparing: 'Opus prepara a abertura',
  evaluating: 'Os modelos estão decidindo',
  commenting: 'Opus analisa a rodada',
  judging: 'Opus explica o resultado',
};

export function SeriesProgress({
  series,
  run,
  scenarios,
  busy,
  onCancel,
}: {
  series: Series;
  run: Run | null;
  scenarios: Scenario[];
  busy: boolean;
  onCancel: () => void;
}) {
  const index = Math.max(0, series.runIds.length - 1);
  const advance = useCountdown(run?.phase === 'ready' ? run.nextAdvanceAt : undefined);
  const next = useCountdown(series.nextStartAt);
  const running = series.phase === 'running';
  const status = !running
    ? null
    : series.report
      ? { busy: true, text: 'Opus escreve a leitura final da Maratona de reuniões' }
      : next !== null
        ? { busy: false, text: `Próxima reunião em ${next} s` }
        : run && activity[run.phase]
          ? { busy: true, text: activity[run.phase]! }
          : advance !== null
            ? {
                busy: false,
                text: run!.rounds.length
                  ? `Próxima rodada em ${advance} s`
                  : `Começa em ${advance} s`,
              }
            : null;
  return (
    <div className="series-progress" aria-label="Progresso da Maratona de reuniões">
      <div className="series-progress-head">
        <span className="series-label">
          {series.mode === 'demo' ? 'Ensaio da Maratona de reuniões' : 'Maratona de reuniões'} ·
          Reunião {index + 1} de {series.scenarioIds.length}
        </span>
        {status && (
          <span className="series-status" aria-live="polite">
            {status.busy ? <LoaderCircle size={14} className="spin" /> : <Timer size={14} />}
            {status.text}
          </span>
        )}
        {running && (
          <button className="quiet-button" disabled={busy} onClick={onCancel}>
            <Square size={12} />
            Encerrar Maratona de reuniões
          </button>
        )}
      </div>
      <ol className="series-steps">
        {series.scenarioIds.map((id, i) => {
          const state =
            i < index || (i === index && run?.phase === 'complete')
              ? 'done'
              : i === index
                ? 'current'
                : 'next';
          const rounds = i === index && run ? run.rounds.length : state === 'done' ? 6 : 0;
          return (
            <li key={id} className={state}>
              <span className="series-step-title">
                {state === 'done' && <Check size={12} />}
                {scenarios.find((s) => s.id === id)?.title ?? id}
              </span>
              <span className="series-step-track">
                <span style={{ width: `${(rounds / 6) * 100}%` }} />
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
