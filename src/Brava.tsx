import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  ArrowRight,
  AudioLines,
  Check,
  CircleHelp,
  Download,
  EyeOff,
  LoaderCircle,
  Minus,
  Scale,
  ShieldCheck,
  Square,
  Timer,
  TriangleAlert,
  Trophy,
  X,
} from 'lucide-react';
import type {
  BravaItem,
  BravaReport,
  BravaView,
  CompactResult,
  Grade,
  Perturbation,
  Provider,
} from '../shared/types';
import {
  providerNames,
  providerVendors,
  revealParticipants,
  roundNames,
} from '../shared/presentation';
import { useCountdown } from './Autopilot';
import { BarRows, CountUp, Section, seconds, usd } from './SeriesReport';

const pct = (v: number) => `${Math.round(v * 100)}%`;
const statusIcon: Record<Grade['status'], typeof Check> = {
  correct: Check,
  incorrect: TriangleAlert,
  uncertain: CircleHelp,
  unavailable: Minus,
};
const statusText: Record<Grade['status'], string> = {
  correct: 'acertou',
  incorrect: 'errou',
  uncertain: 'para revisão',
  unavailable: 'sem resposta',
};
const phaseText: Partial<Record<BravaView['phase'], string>> = {
  preparing: 'Opus prepara a abertura',
  running: 'Os modelos estão respondendo',
  commenting: 'Opus comenta a bateria',
  reporting: 'Opus escreve a leitura final',
};
const variantNames: Record<Perturbation, string> = {
  original: 'original',
  ordem: 'ordem',
  ruido: 'ruído',
  digitacao: 'digitação',
  direcao: 'evidência adicional',
};

function changesText(s: BravaReport['standings'][number]) {
  const all = Object.values(s.flips);
  if (!all.length) return '—';
  const changed = all.reduce((n, d) => n + d.changed, 0);
  const compared = all.reduce((n, d) => n + d.compared, 0);
  const away = all.reduce((n, d) => n + d.away, 0);
  return `${changed} de ${compared} · ${away} para pior`;
}
// A robustness answer that differs from the same model's answer to the original wording.
function flipped(brava: BravaView, item: BravaItem, p: Provider) {
  if (item.battery !== 'robustez' || item.variant === 'original') return false;
  const original = brava.results[`rob-${item.group}-original`]?.[p];
  const mine = brava.results[item.id]?.[p];
  return !!(original?.decision && mine?.decision && original.decision !== mine.decision);
}

function Tile({ result, flip, title }: { result?: CompactResult; flip: boolean; title: string }) {
  return (
    <span
      className={`brava-tile ${result ? `is-${result.status}` : 'is-pending'} ${flip ? 'is-flip' : ''}`}
      title={title}
    />
  );
}

// A rodada 3 photo, served from the local sample; a missing file leaves a note instead.
export function Photo({ item, className }: { item: BravaItem; className?: string }) {
  const [missing, setMissing] = useState(false);
  if (!item.image) return null;
  return missing ? (
    <p className="brava-hidden">
      <EyeOff size={14} /> Foto não baixada. Rode npm run imagens.
    </p>
  ) : (
    <img
      className={`brava-photo ${className ?? ''}`}
      src={`/api/images/${item.image.file}`}
      alt={`Foto da pergunta ${item.title}`}
      onError={() => setMissing(true)}
    />
  );
}

function ItemCard({ brava, item }: { brava: BravaView; item: BravaItem }) {
  return (
    <article className="brava-highlight" aria-live="polite">
      <span className="brava-highlight-kicker">
        {brava.batteries.find((b) => b.id === item.battery)?.title} · {item.title}
      </span>
      <h3>{item.question.text}</h3>
      {item.image ? (
        <Photo item={item} />
      ) : item.sensitive ? (
        <p className="brava-hidden">
          <EyeOff size={14} /> Comentário real do HateBR oculto: pode conter ofensas.
        </p>
      ) : (
        <p className="brava-facts">{item.facts}</p>
      )}
      <ul>
        {brava.providers.map((p) => {
          const r = brava.results[item.id]?.[p];
          const Icon = r ? statusIcon[r.status] : LoaderCircle;
          return (
            <li key={p} className={`ink-${p} ${r ? `status-${r.status}` : ''}`}>
              <span>{providerNames[p]}</span>
              <strong>{r?.label ?? '…'}</strong>
              <em>
                <Icon size={13} className={r ? '' : 'spin'} />{' '}
                {r ? statusText[r.status] : 'aguardando'}
              </em>
            </li>
          );
        })}
      </ul>
    </article>
  );
}

