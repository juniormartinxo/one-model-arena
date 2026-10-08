import { useEffect, useState } from 'react';
import { Check, LoaderCircle, Square, Timer } from 'lucide-react';
import type { Run, Scenario, Series } from '../shared/types';

// Seconds left until an ISO instant, refreshed a few times per second.
export function useCountdown(until?: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!until) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [until]);
  return until ? Math.max(0, Math.ceil((Date.parse(until) - now) / 1000)) : null;
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
      ? { busy: true, text: 'Opus escreve a leitura final da maratona' }
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
    <div className="series-progress" aria-label="Progresso da maratona">
      <div className="series-progress-head">
        <span className="series-label">
          {series.mode === 'demo' ? 'Ensaio da maratona' : 'Maratona'} · Reunião {index + 1} de{' '}
          {series.scenarioIds.length}
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
            Encerrar maratona
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
