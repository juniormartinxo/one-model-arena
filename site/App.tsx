import { useEffect, useState } from 'react';
import { Analytics } from '@vercel/analytics/react';
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  Download,
  Code2,
  Menu,
  X,
} from 'lucide-react';
import { publicationSchema, type Publication } from '../shared/publication';
import { ArenaSculpture } from './components/ArenaSculpture';
import { Conclusion } from './components/Conclusion';
import { Method } from './components/Method';
import { Results } from './components/Results';
import { author, datasets, models, repository, tests } from './content/catalog';
import { reportPath } from './content/conclusion';

const navigation = [
  { href: '#conclusao', label: 'A conclusão' },
  { href: '#resultados', label: 'Os testes' },
  { href: '#metodo', label: 'O método' },
  { href: '#datasets', label: 'Os datasets' },
  { href: '#sobre', label: 'Sobre a Arena' },
];
const metrics = [
  [
    'Acerto e nota',
    'A Maratona de reuniões conta acertos. Nas outras provas, cada bateria tem o mesmo peso na nota média. Robustez e negação exigem grupos inteiros. As notas de provas diferentes não medem evolução do modelo.',
  ],
  [
    'Brier e calibração',
    'O Brier mede a distância entre probabilidades e gabarito. O ECE agrupa previsões por confiança e compara confiança com acerto. São medidas diferentes.',
  ],
  [
    'Margem de erro',
    'Na Resiliência e nas imagens, o bootstrap pareado reamostra grupos e itens. Se o intervalo de 95% da diferença inclui zero, a liderança deve ser lida com cautela.',
  ],
  [
    'Tempo e custo',
    'A mediana inclui a rede até cada API. O custo estimado da API considera tokens de entrada, sem Opus, infraestrutura, revisão humana ou cotas gratuitas. Valores ausentes são informados.',
  ],
];
function Sources() {
  return (
    <section
      className="dataset-section section-shell"
      id="datasets"
      aria-labelledby="datasets-title"
    >
      <div className="section-heading">
        <h2 id="datasets-title">
          A evidência
          <br />
          <span>tem origem.</span>
        </h2>
        <p>
          Conheça as fontes, a seleção das amostras
          <br />e o que cada conjunto permite observar.
        </p>
      </div>
      <div className="dataset-list">
        {datasets.map((d) => (
          <details key={d.name} className="dataset-row">
            <summary>
              <span className="dataset-name">{d.name}</span>
              <span className="dataset-category">{d.category}</span>
              <span className="dataset-year">{d.year}</span>
              <span className="dataset-expand">
                <ChevronDown size={21} />
              </span>
            </summary>
            <div className="dataset-content">
              <div>
                <p>{d.description}</p>
                <p>{d.sampling}</p>
              </div>
              <div>
                <h3>Fonte e atribuição</h3>
                <p>{d.license}</p>
                <p className="dataset-citation">{d.citation}</p>
                <div className="source-links">
                  <a href={d.url} target="_blank" rel="noreferrer">
                    Consultar a fonte <ArrowUpRight size={15} />
                  </a>
                  <a href={`${repository}/blob/main/${d.sample}`} target="_blank" rel="noreferrer">
                    Ver seleção das amostras <ArrowUpRight size={15} />
                  </a>
                </div>
              </div>
            </div>
          </details>
        ))}
      </div>
      <p className="dataset-footnote">
        Fotografias e comentários do HateBR permanecem nas fontes de origem. O relatório da
        conclusão reproduz os pares do ASSIN 2 e as avaliações do B2W usados nas perguntas, com as
        respostas dos modelos e a atribuição de cada fonte.
      </p>
    </section>
  );
}
function Evidence({ publication }: { publication: Publication | null }) {
  const edition = publication?.status === 'published' ? publication.edition : null;
  return (
    <section
      className="evidence-section section-shell"
      id="evidencias"
      aria-labelledby="evidence-title"
    >
      <div>
        <h2 id="evidence-title">
          Você não precisa
          <br />
          <span>ficar só com o placar.</span>
        </h2>
        <p>
          O código mostra como cada ponto é calculado. Cada edição publicada inclui sua origem, as
          regras usadas e as referências das amostras.
        </p>
        <a
          className="button button-outline"
          href={`${repository}/tree/main/shared`}
          target="_blank"
          rel="noreferrer"
        >
          Examinar as regras <ArrowUpRight size={17} />
        </a>
      </div>
      <div className="evidence-ledger">
        <div>
          <span>Código do experimento</span>
          <a href={repository} target="_blank" rel="noreferrer">
            Aberto no GitHub <ArrowUpRight size={15} />
          </a>
        </div>
        <div>
          <span>Gabaritos e pontuação</span>
          <a href={`${repository}/blob/main/shared/scoring.ts`} target="_blank" rel="noreferrer">
            Critérios verificáveis <ArrowUpRight size={15} />
          </a>
        </div>
        <div>
          <span>Edição pública</span>
          <strong>{edition ? edition.title : 'Em preparação'}</strong>
        </div>
        <div>
          <span>Relatório da conclusão</span>
          <a href={reportPath}>
            Respostas, exemplos e contas <ArrowUpRight size={15} />
          </a>
        </div>
        {edition && (
          <>
            <div>
              <span>Dados agregados</span>
              <a href="/data/edition.json" download={`arena-${edition.id}.json`}>
                Baixar JSON <Download size={15} />
              </a>
            </div>
            <details className="provenance">
              <summary>
                Identificar esta edição <ChevronDown size={15} />
              </summary>
              <dl>
                <dt>Revisão do código</dt>
                <dd>
                  <code>{edition.codeRevision}</code>
                </dd>
                <dt>SHA-256 das regras</dt>
                <dd>
                  <code>{edition.rulesHash}</code>
                </dd>
                {edition.results.map((r) => (
                  <div key={r.sourceId}>
                    <dt>{tests.find((test) => test.id === r.kind)?.name} · execução de origem</dt>
                    <dd>
                      <code>{r.sourceId}</code>
                    </dd>
                    <dt>Catálogos</dt>
                    {r.catalogHashes.map((hash, i) => (
                      <dd key={`${i}-${hash}`}>
                        <code>{hash}</code>
                      </dd>
                    ))}
                  </div>
                ))}
              </dl>
            </details>
          </>
        )}
      </div>
    </section>
  );
}
function Limits() {
  return (
    <section className="limits-section section-shell" id="limites" aria-labelledby="limits-title">
      <div className="section-heading">
        <h2 id="limits-title">
          Toda conclusão
          <br />
          <span>tem um alcance.</span>
        </h2>
        <p>
          Este é um recorte de tarefas em português.
          <br />
          Os resultados não formam um ranking universal.
        </p>
      </div>
      <div className="limits-grid">
        <div className="metrics-glossary">
          {metrics.map(([title, text]) => (
            <details key={title}>
              <summary>
                {title}
                <ChevronDown size={17} />
              </summary>
              <p>{text}</p>
            </details>
          ))}
        </div>
        <div className="limits-copy">
          <h3>Transparência também é mostrar os limites.</h3>
          <p>
            Datasets públicos podem ter aparecido no treinamento dos modelos. Amostras pequenas e
            discordâncias entre anotadores limitam as conclusões.
          </p>
          <p>
            Itens autorais têm gabaritos definidos pelo experimento. Itens anulados saem da nota de
            todos os participantes e são identificados na edição, com o motivo.
          </p>
          <p>
            Uma mudança nas regras pode alterar a pontuação sem mudar as respostas. Por isso, os
            resultados públicos ficam vinculados à revisão que os gerou. Comentários antigos da IA
            não substituem esses números.
          </p>
          <a
            className="inline-link"
            href={`${repository}/blob/main/docs/o-que-foi-feito.md`}
            target="_blank"
            rel="noreferrer"
          >
            Ler as decisões metodológicas <ArrowUpRight size={16} />
          </a>
        </div>
      </div>
    </section>
  );
}
export function PublicApp() {
  const [menu, setMenu] = useState(false);
  const [publication, setPublication] = useState<Publication | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/data/edition.json', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Edição indisponível');
        return publicationSchema.parse(await response.json());
      })
      .then(setPublication)
      .catch((e) => {
        if (e.name !== 'AbortError') setError(true);
      });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  return (
    <>
      <a className="skip-link" href="#conteudo">
        Ir para o conteúdo
      </a>
      <header className="public-header">
        <div className="header-inner">
          <a href="#inicio" className="public-brand" aria-label="One Model Arena — início">
            <img src="/brand/one-model-arena-96.png" width="34" height="34" alt="" />
            <span>
              One Model <strong>Arena</strong>
              <i>.</i>
            </span>
          </a>
          <button
            className="menu-toggle"
            aria-label={menu ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={menu}
            aria-controls="public-navigation"
            onClick={() => setMenu((v) => !v)}
          >
            {menu ? <X size={23} /> : <Menu size={23} />}
          </button>
          <nav
            id="public-navigation"
            className={menu ? 'is-open' : ''}
            aria-label="Navegação principal"
          >
            {navigation.map((n) => (
              <a href={n.href} key={n.href} onClick={() => setMenu(false)}>
                {n.label}
              </a>
            ))}
            <a
              className="repository-link"
              href={repository}
              target="_blank"
              rel="noreferrer"
              aria-label="Código no GitHub"
            >
              <Code2 size={18} />
              <span>GitHub</span>
              <ArrowUpRight size={14} />
            </a>
          </nav>
        </div>
      </header>
      <main id="conteudo">
        <section className="hero section-shell" id="inicio" aria-labelledby="hero-title">
          <div className="hero-copy">
            <h1 id="hero-title">
              Modelos.
              <br />
              <span>À prova.</span>
            </h1>
            <p className="hero-statement">
              A mesma pergunta.
              <br />O que muda é a resposta.
            </p>
            <p className="hero-description">
              Uma arena para comparar decisões de IA em português. Testes visíveis, critérios
              explícitos e espaço para olhar além do vencedor. A primeira edição está concluída.
            </p>
            <div className="hero-actions">
              <a className="button button-primary" href="#conclusao">
                Ver a conclusão <ArrowDown size={17} />
              </a>
              <a className="hero-method-link" href={reportPath}>
                Abrir o relatório completo <ArrowUpRight size={17} />
              </a>
            </div>
          </div>
          <ArenaSculpture />
          <div className="hero-bottom">
            <span>Três modelos. A mesma régua.</span>
            <a href="#conclusao" aria-label="Continuar para a conclusão">
              <ArrowDown size={17} />
            </a>
          </div>
        </section>
        <div className="participants section-shell" aria-label="Modelos participantes">
          {Object.entries(models).map(([id, model]) => (
            <div key={id}>
              <span className="participant-symbol" style={{ color: model.color }}>
                {model.mark}
              </span>
              <div>
                <strong>{model.name}</strong>
                <span>{model.vendor}</span>
              </div>
              <small>{id === 'jev' ? 'Decisões estruturadas' : 'Decisões e imagens'}</small>
            </div>
          ))}
        </div>
        <Conclusion />
        <Results publication={publication} error={error} />
        <Method />
        <Sources />
        <Evidence publication={publication} />
        <Limits />
        <section className="about-section" id="sobre" aria-labelledby="about-title">
          <div className="section-shell">
            <div className="about-mark" aria-hidden="true">
              <img
                src="/brand/one-model-arena.png"
                width="130"
                height="130"
                alt=""
                loading="lazy"
              />
            </div>
            <figure className="author-portrait">
              <img
                src={author.portrait}
                width="720"
                height="900"
                alt={`Retrato ilustrado de ${author.name}`}
                loading="lazy"
              />
              <figcaption>
                <strong>{author.name}</strong>
                <span>Criador do One Model Arena</span>
              </figcaption>
            </figure>
            <div className="about-copy">
              <h2 id="about-title">
                A melhor resposta
                <br />
                começa com uma
                <br />
                <span>boa pergunta.</span>
              </h2>
              <p>
                One Model Arena é um experimento de comparação de modelos de IA. Este site reúne a
                parte pública: o que foi testado, como foi avaliado e o que é possível concluir.
              </p>
              <p>
                {author.name} criou a arena e conduz as rodadas, a curadoria dos testes e a leitura
                dos resultados. O objetivo é abrir a comparação para quem quer entender as escolhas
                por trás dos números.
              </p>
              <div className="about-actions">
                <a
                  className="button button-outline"
                  href={repository}
                  target="_blank"
                  rel="noreferrer"
                >
                  Conheça o projeto <ArrowUpRight size={17} />
                </a>
                <a className="hero-method-link" href={author.site} target="_blank" rel="noreferrer">
                  Mais sobre {author.name} <ArrowUpRight size={17} />
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer className="public-footer section-shell">
        <a href="#inicio" className="footer-brand">
          One Model Arena<span>.</span>
        </a>
        <p>Evidências à vista. Sempre.</p>
        <a className="footer-author" href={author.site} target="_blank" rel="noreferrer">
          <img src={author.avatar} width="44" height="44" alt="" loading="lazy" />
          <span>
            <small>Criado por</small>
            {author.name}
          </span>
        </a>
        <a href="#inicio">
          Voltar ao topo <ArrowRight size={16} />
        </a>
      </footer>
      <Analytics />
    </>
  );
}