export function BravaLive({
  brava,
  busy,
  onCancel,
}: {
  brava: BravaView;
  busy: boolean;
  onCancel: () => void;
}) {
  const battery = brava.batteries[brava.currentBattery];
  const items = useMemo(
    () => battery.itemIds.map((id) => brava.items.find((i) => i.id === id)!),
    [battery, brava.items],
  );
  const countdown = useCountdown(brava.nextAt);
  const running = !['complete', 'cancelled', 'failed'].includes(brava.phase);
  // Rotates through the items where the models disagree, so the video shows what matters.
  const interesting = items.filter((i) => {
    const r = brava.results[i.id];
    return r && brava.providers.some((p) => r[p]?.status !== 'correct');
  });
  const answered = items.filter((i) => brava.providers.every((p) => brava.results[i.id]?.[p]));
  const pool = interesting.length ? interesting : answered;
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 3500);
    return () => clearInterval(timer);
  }, []);
  const featured = pool.length
    ? pool[(pool.length - 1 - (tick % Math.min(pool.length, 6)) + pool.length) % pool.length]
    : null;
  const comment = brava.comments[battery.id];
  const names = roundNames[brava.kind ?? 'brava'];
  const groups = useMemo(() => {
    const out: BravaItem[][] = [];
    for (const item of items) {
      const last = out.at(-1);
      if (last && item.group && last[0].group === item.group) last.push(item);
      else out.push([item]);
    }
    return out;
  }, [items]);
  return (
    <section
      className={`brava-live ${running ? 'is-running' : ''} ${brava.kind === 'visual' ? 'is-visual' : ''}`}
      aria-label={`${names.title} ao vivo`}
    >
      <div className="brava-head">
        <div>
          <span className="series-label">
            {brava.mode === 'demo' ? names.rehearsal : names.title} · Bateria{' '}
            {brava.currentBattery + 1} de {brava.batteries.length}
          </span>
          <h2>{battery.title}</h2>
          <p>{battery.description}</p>
        </div>
        <div className="brava-head-side">
          {running && (
            <span className="series-status" aria-live="polite">
              {countdown !== null ? (
                <Timer size={14} />
              ) : (
                <LoaderCircle size={14} className="spin" />
              )}
              {countdown !== null
                ? brava.currentBattery === 0 && !Object.keys(brava.results).length
                  ? `Começa em ${countdown} s`
                  : `Próxima bateria em ${countdown} s`
                : (phaseText[brava.phase] ?? '')}
            </span>
          )}
          {running && (
            <button className="quiet-button" disabled={busy} onClick={onCancel}>
              <Square size={12} />
              Encerrar rodada
            </button>
          )}
        </div>
      </div>
      <ol
        className="brava-steps"
        style={{ '--batteries': brava.batteries.length } as CSSProperties}
      >
        {brava.batteries.map((b, i) => {
          const done = b.itemIds.filter((id) =>
            brava.providers.every((p) => brava.results[id]?.[p]),
          ).length;
          // A finished round keeps pointing at its last battery, which is done too.
          const finished = i < brava.currentBattery || brava.phase === 'complete';
          return (
            <li
              key={b.id}
              className={finished ? 'done' : i === brava.currentBattery ? 'current' : 'next'}
            >
              <span className="series-step-title">
                {finished && <Check size={12} />}
                {b.title}
              </span>
              <span className="series-step-track">
                <span style={{ width: `${(done / b.itemIds.length) * 100}%` }} />
              </span>
            </li>
          );
        })}
      </ol>
      {brava.introduction && brava.currentBattery === 0 && !Object.keys(brava.results).length && (
        <p className="brava-intro">
          <AudioLines size={16} />
          {brava.introduction}
        </p>
      )}
      <div className="brava-board">
        <div className="brava-main">
          <div className="brava-grid" style={{ '--tiles': items.length } as CSSProperties}>
            {brava.providers.map((p) => {
              const results = items.map((i) => brava.results[i.id]?.[p]);
              const correct = results.filter((r) => r?.status === 'correct').length;
              const done = results.filter(Boolean).length;
              return (
                <div key={p} className={`brava-row ink-${p}`}>
                  <div className="brava-row-name">
                    <strong>{providerNames[p]}</strong>
                    <span>
                      <CountUp value={correct} format={(v) => String(Math.round(v))} /> / {done}
                    </span>
                  </div>
                  <div className="brava-tiles">
                    {groups.map((group, g) => (
                      <span key={g} className="brava-group">
                        {group.map((item) => (
                          <Tile
                            key={item.id}
                            result={brava.results[item.id]?.[p]}
                            flip={flipped(brava, item, p)}
                            title={`${providerNames[p]} · ${item.title}: ${brava.results[item.id]?.[p]?.label ?? 'aguardando'}`}
                          />
                        ))}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
            <ul className="brava-legend" aria-label="Legenda">
              <li>
                <span className="brava-tile is-correct" /> acertou
              </li>
              <li>
                <span className="brava-tile is-incorrect" /> errou
              </li>
              <li>
                <span className="brava-tile is-uncertain" /> para revisão
              </li>
              <li>
                <span className="brava-tile is-pending" /> aguardando
              </li>
              {battery.id === 'robustez' && (
                <li>
                  <span className="brava-tile is-correct is-flip" /> mudou de resposta
                </li>
              )}
            </ul>
          </div>
          {comment && (
            <section
              className="opus-panel has-feedback brava-comment"
              aria-label="Comentário do Opus"
            >
              <div className="opus-heading">
                <span className="opus-symbol">
                  <AudioLines size={21} />
                </span>
                <div>
                  <h2>{brava.mode === 'demo' ? 'Comentário de exemplo' : 'Opus 5.5'}</h2>
                  <span>Avaliador cego · bateria {battery.title}</span>
                </div>
              </div>
              <div className="opus-copy">
                <p>{revealParticipants(comment.text, comment.mapping)}</p>
                {comment.error && <p className="error-copy">{comment.error}</p>}
              </div>
            </section>
          )}
        </div>
        {featured && <ItemCard brava={brava} item={featured} />}
      </div>
      {brava.skipped?.map((s) => (
        <p key={s.battery} className="notice">
          {s.reason}
        </p>
      ))}
      {brava.error && <p className="notice error">{brava.error}</p>}
    </section>
  );
}

// Reliability diagram: stated confidence against the share of correct answers, per model.
function Calibration({ report }: { report: BravaReport }) {
  const W = 420;
  const H = 280;
  const pad = { l: 44, r: 20, t: 16, b: 40 };
  const x = (v: number) => pad.l + ((v - 0.5) / 0.5) * (W - pad.l - pad.r);
  const y = (v: number) => H - pad.b - v * (H - pad.t - pad.b);
  return (
    <figure className="calibration">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Diagrama de calibração">
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} className="calibration-grid" />
            <text x={pad.l - 8} y={y(v) + 4} textAnchor="end">
              {pct(v)}
            </text>
          </g>
        ))}
        {[0.5, 0.6, 0.7, 0.8, 0.9, 1].map((v) => (
          <text key={v} x={x(v)} y={H - pad.b + 18} textAnchor="middle">
            {pct(v)}
          </text>
        ))}
        <line x1={x(0.5)} y1={y(0.5)} x2={x(1)} y2={y(1)} className="calibration-ideal" />

        <text
          x={(pad.l + W - pad.r) / 2}
          y={H - 4}
          textAnchor="middle"
          className="calibration-note"
        >
          confiança declarada
        </text>
        {report.standings.map((s) => {
          const points = s.calibration.filter((b) => b.count);
          return (
            <g key={s.provider} className={`mark-${s.provider} calibration-series`}>
              <polyline
                points={points.map((b) => `${x(b.confidence)},${y(b.accuracy)}`).join(' ')}
              />
              {points.map((b) => (
                <circle key={b.from} cx={x(b.confidence)} cy={y(b.accuracy)} r={5}>
                  <title>
                    {`${providerNames[s.provider]}: disse ${pct(b.confidence)} em ${b.count} respostas e acertou ${pct(b.accuracy)}`}
                  </title>
                </circle>
              ))}
            </g>
          );
        })}
      </svg>
      <figcaption>
        <span className="calibration-ideal-key">
          <i /> linha ideal: confiança igual ao acerto
        </span>
        {report.standings.map((s) => (
          <span key={s.provider} className={`mark-${s.provider}`}>
            <i /> {providerNames[s.provider]} · erro de calibração{' '}
            {s.ece === null ? '—' : pct(s.ece)}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

export function BravaReportView({
  brava,
  summary = false,
}: {
  brava: BravaView;
  summary?: boolean;
}) {
  const report = brava.report!;
  const demo = brava.mode === 'demo';
  const visual = brava.kind === 'visual';
  const names = roundNames[brava.kind ?? 'brava'];
  const by = Object.fromEntries(report.standings.map((s) => [s.provider, s])) as Record<
    Provider,
    BravaReport['standings'][number]
  >;
  const winner = report.winner === 'tie' || report.winner === 'inconclusive' ? null : report.winner;
  const analysis = brava.analysis;
  const headline = analysis
    ? revealParticipants(analysis.headline, analysis.mapping)
    : demo
      ? `${names.rehearsal} concluído`
      : winner
        ? `${providerNames[winner]} vence a ${names.name}`
        : report.winner === 'tie'
          ? `Empate na ${names.name}`
          : `${names.title} sem vencedor declarado`;
  const reason = {
    points: 'Maior nota média nas baterias.',
    calibration: 'Notas na faixa de empate; desempate pelo Brier.',
    tie: 'Notas e Brier dentro das faixas de empate.',
    unavailable: 'Respostas ausentes poderiam mudar a liderança.',
  }[report.reason];
  const withinMargin = report.margins.filter((m) => m.within).map((m) => providerNames[m.vs]);
  const [all, setAll] = useState(false);
  const divergences = all ? report.divergences : report.divergences.slice(0, 8);
  return (
    <div
      className={`series-report brava-report ${demo ? 'is-demo' : ''} ${summary ? 'is-summary' : ''}`}
    >
      <div className="report-hero">
        <div className={`report-emblem ${winner ? `mark-${winner}` : ''}`} aria-hidden="true">
          {winner ? <Trophy size={40} strokeWidth={1.5} /> : <Scale size={40} strokeWidth={1.5} />}
        </div>
        <p className="report-kicker">
          {demo ? 'Ensaio sintético · ' : ''}
          {names.title} · {brava.batteries.length} baterias · {report.items}{' '}
          {visual ? 'fotos' : 'testes'} por modelo
        </p>
        <h2 id="brava-report-title">{headline}</h2>
        <p className="report-reason">
          {demo
            ? 'Respostas simuladas para conferir a apresentação. Nada aqui mede os modelos.'
            : `${winner ? `Vencedor: ${providerNames[winner]}. ` : ''}${reason}${
                winner && withinMargin.length
                  ? ` A diferença para ${withinMargin.join(' e ')} está dentro da margem de erro.`
                  : ''
              }`}
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
                {winner === p && <Trophy size={22} aria-label={`Vencedor da ${names.name}`} />}
              </header>
              <div className="podium-score">
                <strong>
                  <CountUp value={s.score * 100} format={(v) => String(Math.round(v))} />
                </strong>
                <span>/ 100</span>
              </div>
              <p className="podium-caption">nota média das baterias</p>
              <dl className="podium-metrics">
                {visual ? (
                  <>
                    <div>
                      <dt>Acertos</dt>
                      <dd>
                        {s.correct} de {s.total}
                      </dd>
                    </div>
                    <div>
                      <dt>Sem resposta</dt>
                      <dd>{s.unavailable}</dd>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <dt>Mudou de decisão</dt>
                      <dd>{changesText(s)}</dd>
                    </div>
                    <div>
                      <dt>Adivinhou sem dados</dt>
                      <dd>
                        {s.invented} de {s.abstentionItems}
                      </dd>
                    </div>
                  </>
                )}
                <div>
                  <dt>Brier · menor é melhor</dt>
                  <dd>
                    {s.brier === null
                      ? '—'
                      : s.brier.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}
                  </dd>
                </div>
                <div>
                  <dt>Erro de calibração</dt>
                  <dd>{s.ece === null ? '—' : pct(s.ece)}</dd>
                </div>
                <div>
                  <dt>API · estimativa por milhão</dt>
                  <dd>
                    {report.costPerMillion[p] !== undefined ? usd(report.costPerMillion[p]!) : '—'}
                  </dd>
                </div>
                <div>
                  <dt>Mediana de resposta</dt>
                  <dd>{s.medianMs === null ? '—' : seconds(s.medianMs)}</dd>
                </div>
              </dl>
            </article>
          );
        })}
      </div>

      {!summary && (
        <>
          {report.highlights.length > 0 && (
            <Section
              title="Quem foi melhor em quê"
              note="Frases geradas pelos números desta rodada, não por opinião."
            >
              <div className="recommendations">
                {report.highlights.map((h) => (
                  <article
                    key={h.kind}
                    className={`recommendation ${h.providers.length === 1 ? `ink-${h.providers[0]}` : 'is-tie'}`}
                  >
                    <Trophy size={20} />
                    <div>
                      <h4>{h.title}</h4>
                      <strong>
                        {h.providers.length === report.participants.length && h.providers.length > 1
                          ? 'Empate'
                          : h.providers.map((p) => providerNames[p]).join(' e ')}
                      </strong>
                      <p>{h.text}</p>
                    </div>
                  </article>
                ))}
              </div>
            </Section>
          )}

          <div className="report-charts">
            <Section
              title="Nota por bateria"
              note={
                visual
                  ? 'Cada bateria conta fotos. No chute, a contagem acerta de 17% a 25%; as demais, 50%.'
                  : 'Robustez e negação contam grupos inteiros; as demais, itens.'
              }
            >
              <div className="battery-grid">
                {report.batteries.map((b) => (
                  <div key={b.id} className="battery">
                    <h4>
                      {b.title}{' '}
                      <span>
                        {b.units} {b.unit === 'grupo' ? 'grupos' : 'itens'}
                      </span>
                    </h4>
                    <BarRows
                      report={report}
                      value={(p) => b.scores[p]}
                      max={1}
                      label={(p) => pct(b.scores[p])}
                      tip={(p) => `${providerNames[p]} · ${b.title}: ${pct(b.scores[p])}`}
                    />
                  </div>
                ))}
              </div>
            </Section>
            <div className="report-side">
              <Section
                title="Quando disse X%, acertou quanto?"
                note="Cada ponto agrupa respostas pela confiança. Na linha ideal, a confiança coincide com a frequência de acerto observada."
              >
                <Calibration report={report} />
              </Section>
              {!visual && (
                <Section
                  title="Mudanças de decisão por variante"
                  note="Ordem, ruído e digitação alteram a forma; evidência adicional acrescenta informação favorável. Entre parênteses, mudanças para longe do gabarito. Sem controle de repetição idêntica."
                >
                  <div className="battery-grid">
                    {(['ordem', 'ruido', 'digitacao', 'direcao'] as const).map((v) => (
                      <div key={v} className="battery">
                        <h4>{variantNames[v]}</h4>
                        <BarRows
                          report={report}
                          value={(p) => by[p].flipRate[v]}
                          max={Math.max(0.1, ...report.standings.map((s) => s.flipRate[v] ?? 0))}
                          label={(p) =>
                            `${pct(by[p].flipRate[v] ?? 0)} (${by[p].flips[v]?.away ?? 0} ↓)`
                          }
                          tip={(p) =>
                            `${providerNames[p]} mudou de decisão em ${by[p].flips[v]?.changed ?? 0} de ${by[p].flips[v]?.compared ?? 0} perguntas (${variantNames[v]}): ${by[p].flips[v]?.toward ?? 0} rumo ao gabarito, ${by[p].flips[v]?.away ?? 0} para longe`
                          }
                        />
                      </div>
                    ))}
                  </div>
                </Section>
              )}
            </div>
          </div>

          {report.round1 && (
            <Section
              title="Duas provas, critérios diferentes"
              note="Maratona: acertos individuais. Resiliência: média das baterias, algumas por grupo inteiro. A diferença entre as medidas não indica evolução do modelo."
            >
              <div className="round-compare">
                {report.participants.map((p) => (
                  <div key={p} className={`round-compare-row mark-${p} ink-${p}`}>
                    <span>{providerNames[p]}</span>
                    <span>Maratona: {pct(report.round1!.accuracy[p])} de acertos</span>
                    <strong>Resiliência: {pct(by[p].score)} de nota</strong>
                  </div>
                ))}
              </div>
            </Section>
          )}

          <Section
            title="Casos sem acerto unânime"
            note={`${report.divergences.length} de ${report.items} testes sem acerto unânime.`}
          >
            <ol className={`divergence-list ${visual ? 'is-visual' : ''}`}>
              {divergences.map((d) => (
                <li key={d.itemId}>
                  <div className="divergence-question">
                    <span>
                      {brava.batteries.find((b) => b.id === d.battery)?.title} · {d.title}
                    </span>
                    <p>{d.question}</p>
                    {visual ? (
                      <Photo
                        item={brava.items.find((i) => i.id === d.itemId)!}
                        className="is-thumb"
                      />
                    ) : d.facts ? (
                      <p className="divergence-facts">{d.facts}</p>
                    ) : (
                      <p className="brava-hidden">
                        <EyeOff size={13} /> Texto real oculto: pode conter ofensas.
                      </p>
                    )}
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
            {report.divergences.length > 8 && (
              <button className="text-button" onClick={() => setAll(!all)}>
                {all ? 'Mostrar menos' : `Mostrar todos os ${report.divergences.length}`}
              </button>
            )}
          </Section>

          {(analysis || brava.analysisError) && (
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
                <p className="error-copy">{brava.analysisError}</p>
              )}
            </Section>
          )}

          {report.annulled.length > 0 && (
            <Section
              title="Itens anulados"
              note="Ficam no registro e na exportação, mas fora da nota de todos os modelos."
            >
              <ul className="annulled-list">
                {report.annulled.map((a) => (
                  <li key={a.itemId}>
                    <strong>
                      {a.itemId} · {a.title}
                    </strong>
                    <span>{a.reason}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <p className="report-caveat">
            <ShieldCheck size={15} />
            {visual ? (
              <span>
                Fotos e gabaritos do CV-Bench (anotações Apache-2.0; fotos de ADE20K, COCO e
                Omni3D), público desde 2024 e possivelmente presente nos dados de treino. Perguntas
                vertidas para o português por frases-padrão, mantendo as alternativas do dataset. Só
                participam os modelos cujas APIs aceitam imagens. Nota geral: média simples das
                baterias; empate abaixo de 1 ponto é desempatado pelo Brier. Margem: intervalo de
                95% por bootstrap. Custo estimado da API só por tokens de entrada, sem Opus,
                infraestrutura, revisão humana ou cotas gratuitas; latência inclui rede e o envio da
                foto.
              </span>
            ) : (
              <span>
                Robustez reaproveita as perguntas da rodada 1; abstenção, negação e injeção foram
                escritas antes de consultar os modelos; português real usa rótulos humanos de ASSIN
                2, HateBR (CC BY-NC 4.0) e B2W-Reviews01 (CC BY-NC-SA 4.0), que podem estar nos
                dados de treino. Nota geral: média simples das baterias; empate abaixo de 1 ponto é
                desempatado pelo Brier. Margem: intervalo de 95% por bootstrap. Revisão é uma
                classificação da arena para probabilidades entre 20% e 80%, não um pedido do modelo.
                Custo estimado da API só por tokens de entrada, sem Opus, infraestrutura, revisão
                humana ou cotas gratuitas; latência inclui rede.
              </span>
            )}
          </p>
        </>
      )}
    </div>
  );
}

export function BravaReportDialog({
  brava,
  open,
  onDismiss,
}: {
  brava: BravaView;
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
      aria-labelledby="brava-report-title"
      onCancel={(e) => {
        e.preventDefault();
        onDismiss();
      }}
    >
      <button className="verdict-close" aria-label="Fechar boletim" onClick={onDismiss}>
        <X size={22} />
      </button>
      <div className="series-dialog-content">{open && <BravaReportView brava={brava} />}</div>
      <footer className="verdict-modal-footer">
        <a className="secondary-button" href={`/api/bravas/${brava.id}/export`} download>
          <Download size={16} />
          Exportar {roundNames[brava.kind ?? 'brava'].name}
        </a>
        <button className="primary-button" onClick={onDismiss}>
          Ver detalhes
          <ArrowRight size={16} />
        </button>
      </footer>
    </dialog>
  );
}
