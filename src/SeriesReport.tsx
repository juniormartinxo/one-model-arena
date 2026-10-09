import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {
  ArrowRight,
  AudioLines,
  BadgeDollarSign,
  Check,
  CircleHelp,
  Crosshair,
  Download,
  Gauge,
  Minus,
  Play,
  Scale,
  ShieldCheck,
  Target,
  TriangleAlert,
  Trophy,
  X,
  Zap,
} from 'lucide-react';
import type { Grade, Provider, Series, SeriesReport as Report } from '../shared/types';
export type Meeting = { id: string; title: string };
import { providerNames, providerVendors, revealParticipants } from '../shared/presentation';

const usd = (value: number, digits = 2) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
const seconds = (ms: number) =>
  `${(ms / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} s`;
const percent = (part: number, total: number) =>
  total ? `${Math.round((part / total) * 100)}%` : '—';

const reduceMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// Counts up to the final value once, so the scoreboard lands on screen with a beat.
function CountUp({ value, format = String }: { value: number; format?: (v: number) => string }) {
  const [shown, setShown] = useState(() => (reduceMotion() ? value : 0));
  useEffect(() => {
    if (reduceMotion()) return setShown(value);
    let frame = 0;
    const started = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - started) / 1100);
      setShown(value * (1 - (1 - t) ** 3));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <>{format(shown)}</>;
}

const badges: { key: keyof Report; label: string; Icon: typeof Trophy }[] = [
  { key: 'mostAccurate', label: 'Mais preciso', Icon: Target },
  { key: 'bestCalibrated', label: 'Melhor calibrado', Icon: Crosshair },
  { key: 'cheapest', label: 'Mais barato', Icon: BadgeDollarSign },
  { key: 'fastest', label: 'Mais rápido', Icon: Zap },
];
const recommendationIcons = { accuracy: Target, budget: BadgeDollarSign, speed: Gauge };
const statusIcon: Record<Grade['status'], typeof Check> = {
  correct: Check,
  incorrect: TriangleAlert,
  uncertain: CircleHelp,
  unavailable: Minus,
};
const statusText: Record<Grade['status'], string> = {
  correct: 'acertou',
  incorrect: 'divergiu',
  uncertain: 'pediu revisão',
  unavailable: 'sem resposta',
};

// One horizontal bar per participant, direct-labeled; the name doubles as the legend.
function BarRows({
  report,
  value,
  max,
  label,
  tip,
}: {
  report: Report;
  value: (p: Provider) => number | undefined;
  max: number;
  label: (p: Provider) => string;
  tip: (p: Provider) => string;
}) {
  return (
    <div className="bar-rows">
      {report.participants.map((p, i) => {
        const v = value(p);
        return (
          <div className="bar-row" key={p} data-tip={tip(p)} tabIndex={0}>
            <span className={`bar-name ink-${p}`}>{providerNames[p]}</span>
            <span className="bar-track">
              {v !== undefined && (
                <span
                  className={`bar-fill mark-${p}`}
                  style={
                    {
                      '--size': `${max ? Math.max(1.5, (v / max) * 100) : 0}%`,
                      '--delay': `${i * 120}ms`,
                    } as CSSProperties
                  }
                />
              )}
            </span>
            <span className="bar-value">{v === undefined ? '—' : label(p)}</span>
          </div>
        );
      })}
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="report-section">
      <header>
        <h3>{title}</h3>
        {note && <p>{note}</p>}
      </header>
      {children}
    </section>
  );
}

