import { Check, Clock3, Minus, TriangleAlert, CircleHelp, LoaderCircle } from 'lucide-react';
import type { Provider, ProviderResult, Question, Run } from '../shared/types';
import { metrics } from '../shared/scoring';
export { providerNames as names } from '../shared/presentation';
import { answerLabel, providerNames as names, providerVendors } from '../shared/presentation';
export const money = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 5,
    maximumFractionDigits: 5,
  }).format(value);
export function Competitor({
  provider,
  run,
  result,
  question,
  pending,
}: {
  provider: Provider;
  run: Run | null;
  result?: ProviderResult;
  question: Question;
  pending: boolean;
}) {
  const m = run ? metrics(run, provider) : null;
  const a = result?.answer;
  const label = answerLabel(question, a);
  const grade = result?.grade.status;
  const gradeText =
    grade === 'correct'
      ? 'Aderente ao gabarito · +1 ponto'
      : grade === 'incorrect'
        ? 'Diverge do gabarito · 0 pontos'
        : grade === 'uncertain'
          ? 'Revisão humana · 0 pontos'
          : 'Sem decisão · 0 pontos';
  const GradeIcon =
    grade === 'correct'
      ? Check
      : grade === 'incorrect'
        ? TriangleAlert
        : grade === 'uncertain'
          ? CircleHelp
          : Minus;
  return (
    <section className={`competitor ${provider}`} aria-label={`Resultados ${names[provider]}`}>
      <header className="competitor-heading">
        <div className="competitor-identity">
          <span className="team-symbol" aria-hidden="true">
            {names[provider][0]}
          </span>
          <div>
            <h2>{names[provider]}</h2>
            <span>{providerVendors[provider]}</span>
          </div>
        </div>
        <div className="score">
          <strong>{m?.correct ?? 0}</strong>
          <span>
            pontos <small>/ {m?.total ?? 0} rodadas</small>
          </span>
        </div>
      </header>
      <div
        className="answer-area"
        key={`${question.id}-${a ? 'answer' : result?.error ? 'error' : 'empty'}`}
      >
        {pending && !result ? (
          <div className="answer-empty">
            <LoaderCircle className="spin" size={26} />
            <h3>Avaliando a pergunta</h3>
            <p>Aguardando a resposta do provedor.</p>
          </div>
        ) : result?.error ? (
          <div className="answer-empty error-copy">
            <TriangleAlert size={26} />
            <h3>Resposta indisponível</h3>
            <p>{result.error}</p>
          </div>
        ) : a ? (
          <>
            <div className={`result-tag ${grade}`}>
              <GradeIcon size={15} />
              {gradeText}
            </div>
            <h3 className="answer-value">{label}</h3>
            {a.type === 'score' && (
              <p className="score-explanation">
                Média ponderada dos níveis; não é uma porcentagem.
              </p>
            )}
            <div className="probabilities">
              {a.probabilities.map((p) => (
                <div className="probability" key={p.value}>
                  <div>
                    <span>{p.label}</span>
                    <span>
                      {(p.probability * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
                    </span>
                  </div>
                  <div className="probability-track">
                    <div style={{ width: `${p.probability * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <p className="consequence">{result.grade.effect}</p>
          </>
        ) : (
          <div className="answer-empty">
            <div className="empty-dash">—</div>
            <h3>Pronto para decidir</h3>
            <p>
              O mesmo contexto.
              <br />A mesma pergunta. Uma decisão independente.
            </p>
          </div>
        )}
      </div>
      <footer className="competitor-metrics">
        <div>
          <span>
            <Clock3 size={13} /> Resposta
          </span>
          <strong>
            {run?.mode === 'demo'
              ? 'Sintética'
              : result
                ? `${Math.round(result.durationMs)} ms`
                : '—'}
          </strong>
        </div>
        <div>
          <span>Confiança declarada</span>
          <strong>
            {a?.confidence !== undefined ? `${Math.round(a.confidence * 100)}%` : '—'}
          </strong>
        </div>
        <div>
          <span>Custo acumulado</span>
          <strong>
            {run?.mode === 'demo'
              ? 'US$ 0'
              : m
                ? `${money(m.costUsd)}${m.unknownCosts ? ' + ?' : ''}`
                : '—'}
          </strong>
        </div>
      </footer>
    </section>
  );
}
