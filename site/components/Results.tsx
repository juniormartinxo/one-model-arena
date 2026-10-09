import { useState, type KeyboardEvent } from 'react';
import { ArrowDownToLine, ArrowUpRight, Check, Clock3 } from 'lucide-react';
import type { Publication, PublicResult } from '../../shared/publication';
import { models, tests, type TestKind } from '../content/catalog';

export const percent = (n: number) =>
  `${(n * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
const number = (n: number | null, digits = 3) =>
  n === null ? '—' : n.toLocaleString('pt-BR', { maximumFractionDigits: digits });
const money = (n: number | null) =>
  n === null ? 'Não informado' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'USD' });
export function tabKeys(event: KeyboardEvent<HTMLElement>) {
  if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key))
    return;
  const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
  if (i < 0) return;
  event.preventDefault();
  const next =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? buttons.length - 1
        : (i + (['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1) + buttons.length) %
          buttons.length;
  buttons[next]?.focus();
  buttons[next]?.click();
}
function PublishedResult({ result }: { result: PublicResult }) {
  const winner =
    result.winner === 'tie' || result.winner === 'inconclusive' ? null : models[result.winner];
  const near = result.margins.filter((m) => m.within).map((m) => models[m.vs].name);
  return (
    <>
      <div className="result-verdict">
        <span className="status-dot" />
        <p>
          {winner ? (
            <>
              <strong>{winner.name}</strong> lidera{' '}
              {result.reason === 'calibration' ? 'pelo desempate por Brier' : 'pela pontuação'}.
            </>
          ) : result.winner === 'tie' ? (
            'Empate pelos critérios desta edição.'
          ) : (
            'Respostas ausentes impedem declarar um vencedor.'
          )}
          {near.length > 0 && (
            <span> Diferença dentro da margem de erro em relação a {near.join(' e ')}.</span>
          )}
        </p>
      </div>
      <div
        className="result-table-wrap"
        tabIndex={0}
        role="region"
        aria-label="Comparação dos resultados"
      >
        <table className="result-table">
          <caption>
            Resultado geral ·{' '}
            {new Date(result.executedAt).toLocaleDateString('pt-BR', {
              timeZone: 'America/Sao_Paulo',
            })}
          </caption>
          <thead>
            <tr>
              <th>Modelo</th>
              <th>{result.kind === 'maratona' ? 'Acerto' : 'Nota média'}</th>
              <th>
                Brier <span>↓ melhor</span>
              </th>
              <th>Mediana</th>
            </tr>
          </thead>
          <tbody>
            {result.standings.map((s) => (
              <tr key={s.provider}>
                <th scope="row">
                  <span className="model-name" style={{ color: models[s.provider].color }}>
                    {models[s.provider].name}
                  </span>
                  <small>{models[s.provider].vendor}</small>
                </th>
                <td className="result-score">{percent(s.score)}</td>
                <td>{number(s.brier)}</td>
                <td>{s.medianMs === null ? '—' : `${number(s.medianMs / 1000, 2)} s`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <details className="result-details">
        <summary>
          Ver métricas, baterias e ressalvas <ArrowUpRight size={16} />
        </summary>
        <div className="battery-results">
          {result.batteries.map((b) => (
            <section key={b.id}>
              <h4>
                {b.title}
                <small>
                  {b.units} {b.unit === 'grupo' ? 'grupos' : 'itens'}
                </small>
              </h4>
              {b.scores.map((s) => (
                <div className="battery-line" key={s.provider}>
                  <span>{models[s.provider].name}</span>
                  <span className="battery-bar">
                    <i style={{ width: percent(s.score), background: models[s.provider].color }} />
                  </span>
                  <strong>{percent(s.score)}</strong>
                </div>
              ))}
            </section>
          ))}
        </div>
        <div className="secondary-metrics">
          {result.standings.map((s) => (
            <div key={s.provider}>
              <h4>{models[s.provider].name}</h4>
              <p>
                {s.correct} acertos em {s.total} itens; {s.incorrect} erros, {s.uncertain} respostas
                marcadas para revisão e {s.unavailable} sem resposta.
              </p>
              <p>
                ECE: {s.ece === null ? 'não calculado nesta prova' : percent(s.ece)}. Custo estimado
                da API por milhão de decisões: {money(s.costPerMillion)}
                {s.unknownCosts ? ` (${s.unknownCosts} custos ausentes)` : ''}.
              </p>
              <p className="model-versions">Versão registrada: {s.models.join(', ')}</p>
            </div>
          ))}
        </div>
        {result.margins.length > 0 && (
          <div className="margin-notes">
            <h4>Intervalos de 95% da diferença</h4>
            {result.margins.map((m) => (
              <p key={m.vs}>
                Liderança × {models[m.vs].name}: {number(m.low * 100, 1)} a{' '}
                {number(m.high * 100, 1)} pontos percentuais.{' '}
                {m.within
                  ? 'Inclui zero: diferença inconclusiva.'
                  : 'Não inclui zero neste recorte.'}
              </p>
            ))}
          </div>
        )}
        {result.annulled.length > 0 && (
          <div className="margin-notes">
            <h4>Itens anulados</h4>
            {result.annulled.map((a) => (
              <p key={a.itemId}>
                <strong>{a.itemId}</strong> — {a.reason}
              </p>
            ))}
          </div>
        )}
        {result.excludedBatteries.length > 0 && (
          <p>Baterias não executadas: {result.excludedBatteries.join(', ')}.</p>
        )}
        <p className="fine-print">
          Latência inclui rede. Custo considera tokens de entrada. Indisponibilidade é registrada
          separadamente de erro semântico.
        </p>
      </details>
    </>
  );
}
export function Results({
  publication,
  error,
}: {
  publication: Publication | null;
  error: boolean;
}) {
  const [active, setActive] = useState<TestKind>('maratona');
  const test = tests.find((t) => t.id === active)!;
  const result =
    publication?.status === 'published'
      ? publication.edition.results.find((r) => r.kind === active)
      : undefined;
  return (
    <section
      className="results-section section-shell"
      id="resultados"
      aria-labelledby="results-title"
    >
      <div className="section-heading">
        <h2 id="results-title">
          Três provas.
          <br />
          <span>Um método à vista.</span>
        </h2>
        <p>
          O que um modelo faz bem depende do desafio.
          <br />
          Explore cada teste e os critérios da comparação.
        </p>
      </div>
      <div className="test-tabs" role="tablist" aria-label="Tipo de teste" onKeyDown={tabKeys}>
        {tests.map((t, i) => (
          <button
            key={t.id}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={active === t.id}
            aria-controls={`panel-${t.id}`}
            tabIndex={active === t.id ? 0 : -1}
            onClick={() => setActive(t.id)}
          >
            <span>0{i + 1}</span>
            {t.name}
            <ArrowUpRight size={19} />
          </button>
        ))}
      </div>
      <div
        className="test-panel"
        id={`panel-${active}`}
        role="tabpanel"
        aria-labelledby={`tab-${active}`}
        tabIndex={0}
        key={active}
      >
        <div className="test-description">
          <h3>{test.title}</h3>
          <p>{test.description}</p>
          <ul className="battery-tags" aria-label="Baterias">
            {test.batteries.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
          <p className="test-scoring">
            <Check size={16} />
            {test.scoring}
          </p>
          <details className="text-details">
            <summary>Conhecer o recorte</summary>
            <p>{test.detail}</p>
          </details>
        </div>
        <div className="test-results">
          {result ? (
            <PublishedResult result={result} />
          ) : (
            <>
              <div className="pending-result">
                <Clock3 size={22} strokeWidth={1.4} />
                <h3>
                  {error
                    ? 'Resultados indisponíveis no momento.'
                    : !publication
                      ? 'Consultando a edição.'
                      : 'A próxima edição está em preparação.'}
                </h3>
                <p>
                  {error
                    ? 'Não foi possível carregar o arquivo de resultados. O método e as fontes continuam disponíveis nesta página.'
                    : 'Novas execuções serão conferidas antes da publicação. Cada resultado virá acompanhado do seu contexto e das suas limitações.'}
                </p>
              </div>
              <div className="pending-models" aria-label="Participantes previstos">
                {test.providers.map((p) => (
                  <div key={p}>
                    <span className="model-monogram" style={{ color: models[p].color }}>
                      {models[p].mark}
                    </span>
                    <span>
                      <strong>{models[p].name}</strong>
                      <small>{models[p].vendor}</small>
                    </span>
                    <span className="pending-state">
                      {error ? 'Indisponível' : 'Aguardando edição'}
                    </span>
                  </div>
                ))}
              </div>
              <a className="inline-link" href="#metodo">
                Entenda como será avaliado <ArrowUpRight size={16} />
              </a>
            </>
          )}
        </div>
      </div>
      {publication?.status === 'published' && (
        <div className="edition-line">
          <span>
            {publication.edition.title} · preparada em{' '}
            {new Date(publication.edition.preparedAt).toLocaleDateString('pt-BR', {
              timeZone: 'America/Sao_Paulo',
            })}
          </span>
          <a
            className="inline-link"
            href="/data/edition.json"
            download={`arena-${publication.edition.id}.json`}
          >
            <ArrowDownToLine size={16} /> Baixar dados desta edição
          </a>
        </div>
      )}
    </section>
  );
}