export function SeriesReportView({
  series,
  meetings,
  onOpenMeeting,
}: {
  series: Series;
  meetings: Meeting[];
  onOpenMeeting?: (id: string) => void;
}) {
  const report = series.report!;
  const demo = series.mode === 'demo';
  const by = Object.fromEntries(report.standings.map((s) => [s.provider, s])) as Record<
    Provider,
    Report['standings'][number]
  >;
  const winner = report.winner === 'tie' || report.winner === 'inconclusive' ? null : report.winner;
  const analysis = series.analysis;
  const headline = analysis
    ? revealParticipants(analysis.headline, analysis.mapping)
    : demo
      ? 'Ensaio da maratona concluído'
      : winner
        ? `${providerNames[winner]} lidera a maratona`
        : report.winner === 'tie'
          ? 'Empate na maratona'
          : 'Maratona sem vencedor declarado';
  const reasonText = {
    points: 'Mais acertos pelo gabarito.',
    calibration: 'Empate em acertos, desempate pela calibração.',
    tie: 'Mesmos acertos e calibração equivalente.',
    unavailable: 'Respostas ausentes poderiam mudar a liderança.',
  }[report.reason];
  const costMax = Math.max(0, ...Object.values(report.costPerMillion));
  const hasCosts = Object.keys(report.costPerMillion).length > 0;
  const latencyMax = Math.max(0, ...report.standings.map((s) => s.medianMs ?? 0));
  const [allDivergences, setAllDivergences] = useState(false);
  const divergences = allDivergences ? report.divergences : report.divergences.slice(0, 6);
  return (
    <div className={`series-report ${demo ? 'is-demo' : ''}`}>
      <div className="report-hero">
        <div className={`report-emblem ${winner ? `mark-${winner}` : ''}`} aria-hidden="true">
          {winner ? <Trophy size={40} strokeWidth={1.5} /> : <Scale size={40} strokeWidth={1.5} />}
        </div>
        <p className="report-kicker">
          {demo ? 'Ensaio sintético · ' : ''}Maratona concluída · {meetings.length} reuniões ·{' '}
          {report.decisions} decisões por modelo
        </p>
        <h2 id="series-report-title">{headline}</h2>
        <p className="report-reason">
          {demo
            ? 'Respostas simuladas para conferir a apresentação. Nada aqui mede os modelos.'
            : `${winner ? `Vencedor: ${providerNames[winner]}. ` : ''}${reasonText}`}
        </p>
      </div>

      <div
        className="report-podium"
        style={{ '--competitors': report.participants.length } as CSSProperties}
      >
        {report.participants.map((p, i) => {
          const s = by[p];
          return (
            <article
              key={p}
              className={`podium-card ink-${p} ${winner === p ? 'is-winner' : ''}`}
              style={{ '--delay': `${i * 140}ms` } as CSSProperties}
            >
              <header>
                <div>
                  <h3>{providerNames[p]}</h3>
                  <span>{providerVendors[p]}</span>
                </div>
                {winner === p && <Trophy size={22} aria-label="Vencedor da maratona" />}
              </header>
              <div className="podium-score">
                <strong>
                  <CountUp value={s.correct} format={(v) => String(Math.round(v))} />
                </strong>
                <span>/ {s.total}</span>
              </div>
              <p className="podium-caption">
                acertos pelo gabarito · {percent(s.correct, s.total)}
              </p>
              <ul className="podium-badges" aria-label="Destaques">
                {badges
                  .filter((b) => !demo && (report[b.key] as Provider[]).includes(p))
                  .map((b) => (
                    <li key={b.label}>
                      <b.Icon size={13} />
                      {b.label}
                      {(report[b.key] as Provider[]).length > 1 ? ' (empate)' : ''}
                    </li>
                  ))}
              </ul>
              <dl className="podium-metrics">
                <div>
                  <dt>Custo da maratona</dt>
                  <dd>
                    {demo ? '—' : s.unknownCosts ? `≥ ${usd(s.costUsd, 5)}` : usd(s.costUsd, 5)}
                  </dd>
                </div>
                <div>
                  <dt>1 milhão de decisões</dt>
                  <dd>
                    {report.costPerMillion[p] !== undefined ? usd(report.costPerMillion[p]!) : '—'}
                  </dd>
                </div>
                <div>
                  <dt>Tokens por decisão</dt>
                  <dd>{s.total && !demo ? Math.round(s.inputTokens / s.total) : '—'}</dd>
                </div>
                <div>
                  <dt>Mediana de resposta</dt>
                  <dd>{s.medianMs === null ? '—' : seconds(s.medianMs)}</dd>
                </div>
                <div>
                  <dt>Revisões humanas</dt>
                  <dd>{s.uncertain}</dd>
                </div>
                <div>
                  <dt>Divergências</dt>
                  <dd>{s.incorrect}</dd>
                </div>
                <div className="podium-wide">
                  <dt>Calibração (Brier)</dt>
                  <dd>
                    {s.brier === null
                      ? '—'
                      : s.brier.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}
                  </dd>
                </div>
              </dl>
            </article>
          );
        })}
      </div>

      {report.recommendations.length > 0 && (
        <Section
          title="Qual faz sentido para você?"
          note="Frases geradas pelos números desta maratona, não por opinião."
        >
          <div className="recommendations">
            {report.recommendations.map((r) => {
              const Icon = recommendationIcons[r.kind];
              return (
                <article
                  key={r.kind}
                  className={`recommendation ${r.providers.length === 1 ? `ink-${r.providers[0]}` : 'is-tie'}`}
                >
                  <Icon size={20} />
                  <div>
                    <h4>{r.title}</h4>
                    <strong>
                      {r.providers.length === report.participants.length && r.providers.length > 1
                        ? 'Empate'
                        : r.providers.map((p) => providerNames[p]).join(' e ')}
                    </strong>
                    <p>{r.text}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </Section>
      )}

      <div className="report-charts">
        <Section title="Acertos por bateria" note="Básicos, avançados e estresse, em pontos.">
          <div className="battery-grid">
            {report.batteries.map((b) => (
              <div key={b.id} className="battery">
                <h4>
                  {b.label} <span>{b.total} perguntas</span>
                </h4>
                <BarRows
                  report={report}
                  value={(p) => b.correct[p]}
                  max={b.total}
                  label={(p) => `${b.correct[p]}/${b.total}`}
                  tip={(p) =>
                    `${providerNames[p]} · ${b.label}: ${b.correct[p]} de ${b.total} (${percent(b.correct[p], b.total)})`
                  }
                />
              </div>
            ))}
          </div>
        </Section>
        <div className="report-side">
          <Section
            title="Custo para 1 milhão de decisões como estas"
            note="Projeção pelos tokens de entrada medidos e pelas tarifas de referência. Não inclui cotas gratuitas."
          >
            {hasCosts ? (
              <BarRows
                report={report}
                value={(p) => report.costPerMillion[p]}
                max={costMax}
                label={(p) => usd(report.costPerMillion[p]!)}
                tip={(p) =>
                  `${providerNames[p]}: ${usd(report.costPerMillion[p]!)} por milhão · ${Math.round(by[p].inputTokens / by[p].total)} tokens de entrada por decisão`
                }
              />
            ) : (
              <p className="report-empty">
                {demo
                  ? 'O ensaio não consome APIs, então não há custo a projetar.'
                  : 'Algum consumo não foi informado pela API; a projeção ficaria incompleta.'}
              </p>
            )}
          </Section>
          <Section
            title="Mediana de resposta"
            note="Tempo por decisão medido no estúdio, incluindo a rede até cada API."
          >
            {latencyMax ? (
              <BarRows
                report={report}
                value={(p) => by[p].medianMs ?? undefined}
                max={latencyMax}
                label={(p) => seconds(by[p].medianMs!)}
                tip={(p) =>
                  `${providerNames[p]}: mediana de ${seconds(by[p].medianMs!)} por decisão`
                }
              />
            ) : (
              <p className="report-empty">O ensaio não mede tempo de resposta.</p>
            )}
          </Section>
        </div>
      </div>

      <Section
        title="Onde eles discordaram"
        note={
          report.divergences.length
            ? `${report.divergences.length} de ${report.decisions} perguntas não tiveram acerto unânime.`
            : 'Todos acertaram todas as perguntas.'
        }
      >
        {report.divergences.length > 0 && (
          <>
            <ol className="divergence-list">
              {divergences.map((d) => (
                <li key={d.roundId}>
                  <div className="divergence-question">
                    <span>
                      {d.scenarioTitle} · {d.title}
                    </span>
                    <p>{d.question}</p>
                    <small>Gabarito: {d.expected}</small>
                  </div>
                  <ul>
                    {report.participants.map((p) => {
                      const a = d.answers[p]!;
                      const Icon = statusIcon[a.status];
                      return (
                        <li key={p} className={`status-${a.status}`}>
                          <span className={`ink-${p}`}>{providerNames[p]}</span>
                          <strong>{a.label}</strong>
                          <em>
                            <Icon size={13} /> {statusText[a.status]}
                          </em>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ol>
            {report.divergences.length > 6 && (
              <button className="text-button" onClick={() => setAllDivergences(!allDivergences)}>
                {allDivergences
                  ? 'Mostrar menos'
                  : `Mostrar todas as ${report.divergences.length} divergências`}
              </button>
            )}
          </>
        )}
      </Section>

      {(analysis || series.analysisError) && (
        <Section
          title="A leitura do Opus"
          note="Avaliação cega: o Opus não viu marcas, custos nem tempos."
        >
          {analysis ? (
            <div className="report-analysis">
              <AudioLines size={18} />
              <div>
                <p>{revealParticipants(analysis.summary, analysis.mapping)}</p>
                <ul>
                  {analysis.evidence.map((e, i) => (
                    <li key={i}>
                      <strong>
                        {e.roundId} ·{' '}
                        {e.participant === 'both'
                          ? 'Todos'
                          : providerNames[analysis.mapping[e.participant]!]}
                        :
                      </strong>{' '}
                      {revealParticipants(e.observation, analysis.mapping)}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <p className="error-copy">{series.analysisError}</p>
          )}
        </Section>
      )}

      {onOpenMeeting && (
        <Section title="As reuniões">
          <ul className="meeting-links">
            {meetings.map((m) => (
              <li key={m.id}>
                <button className="secondary-button" onClick={() => onOpenMeeting(m.id)}>
                  <Play size={14} />
                  {m.title}
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <p className="report-caveat">
        <ShieldCheck size={15} />
        <span>
          {report.decisions} perguntas fictícias em português, com gabarito fixado antes das
          respostas. Vencedor: mais acertos; empate desempatado pelo Brier médio. Custo estimado só
          pelos tokens de entrada, com tarifas de 08/10/2026; latência inclui rede. Não é um ranking
          universal: repita com seus próprios casos.
        </span>
      </p>
    </div>
  );
}

export function SeriesReportDialog({
  series,
  meetings,
  open,
  onDismiss,
}: {
  series: Series;
  meetings: Meeting[];
  open: boolean;
  onDismiss: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    if (open && !dialog.open) {
      dialog.showModal();
      dialog.querySelector('.series-dialog-content')?.scrollTo({ top: 0 });
    } else if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="series-dialog"
      aria-labelledby="series-report-title"
      onCancel={(e) => {
        e.preventDefault();
        onDismiss();
      }}
    >
      <button className="verdict-close" aria-label="Fechar boletim" onClick={onDismiss}>
        <X size={22} />
      </button>
      <div className="series-dialog-content">
        {open && <SeriesReportView series={series} meetings={meetings} />}
      </div>
      <footer className="verdict-modal-footer">
        <a className="secondary-button" href={`/api/series/${series.id}/export`} download>
          <Download size={16} />
          Exportar maratona
        </a>
        <button className="primary-button" onClick={onDismiss}>
          Ver detalhes
          <ArrowRight size={16} />
        </button>
      </footer>
    </dialog>
  );
}
