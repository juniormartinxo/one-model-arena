import { ArrowUpRight } from 'lucide-react';
import { conclusion, reportPath } from '../content/conclusion';
import { models } from '../content/catalog';

export function Conclusion() {
  return (
    <section
      className="conclusion-section section-shell"
      id="conclusao"
      aria-labelledby="conclusion-title"
    >
      <div className="section-heading">
        <h2 id="conclusion-title">
          O melhor modelo
          <br />
          <span>depende da decisão.</span>
        </h2>
        <p>
          O Clef venceu as três provas pelas regras da arena. Isso não o torna a escolha mais
          econômica em todas as tarefas.
        </p>
      </div>
      <p className="conclusion-totals">{conclusion.totals}</p>
      <div className="conclusion-profiles">
        {conclusion.profiles.map((p) => {
          const model = models[p.provider];
          return (
            <article key={p.provider} style={{ borderTopColor: model.color }}>
              <header>
                <span className="participant-symbol" style={{ color: model.color }}>
                  {model.mark}
                </span>
                <div>
                  <h3>{model.name}</h3>
                  <span>{p.role}</span>
                </div>
              </header>
              <p className="conclusion-figure">
                <strong>{p.figure}</strong>
                <span>{p.figureLabel}</span>
              </p>
              <p>{p.text}</p>
            </article>
          );
        })}
      </div>
      <div className="situations">
        <h3>Qual escolher para cada situação?</h3>
        <p className="situations-intro">
          Candidatos para começar um piloto, derivados desta edição. A preferência depende do custo
          do erro, da revisão humana e da tarefa real.
        </p>
        <ul>
          {conclusion.situations.map((s) => (
            <li key={s.situation}>
              <span className="situation-area">{s.area}</span>
              <strong className="situation-name">{s.situation}</strong>
              <span className="situation-picks">
                {s.picks.map((p) => (
                  <span key={p} style={{ color: models[p].color }}>
                    {models[p].name}
                  </span>
                ))}
              </span>
              <p>{s.evidence}</p>
            </li>
          ))}
        </ul>
      </div>
      <div className="conclusion-cta">
        <div>
          <h3>Escolha o modelo para a tarefa. Valide no seu domínio.</h3>
          <p>
            Use estes resultados para reduzir a lista de candidatos. {conclusion.untested} Não
            extrapole para essas tarefas.
          </p>
        </div>
        <a className="button button-primary" href={reportPath}>
          Abrir o relatório completo <ArrowUpRight size={17} />
        </a>
      </div>
    </section>
  );
}
