import React, { type CSSProperties, type ReactNode } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  Check,
  Calculator,
  ChevronDown,
  Download,
  Expand,
  FileText,
  Gauge,
  House,
  Layers,
  ListChecks,
  Scale,
  ShieldCheck,
  Target,
  X,
} from 'lucide-react';
import type { Provider, Standing } from '../shared/types';
import { providerNames as names } from '../shared/presentation';
import type { ConclusionData, Evidence } from './data';
import { MeetingBrief } from './meeting-brief';
import { Models } from './models';
import { Home } from './home';
import { MetricsGuide } from './metrics-guide';

const providers: Provider[] = ['jev', 'decisions', 'clef'];
const n = (v: number, digits = 2) => v.toLocaleString('pt-BR', { maximumFractionDigits: digits });
const pct = (v: number, digits = 1) => `${n(v * 100, digits)}%`;
const usd = (v: number, digits = 5) =>
  `US$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
const day = (v: string) =>
  new Date(v).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'short',
    timeStyle: 'short',
  });
const by = <T extends Standing>(list: T[], p: Provider) => list.find((s) => s.provider === p)!;
const chapters = [
  ['inicio', 'Início', 'Modelos. À prova.', House],
  ['modelos', 'Os modelos', 'Empresas, versões e abertura', Layers],
  ['visao-geral', 'A conclusão', 'O que os três testes dizem', Layers],
  ['reunioes', 'Reuniões', 'Seis cenários de decisão', ListChecks],
  ['resiliencia', 'Resiliência', 'Quando o texto complica', ShieldCheck],
  ['imagens', 'Imagens', 'Quatro tarefas visuais', Target],
  ['custo-tempo', 'Custo e tempo', 'O preço de cada decisão', Gauge],
  ['metricas', 'Como ler os números', 'Brier, ECE e incerteza', Scale],
  ['escolha', 'Qual eu escolheria', 'Uma escolha por situação', Check],
  ['brier-ece', 'Brier e ECE', 'Conceitos, fórmulas e exemplos', Calculator],
  ['fontes', 'Evidências e limites', 'De onde vem cada conclusão', FileText],
] as const;
function Provider({ id }: { id: Provider }) {
  return <span className={`provider ${id}`}>{names[id]}</span>;
}
function Heading({ title, children }: { title: string; children: ReactNode }) {
  return (
    <header className="chapter-heading">
      <h1 tabIndex={-1}>{title}</h1>
      <p>{children}</p>
    </header>
  );
}
function Note({ title, children }: { title: string; children: ReactNode }) {
  return (
    <aside className="reading-note">
      <strong>{title}</strong>
      <div>{children}</div>
    </aside>
  );
}
function Opus({ text }: { text: string }) {
  return text ? (
    <details className="opus-reading">
      <summary>
        <AudioLines size={18} /> Leitura registrada do Opus <ChevronDown size={17} />
      </summary>
      <p>{text}</p>
      <small>
        Comentário qualitativo, feito após avaliação cega. O vencedor segue o gabarito e as regras
        da arena.
      </small>
    </details>
  ) : null;
}
function Scores({ rows, scale = 'accuracy' }: { rows: Standing[]; scale?: 'accuracy' | 'score' }) {
  return (
    <div className="score-lines">
      {rows.map((s) => {
        const value = scale === 'score' && 'score' in s ? Number(s.score) : s.correct / s.total;
        return (
          <div className={`score-line ${s.provider}`} key={s.provider}>
            <Provider id={s.provider} />
            <div className="bar-track">
              <span style={{ '--amount': `${value * 100}%` } as CSSProperties} />
            </div>
            <strong>{scale === 'score' ? n(value * 100) : `${s.correct}/${s.total}`}</strong>
            <span className="score-extra">{scale === 'score' ? 'pontos / 100' : pct(value)}</span>
          </div>
        );
      })}
    </div>
  );
}
function MetricTable({
  rows,
  includeEce = false,
}: {
  rows: (Standing & { ece?: number | null })[];
  includeEce?: boolean;
}) {
  const fields = [
    ['Acertos', (s: Standing) => `${s.correct} / ${s.total}`],
    ['Erros pelo gabarito', (s: Standing) => n(s.incorrect)],
    ['Para revisão humana', (s: Standing) => n(s.uncertain)],
    ['Sem resposta', (s: Standing) => n(s.unavailable)],
    ['Brier · menor é melhor', (s: Standing) => (s.brier === null ? '—' : n(s.brier, 5))],
    ...(includeEce
      ? [
          [
            'ECE · menor é melhor',
            (s: Standing & { ece?: number | null }) => (s.ece == null ? '—' : pct(s.ece, 2)),
          ],
        ]
      : []),
    ['Tokens de entrada', (s: Standing) => n(s.inputTokens, 0)],
    ['Custo estimado da API', (s: Standing) => `${s.unknownCosts ? '≥ ' : ''}${usd(s.costUsd)}`],
    [
      'Mediana de resposta',
      (s: Standing) => (s.medianMs === null ? '—' : `${n(s.medianMs, 0)} ms`),
    ],
  ] as [string, (s: Standing & { ece?: number | null }) => string][];
  return (
    <div className="table-scroll" tabIndex={0} aria-label="Métricas detalhadas">
      <table>
        <thead>
          <tr>
            <th scope="col">Métrica</th>
            {rows.map((s) => (
              <th key={s.provider} scope="col">
                <Provider id={s.provider} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {fields.map(([label, value]) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              {rows.map((s) => (
                <td key={s.provider}>{value(s)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
const statuses = {
  correct: 'Acertou',
  incorrect: 'Errou',
  uncertain: 'Revisão humana',
  unavailable: 'Sem resposta',
};
function Case({
  item,
}: {
  item: Evidence & { context?: string; source?: { dataset: string; id: string } };
}) {
  return (
    <details
      className="evidence-case"
      data-case
      data-search={`${item.id} ${item.title} ${item.question}`.toLocaleLowerCase('pt-BR')}
      data-divergent={item.results.some((r) => r.status !== 'correct') ? 'true' : 'false'}
    >
      <summary>
        <span>
          <small>{item.id}</small>
          <strong>{item.title}</strong>
        </span>
        <span className="case-statuses">
          {item.results.map((r) => (
            <span
              className={`case-dot ${r.provider} ${r.status}`}
              key={r.provider}
              title={`${names[r.provider]}: ${statuses[r.status]}`}
            >
              <span className="sr-only">
                {names[r.provider]}: {statuses[r.status]}
              </span>
              {r.status === 'correct' ? (
                <Check size={14} />
              ) : r.status === 'incorrect' ? (
                <X size={14} />
              ) : (
                <span>?</span>
              )}
            </span>
          ))}
          <ChevronDown size={17} />
        </span>
      </summary>
      <div className="case-body">
        <h4>{item.question}</h4>
        <p>{item.facts}</p>
        {item.context && (
          <details className="plain-details">
            <summary>
              Contexto e regras deste caso <ChevronDown size={16} />
            </summary>
            <p>{item.context}</p>
          </details>
        )}
        {item.source && (
          <small>
            Fonte: {item.source.dataset} · registro {item.source.id}
          </small>
        )}
        <p className="answer-key">
          <strong>Gabarito: {item.expected}.</strong> {item.rationale}
        </p>
        <div className="case-answers">
          {item.results.map((r) => (
            <div key={r.provider}>
              <Provider id={r.provider} />
              <strong>{r.label}</strong>
              <span className={`status ${r.status}`}>{statuses[r.status]}</span>
              <p>{r.effect}</p>
              <details>
                <summary>Probabilidades e consumo</summary>
                <ul>
                  {r.probabilities.map((p) => (
                    <li key={p.value}>
                      {p.label}: <strong>{pct(p.probability, 2)}</strong>
                    </li>
                  ))}
                </ul>
                <small>
                  {n(r.inputTokens ?? 0)} tokens ·{' '}
                  {r.costUsd === null ? 'custo desconhecido' : usd(r.costUsd, 8)} ·{' '}
                  {n(r.durationMs, 0)} ms
                </small>
              </details>
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}
function Cases({ items, id, all = false }: { items: Evidence[]; id: string; all?: boolean }) {
  return (
    <div className="case-explorer" data-explorer>
      <div className="explorer-tools">
        <label htmlFor={`${id}-search`}>
          Localizar exemplo
          <input
            id={`${id}-search`}
            type="search"
            placeholder="Pergunta, título ou ID…"
            data-search-input
          />
        </label>
        <label htmlFor={`${id}-filter`}>
          Mostrar
          <select id={`${id}-filter`} data-case-filter defaultValue={all ? 'all' : 'divergent'}>
            <option value="divergent">Casos sem acerto unânime</option>
            <option value="all">Todas as perguntas</option>
          </select>
        </label>
        <span data-case-count role="status" />
      </div>
      <div className="evidence-list">
        {items.map((i) => (
          <Case key={i.id} item={i} />
        ))}
      </div>
      <p data-no-cases hidden>
        Nenhum caso corresponde ao filtro. Experimente mostrar todas as perguntas.
      </p>
      <button type="button" className="secondary" data-more-cases>
        Mostrar mais perguntas
      </button>
    </div>
  );
}
const meetingNotes: Record<string, [string, string, string]> = {
  loja: [
    'Atendimento e triagem com uma política clara',
    'Todos fizeram 6/6: encaminharam o caso, distinguiram frustração de cancelamento e exigiram evidência antes de reembolsar.',
    'Jev é o ponto de partida econômico para este fluxo. O empate em seis perguntas não prova equivalência em atendimento real.',
  ],
  produto: [
    'Priorizar entregas e confirmar uma correção',
    'Decisions e Clef fizeram 6/6. O Jev deixou a validação final para revisão humana ao atribuir 74% a Sim; o limiar para ação era 80%.',
    'Decisions é a opção mais barata entre os dois que automatizaram as seis decisões. Jev pede uma etapa humana adicional neste exemplo.',
  ],
  fornecedor: [
    'Ler requisitos além do slogan',
    'Jev e Clef fizeram 6/6. Decisions negou uma proposta que explicitava suporte humano em português e exportação integral, com 95% de confiança em Não.',
    'Jev é a opção econômica nesta amostra; Clef também acertou tudo. Esse erro do Decisions explica boa parte de seu Brier mais alto nas reuniões.',
  ],
  'lancamento-avancado': [
    'Verificar o impacto e a alternativa realmente utilizável',
    'Todos fizeram 6/6 ao lidar com públicos afetados, alternativas de contorno, exceções de piloto e evidências contraditórias.',
    'Não há separação por acerto. Jev custa menos; é um candidato para testar em políticas semelhantes antes de automatizar.',
  ],
  'conversas-avancadas': [
    'Interpretar condições, retratações e referências',
    'Todos fizeram 6/6 nas mensagens encadeadas, inclusive nas instruções citadas que não deveriam virar ordens.',
    'O resultado favorece começar pelo custo, sem concluir que ambiguidades de conversas reais estão resolvidas.',
  ],
  'dossie-estresse': [
    'Respeitar a autoridade e o escopo das fontes',
    'Todos fizeram 6/6 no dossiê. Mantiveram a mesma escolha quando as alternativas foram reordenadas.',
    'Jev é a opção mais econômica neste recorte. Uma pergunta foi repetida com outra ordem, portanto seis respostas não são seis casos independentes.',
  ],
};
const batteryNotes: Record<string, [string, string]> = {
  robustez: [
    '36 grupos · 144 respostas',
    'Decisions e Clef passaram em 35/36 grupos; Jev, em 32/36. Um grupo exige acertar todas as variantes. Quando o Decisions mudou de resposta, foi para a resposta certa: errou a versão limpa e acertou as com ruído e digitação. Quando o Jev mudou, foi para longe dela: acertou a versão limpa e hesitou nas bagunçadas.',
  ],
  portugues: [
    '60 textos · 20 de cada dataset',
    'Decisions acertou 56/60, Clef 54/60 e Jev 48/60. É a vantagem observada mais direta do Decisions em português real. A amostra combina implicação, discurso de ódio e recomendação de produto; não mede geração de texto.',
  ],
  abstencao: [
    '30 casos · escopo e falta de informação',
    'Os três acertaram 30/30. Todos reconheceram os 15 casos cuja resposta esperada era fora do escopo ou não informado. Essas opções estavam explícitas; não medimos abstenção espontânea em perguntas abertas.',
  ],
  negacao: [
    '12 grupos · quatro versões por grupo',
    'Decisions e Clef passaram nos 12 grupos. Jev passou em 11 e mandou um caso de negação dupla para revisão. Isso mede estas formulações, não compreensão de toda negação possível.',
  ],
  injecao: [
    '16 casos · pressão e exceções legítimas',
    'Decisions e Clef acertaram 16/16. Jev acertou 12 e encaminhou quatro para revisão, sem erro automático nesta bateria. Os ataques foram escritos para o experimento; não são uma certificação de segurança.',
  ],
};
const visualNotes: Record<string, [string, string]> = {
  contagem: [
    '14/20 para os dois',
    'Empate em 70%. Contar objetos foi uma das tarefas mais difíceis. Como havia quatro a seis alternativas, o chute ficava entre 17% e 25%. Nenhum resultado justifica prometer contagem exata.',
  ],
  relacao: [
    '18/20 para os dois',
    'Empate em 90% ao identificar esquerda, direita, acima ou abaixo. Para esta amostra, Decisions entrega o mesmo acerto agregado por menor custo.',
  ],
  profundidade: [
    '19/20 para os dois',
    'Empate em 95% ao escolher o objeto mais perto da câmera. São só 20 comparações binárias, com 50% de acerto esperado no chute.',
  ],
  distancia: [
    'Clef 18/20 · Decisions 14/20',
    'Os quatro acertos de vantagem do Clef no total vieram desta bateria: proximidade entre objetos no mundo real. É uma pista para um piloto específico, não uma prova estatística isolada dessa capacidade.',
  ],
};
function Overview({ data: d }: { data: ConclusionData }) {
  const rounds = [
    {
      id: 'reunioes',
      title: 'Reuniões',
      summary: '36 decisões · seis cenários',
      rows: d.series.report.standings,
      score: false,
      takeaway: 'Clef acertou as 36. Jev foi o mais econômico.',
    },
    {
      id: 'resiliencia',
      title: 'Resiliência',
      summary: '298 testes · nota de 0 a 100',
      rows: d.brava.report.standings,
      score: true,
      takeaway: 'Decisions teve a maior nota. Clef venceu pelo Brier.',
    },
    {
      id: 'imagens',
      title: 'Imagens',
      summary: '80 fotos · quatro tarefas',
      rows: d.visual.report.standings,
      score: false,
      takeaway: 'Clef fez quatro pontos a mais. Decisions custou menos.',
    },
  ];
  return (
    <>
      <Heading title="O melhor modelo depende da decisão.">
        Jev, Decisions e Clef em português. Uma leitura dos resultados de 09/10/2026 para escolher o
        próximo piloto com evidência.
      </Heading>
      <p className="edition-line">
        <ShieldCheck size={17} /> 1.162 respostas nas execuções selecionadas <span>•</span> Consumo
        completo <span>•</span> Sem falhas de API
      </p>
      <div className="round-ledger">
        {rounds.map((r) => (
          <article className="round-band" key={r.id}>
            <div>
              <h2>{r.title}</h2>
              <p>{r.summary}</p>
              <a href={`#${r.id}`} data-chapter-link>
                Explorar a prova <ArrowRight size={16} />
              </a>
            </div>
            <div>
              <Scores rows={r.rows} scale={r.score ? 'score' : 'accuracy'} />
              <p>{r.takeaway}</p>
            </div>
          </article>
        ))}
      </div>
      <Note title="O placar e a escolha de uso respondem a perguntas diferentes.">
        <p>
          O Clef venceu as três provas pelas regras da arena. Isso não o torna a escolha mais
          econômica em todas as tarefas. Na Resiliência e nas imagens, a diferença para o Decisions
          ficou dentro do intervalo de incerteza de 95%.
        </p>
      </Note>
      <div className="overview-takeaways">
        <p>
          <Provider id="jev" />
          <strong>Economia em texto.</strong> Bom ponto de partida quando existe revisão humana.
        </p>
        <p>
          <Provider id="decisions" />
          <strong>Equilíbrio prático.</strong> Desempenho alto, menor custo que Clef e respostas
          rápidas.
        </p>
        <p>
          <Provider id="clef" />
          <strong>Qualidade observada.</strong> Menor Brier e estabilidade nas variantes desta
          edição.
        </p>
      </div>
    </>
  );
}
function Meetings({ data: d }: { data: ConclusionData }) {
  return (
    <>
      <Heading title="Seis reuniões. Decisões que dá para conferir.">
        Triagem, prioridade, requisitos, conversas e conflito entre fontes. Cada reunião tem seis
        perguntas com gabarito e consequências definidos antes do teste.
      </Heading>
      <div className="meeting-overview">
        <Scores rows={d.series.report.standings} />
        <p>
          <strong>Dois desvios explicam o placar:</strong> Jev enviou uma validação para revisão
          humana; Decisions errou a leitura de uma proposta. Clef acertou as 36 decisões.
        </p>
      </div>
      <div className="tabs" role="tablist" aria-label="Cenários de reunião">
        {d.series.meetings.map((m, i) => (
          <button
            key={m.id}
            id={`meeting-tab-${i}`}
            role="tab"
            aria-selected={i === 0}
            aria-controls={`meeting-${i}`}
            data-tab-target={`meeting-${i}`}
            tabIndex={i === 0 ? 0 : -1}
          >
            {m.title.replace('Avançado · ', '').replace('Estresse · ', '')}
          </button>
        ))}
      </div>
      {d.series.meetings.map((m, i) => {
        const notes = meetingNotes[m.scenarioId];
        return (
          <section
            key={m.id}
            id={`meeting-${i}`}
            role="tabpanel"
            aria-labelledby={`meeting-tab-${i}`}
            hidden={i !== 0}
            className="tab-panel"
          >
            <div className="section-intro">
              <h2>{notes[0]}</h2>
              <p>{m.description}</p>
            </div>
            <MeetingBrief meeting={m} />
            <Scores rows={m.report.standings} />
            <div className="reading-columns">
              <div>
                <h3>O que aconteceu</h3>
                <p>{notes[1]}</p>
              </div>
              <div>
                <h3>O que isso sugere</h3>
                <p>{notes[2]}</p>
              </div>
            </div>
            <details className="plain-details">
              <summary>
                Contexto e política da reunião <ChevronDown size={16} />
              </summary>
              <p>{m.context}</p>
            </details>
            <h3 className="spaced">As seis decisões</h3>
            {m.rounds.map((r) => (
              <Case key={r.id} item={r} />
            ))}
            <Opus text={m.opus} />
            <details className="plain-details">
              <summary>
                Custos, tempo e probabilidades deste cenário <ChevronDown size={16} />
              </summary>
              <MetricTable rows={m.report.standings} />
            </details>
          </section>
        );
      })}
      <Note title="Pontuação objetiva; explicação do Opus à parte.">
        <p>
          Acertos contam um ponto. Probabilidades entre 20% e 80% nas perguntas de sim/não ficam
          para revisão e valem zero, mas não são classificadas como erro. Se há empate de pontos, o
          Brier só desempata com diferença mínima de 0,005.
        </p>
      </Note>
    </>
  );
}
function Resilience({ data: d }: { data: ConclusionData }) {
  const r = d.brava.report;
  return (
    <>
      <Heading title="Quando o texto muda, a decisão se sustenta?">
        Cinco baterias, cada uma com o mesmo peso na nota. Em robustez e negação, o grupo inteiro
        precisa passar; por isso a nota não é o percentual bruto de acertos.
      </Heading>
      <Scores rows={r.standings} scale="score" />
      <Note title="Por que o Clef venceu com uma nota ligeiramente menor?">
        <p>
          Decisions fez {n(by(r.standings, 'decisions').score * 100)} pontos e Clef,{' '}
          {n(by(r.standings, 'clef').score * 100)}. A diferença de{' '}
          {n((by(r.standings, 'decisions').score - by(r.standings, 'clef').score) * 100)} ponto
          entra na faixa de empate, menor que 1 ponto. O Clef desempatou com Brier{' '}
          {n(by(r.standings, 'clef').brier!, 5)}, contra {n(by(r.standings, 'decisions').brier!, 5)}
          .
        </p>
      </Note>
      <div className="table-scroll" tabIndex={0} aria-label="Notas por bateria">
        <table>
          <thead>
            <tr>
              <th>Bateria</th>
              <th>Unidades pontuadas</th>
              {providers.map((p) => (
                <th key={p}>
                  <Provider id={p} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {r.batteries.map((b) => (
              <tr key={b.id}>
                <th>{b.title}</th>
                <td>
                  {b.units} {b.unit === 'grupo' ? 'grupos' : 'itens'}
                </td>
                {providers.map((p) => (
                  <td key={p} className={b.leaders.includes(p) ? 'cell-lead' : ''}>
                    {pct(b.scores[p])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="tabs" role="tablist" aria-label="Baterias de Resiliência">
        {d.brava.batteries.map((b, i) => (
          <button
            key={b.id}
            role="tab"
            id={`brava-tab-${b.id}`}
            aria-controls={`brava-${b.id}`}
            aria-selected={i === 0}
            tabIndex={i === 0 ? 0 : -1}
            data-tab-target={`brava-${b.id}`}
          >
            {b.title}
          </button>
        ))}
      </div>
      {d.brava.batteries.map((b, i) => (
        <section
          key={b.id}
          id={`brava-${b.id}`}
          className="tab-panel"
          role="tabpanel"
          aria-labelledby={`brava-tab-${b.id}`}
          hidden={i !== 0}
        >
          <div className="section-intro">
            <h2>{b.title}</h2>
            <p>{batteryNotes[b.id][0]}</p>
          </div>
          <p>{batteryNotes[b.id][1]}</p>
          <p className="muted">{b.description}</p>
          <Cases id={b.id} items={b.items} />
          <Opus text={b.comment} />
        </section>
      ))}
      <div className="reading-columns">
        <div>
          <h3>Estabilidade não é só contar mudanças</h3>
          <p>
            Nas 88 comparações de forma, Clef não mudou a decisão. Jev e Decisions mudaram duas
            vezes cada; no Decisions, ambas as mudanças corrigiram o erro original. As 20 variantes
            com evidência adicional são uma medida separada.
          </p>
        </div>
        <div>
          <h3>Revisão humana tem consequência</h3>
          <p>
            Jev teve {by(r.standings, 'jev').uncertain} respostas para revisão; Decisions,{' '}
            {by(r.standings, 'decisions').uncertain}; Clef, {by(r.standings, 'clef').uncertain}. A
            economia da API não inclui o trabalho de revisar. Zero erros automáticos do Jev nesta
            amostra não prova segurança em produção.
          </p>
        </div>
      </div>
      <details className="plain-details">
        <summary>
          Todas as métricas da Resiliência <ChevronDown size={16} />
        </summary>
        <MetricTable rows={r.standings} includeEce />
      </details>
      <Opus text={d.brava.analysis?.summary ?? ''} />
    </>
  );
}
function Vision({ data: d }: { data: ConclusionData }) {
  const r = d.visual.report;
  return (
    <>
      <Heading title="A vantagem nas imagens veio de uma tarefa.">
        80 fotos do CV-Bench, com 20 perguntas por bateria. Decisions e Clef receberam as mesmas
        imagens preparadas. O Jev não participa de visão nesta integração.
      </Heading>
      <Scores rows={r.standings} />
      <div className="vision-comparison">
        {r.batteries.map((b) => (
          <div key={b.id}>
            <h3>{b.title}</h3>
            {r.participants.map((p) => (
              <div className={`mini-score ${p}`} key={p}>
                <Provider id={p} />
                <span className="bar-track">
                  <span style={{ '--amount': `${b.scores[p] * 100}%` } as CSSProperties} />
                </span>
                <strong>
                  {Math.round(b.scores[p] * b.units)}/{b.units}
                </strong>
              </div>
            ))}
          </div>
        ))}
      </div>
      <Note title="Três empates; quatro acertos de diferença em distância real.">
        <p>
          Contagem: 14 × 14. Posição: 18 × 18. Profundidade: 19 × 19. Distância: Clef 18 × 14
          Decisions. A diferença total é de 5 pontos percentuais, mas o intervalo de 95% vai de −2,5
          a +12,5 pontos e inclui zero.
        </p>
      </Note>
      <div className="tabs" role="tablist" aria-label="Tarefas visuais">
        {d.visual.batteries.map((b, i) => (
          <button
            key={b.id}
            id={`vision-tab-${b.id}`}
            role="tab"
            aria-controls={`vision-${b.id}`}
            aria-selected={i === 0}
            tabIndex={i === 0 ? 0 : -1}
            data-tab-target={`vision-${b.id}`}
          >
            {b.title}
          </button>
        ))}
      </div>
      {d.visual.batteries.map((b, i) => (
        <section
          key={b.id}
          id={`vision-${b.id}`}
          role="tabpanel"
          aria-labelledby={`vision-tab-${b.id}`}
          hidden={i !== 0}
          className="tab-panel"
        >
          <div className="section-intro">
            <h2>{b.title}</h2>
            <p>{visualNotes[b.id][0]}</p>
          </div>
          <p>{visualNotes[b.id][1]}</p>
          <p className="muted">
            {b.description} As referências abaixo preservam pergunta, alternativas respondidas e
            gabarito; as fotografias continuam no dataset e na arena.
          </p>
          <Cases id={`visual-${b.id}`} items={b.items} />
          <Opus text={b.comment} />
        </section>
      ))}
      <details className="plain-details">
        <summary>
          Tokens, custo, tempo e calibração nas imagens <ChevronDown size={16} />
        </summary>
        <MetricTable rows={r.standings} includeEce />
      </details>
      <Opus text={d.visual.analysis?.summary ?? ''} />
    </>
  );
}
function Costs({ data: d }: { data: ConclusionData }) {
  const sets = [
    { title: 'Reuniões', rows: d.series.report.standings },
    { title: 'Resiliência', rows: d.brava.report.standings },
    { title: 'Imagens', rows: d.visual.report.standings },
  ];
  return (
    <>
      <Heading title="Quanto custa a decisão que você precisa?">
        Os tokens são os informados por cada API. A projeção por volume usa o tamanho médio das
        entradas desta edição; não é previsão de fatura nem de tráfego futuro.
      </Heading>
      <div className="cost-controls">
        <label htmlFor="cost-volume">Projetar quantas decisões semelhantes?</label>
        <select id="cost-volume" defaultValue="1000000">
          <option value="1000">1.000 decisões</option>
          <option value="10000">10.000 decisões</option>
          <option value="100000">100.000 decisões</option>
          <option value="1000000">1.000.000 de decisões</option>
        </select>
        <span id="cost-caption" role="status">
          Estimativa apenas da API
        </span>
      </div>
      {sets.map((set) => (
        <section className="cost-section" key={set.title}>
          <h2>{set.title}</h2>
          <div className="table-scroll" tabIndex={0} aria-label={`Custo e tempo: ${set.title}`}>
            <table>
              <thead>
                <tr>
                  <th>Modelo</th>
                  <th>Tokens de entrada</th>
                  <th>Custo desta execução</th>
                  <th>Projeção pelo volume</th>
                  <th>Mediana</th>
                </tr>
              </thead>
              <tbody>
                {set.rows.map((s) => (
                  <tr key={s.provider}>
                    <th>
                      <Provider id={s.provider} />
                    </th>
                    <td>{n(s.inputTokens, 0)}</td>
                    <td>{usd(s.costUsd)}</td>
                    <td className="projection" data-unit-cost={s.costUsd / s.total}>
                      {usd((s.costUsd / s.total) * 1e6, 2)}
                    </td>
                    <td>{n(s.medianMs!, 0)} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      <div className="reading-columns">
        <div>
          <h3>A tarifa sozinha não conta toda a história</h3>
          <p>
            Na Resiliência, Jev contou {n(by(d.brava.report.standings, 'jev').inputTokens, 0)}{' '}
            tokens, e Decisions {n(by(d.brava.report.standings, 'decisions').inputTokens, 0)}, para
            os mesmos casos. Por isso comparamos o custo por decisão, além do preço por milhão de
            tokens.
          </p>
        </div>
        <div>
          <h3>Velocidade de resposta, não de raciocínio puro</h3>
          <p>
            As medianas incluem rede, envio, leitura e validação. Jev e Decisions ficaram a menos de
            50 ms um do outro nos testes de texto, a faixa de equivalência adotada pela arena. Nas
            imagens, Decisions teve a menor mediana.
          </p>
        </div>
      </div>
      <Note title="O que não está nessa conta">
        <p>
          Revisão humana, infraestrutura, assinatura mínima do Workers Paid e avaliação do Opus
          estão fora desses valores. A cota gratuita da Cloudflare também não é descontada. As
          tentativas anteriores com falhas não entram no custo desta edição. Os custos usam as
          tarifas registradas em 08/10/2026.
        </p>
      </Note>
    </>
  );
}
function Reliability({ data: d }: { data: ConclusionData }) {
  return (
    <div className="calibration-figure">
      <svg
        viewBox="0 0 440 250"
        role="img"
        aria-label="Calibração na Resiliência: confiança média e frequência de acerto por faixa"
      >
        <text x="24" y="17">
          Acerto observado
        </text>
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line x1="48" y1={212 - t * 172} x2="410" y2={212 - t * 172} className="chart-grid" />
            <text x="10" y={216 - t * 172}>
              {pct(t, 0)}
            </text>
          </g>
        ))}
        <line x1="48" y1="212" x2="410" y2="40" className="ideal-line" />
        <text x="48" y="239">
          0%
        </text>
        <text x="338" y="239">
          Confiança · 100%
        </text>
        {d.brava.report.standings.map((s) => (
          <g key={s.provider} className={s.provider} data-calibration={s.provider}>
            <polyline
              fill="none"
              points={s.calibration
                .filter((b) => b.count)
                .map((b) => `${48 + b.confidence * 362},${212 - b.accuracy * 172}`)
                .join(' ')}
            />
            {s.calibration
              .filter((b) => b.count)
              .map((b, i) => (
                <circle
                  key={i}
                  cx={48 + b.confidence * 362}
                  cy={212 - b.accuracy * 172}
                  r={4 + Math.min(3, b.count / 60)}
                >
                  <title>{`${names[s.provider]}: confiança ${pct(b.confidence)}; acerto ${pct(b.accuracy)}; ${b.count} respostas`}</title>
                </circle>
              ))}
          </g>
        ))}
      </svg>
      <div className="chart-legend">
        {providers.map((p) => (
          <span key={p}>
            <Provider id={p} />
          </span>
        ))}
        <span>Linha tracejada: calibração perfeita</span>
      </div>
    </div>
  );
}
export function BrierEceGuide({ data }: { data: ConclusionData }) {
  return (
    <MetricsGuide
      data={data}
      chart={<Reliability data={data} />}
      intervals={
        <p>
          Veja também os intervalos de confiança das diferenças de nota em{' '}
          <a href="#metricas" data-chapter-link>
            Como ler os números
          </a>
          . Eles medem outra incerteza e não são intervalos de confiança do Brier ou do ECE.
        </p>
      }
    />
  );
}
function Metrics({ data: d }: { data: ConclusionData }) {
  return (
    <>
      <Heading title="Acerto, confiança e incerteza são coisas diferentes.">
        A mesma execução pode premiar um modelo no Brier e outro no ECE. Use as métricas para
        responder a perguntas específicas.
      </Heading>
      <div className="metric-explanations">
        <section>
          <h2>Brier: quão longe ficou a probabilidade?</h2>
          <p>
            É a soma dos erros ao quadrado entre as probabilidades previstas e o gabarito. Na arena
            vai de 0, certeza correta, a 2, certeza errada. Quanto menor, melhor.
          </p>
          <div className="brier-demo">
            <p>
              Exemplo ilustrativo: a resposta correta é <strong>Sim</strong>.
            </p>
            <label htmlFor="brier-confidence">
              Probabilidade atribuída a Sim: <output id="brier-confidence-value">90%</output>
            </label>
            <input type="range" id="brier-confidence" min="0" max="100" defaultValue="90" />
            <div className="brier-calculation">
              <span id="brier-formula">(1 − 0,90)² + (0 − 0,10)²</span>
              <strong id="brier-result">0,02</strong>
            </div>
            <p id="brier-explanation" aria-live="polite">
              Acertar com convicção deixa o Brier perto de zero.
            </p>
          </div>
          <p>
            Nas reuniões, Decisions errou a proposta com 95% de confiança em Não. Jev deixou uma
            resposta para revisão. Ambos fizeram 35/36 pontos, mas o Brier do Jev foi menor:{' '}
            {n(by(d.series.report.standings, 'jev').brier!, 5)} contra{' '}
            {n(by(d.series.report.standings, 'decisions').brier!, 5)}.
          </p>
        </section>
        <section>
          <h2>ECE: a confiança combina com o acerto?</h2>
          <p>
            Se um modelo diz 90% em muitas respostas, deveria acertar aproximadamente 90% delas. O
            ECE calcula a diferença absoluta em cada faixa, ponderada pelo número de respostas.
          </p>
          <Reliability data={d} />
          <p>
            Na Resiliência, Decisions teve ECE de{' '}
            {pct(by(d.brava.report.standings, 'decisions').ece!, 2)}, contra{' '}
            {pct(by(d.brava.report.standings, 'clef').ece!, 2)} do Clef. O Clef teve o menor Brier.
            Calibração não é garantia sobre uma resposta individual.
          </p>
        </section>
      </div>
      <details className="plain-details">
        <summary>
          Um exemplo simples do cálculo do ECE <ChevronDown size={16} />
        </summary>
        <p>
          Em 80 respostas, a confiança média foi 95% e o acerto foi 95%: diferença zero. Nas outras
          20, a confiança foi 75% e o acerto 50%: diferença de 25 pontos.
        </p>
        <p>
          <strong>ECE = (80 × 0 + 20 × 25) ÷ 100 = 5%.</strong> Um classificador binário que sempre
          prevê 50% e acerta metade pode ter ECE zero, embora não ofereça discriminação útil nessa
          tarefa.
        </p>
        <p>
          A implementação usa cinco faixas de 50% a 100%; previsões cujo maior valor é menor que 50%
          entram na primeira faixa. Usa a confiança da alternativa mais provável, não o campo
          separado de confiança declarado por alguns modelos.
        </p>
      </details>
      <section className="interval-section">
        <h2>O intervalo pode incluir um empate real</h2>
        <p>
          O bootstrap pareado reamostra os mesmos grupos e itens para comparar os modelos. São 1.000
          reamostragens; o intervalo de 95% descreve a incerteza dessa comparação.
        </p>
        <div className="interval-table table-scroll" tabIndex={0}>
          <table>
            <thead>
              <tr>
                <th>Diferença de nota</th>
                <th>Intervalo de 95%</th>
                <th>Inclui zero?</th>
              </tr>
            </thead>
            <tbody>
              {d.brava.report.margins.map((m) => (
                <tr key={m.vs}>
                  <th>Resiliência · Clef − {names[m.vs]}</th>
                  <td>
                    {n(m.low * 100)} a {n(m.high * 100)} pontos
                  </td>
                  <td>
                    {m.within
                      ? 'Sim · sem superioridade demonstrada'
                      : 'Não · separação nesta amostra'}
                  </td>
                </tr>
              ))}
              {d.visual.report.margins.map((m) => (
                <tr key={m.vs}>
                  <th>Imagens · Clef − {names[m.vs]}</th>
                  <td>
                    {n(m.low * 100)} a {n(m.high * 100)} pontos
                  </td>
                  <td>{m.within ? 'Sim · sem superioridade demonstrada' : 'Não'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          A regra de desempate escolhe um vencedor do jogo. O intervalo responde outra pergunta:
          esta amostra demonstra uma diferença entre os modelos? Não calculamos esse intervalo para
          as seis reuniões.
        </p>
      </section>
      <Note title="Pequenas diferenças não merecem grandes narrativas.">
        <p>
          Nas imagens, os ECE foram {pct(by(d.visual.report.standings, 'decisions').ece!, 2)} e{' '}
          {pct(by(d.visual.report.standings, 'clef').ece!, 2)}. A proximidade e as faixas com poucas
          respostas não sustentam uma preferência prática por calibração.
        </p>
      </Note>
    </>
  );
}
const recommendations: {
  id: string;
  category: string;
  situation: string;
  picks: Provider[];
  verdict: string;
  evidence: string;
  limit: string;
  target: string;
}[] = [
  {
    id: 'rotina',
    category: 'texto',
    situation: 'Triagem e regras claras, com orçamento apertado',
    picks: ['jev'],
    verdict: 'Começaria pelo Jev, com revisão humana no fluxo.',
    evidence:
      'Foi o mais barato nas duas provas de texto. Fez 35/36 nas reuniões e não teve erros automáticos na Resiliência, mas encaminhou 22/298 respostas para revisão.',
    limit:
      'A conta econômica precisa incluir essas revisões. Zero erros observados não significa risco zero em produção.',
    target: 'reunioes',
  },
  {
    id: 'portugues',
    category: 'texto',
    situation: 'Classificar português real e reduzir trabalho de revisão',
    picks: ['decisions'],
    verdict: 'Começaria pelo Decisions.',
    evidence:
      'Liderou português real com 56/60, contra 54/60 do Clef e 48/60 do Jev. Na Resiliência inteira, teve só 3 revisões, a maior nota e custo menor que Clef.',
    limit:
      'São 20 exemplos por dataset; não avaliamos redação, resumo, conversação aberta nem toda a variedade do português.',
    target: 'resiliencia',
  },
  {
    id: 'variantes',
    category: 'texto',
    situation: 'Preservar decisões diante de ruído e reformulações',
    picks: ['clef'],
    verdict: 'Testaria o Clef primeiro em um piloto de consistência.',
    evidence:
      'Não mudou a decisão nas 88 comparações de forma. Jev e Decisions mudaram duas vezes cada. Clef também teve o menor Brier nas três provas.',
    limit:
      'Não passou em todos os grupos de robustez: foram 35/36. Não houve controle de repetição idêntica para separar instabilidade normal do efeito da variante.',
    target: 'resiliencia',
  },
  {
    id: 'regras',
    category: 'texto',
    situation: 'Regras com negação, instruções citadas e pressão',
    picks: ['decisions', 'clef'],
    verdict: 'Decisions pelo custo; Clef como alternativa a validar.',
    evidence:
      'Os dois passaram em 12/12 grupos de negação e 16/16 casos de injeção e pressão. Decisions teve menor custo estimado na prova de texto difícil.',
    limit:
      'Acertar estes ataques e exceções não certifica segurança. Mantenha controle de ações e validação humana onde o erro tem consequência.',
    target: 'resiliencia',
  },
  {
    id: 'escopo',
    category: 'texto',
    situation: 'Dizer “fora do escopo” ou “não informado” com opções explícitas',
    picks: ['jev', 'decisions', 'clef'],
    verdict: 'Empate no teste; custo favorece investigar o Jev.',
    evidence:
      'Os três acertaram 30/30 casos de escopo e suficiência de informação; nenhum inventou resposta nos 15 casos que exigiam a opção de abstenção.',
    limit:
      'As opções já ofereciam a saída correta. Não provamos que reconhecem sozinhos quando não sabem responder a uma pergunta aberta.',
    target: 'resiliencia',
  },
  {
    id: 'visual-volume',
    category: 'visao',
    situation: 'Analisar imagens com prioridade em custo e resposta rápida',
    picks: ['decisions'],
    verdict: 'Começaria pelo Decisions, aceitando a diferença observada.',
    evidence:
      'Empatou com Clef em contagem, posição relativa e profundidade. Fez 65/80 no total, com menor custo e menor mediana de resposta.',
    limit:
      'Clef fez 69/80; a economia tem esse trade-off nesta amostra. Contagem ficou em 70% para ambos.',
    target: 'imagens',
  },
  {
    id: 'espacial',
    category: 'visao',
    situation: 'Comparar distâncias entre objetos em uma cena',
    picks: ['clef'],
    verdict: 'Testaria o Clef primeiro com mais exemplos do meu domínio.',
    evidence:
      'Na bateria de distância real, Clef fez 18/20 e Decisions 14/20. Essa tarefa explica toda a vantagem agregada de quatro acertos.',
    limit:
      'A bateria tem só 20 fotos e não tem intervalo próprio. O intervalo da prova completa inclui zero; a vantagem é uma hipótese de piloto.',
    target: 'imagens',
  },
  {
    id: 'produto',
    category: 'texto',
    situation: 'Priorizar acerto observado acima do custo da API',
    picks: ['clef'],
    verdict: 'Clef é o candidato inicial desta edição.',
    evidence:
      'Acertou 36/36 nas reuniões, venceu a Resiliência pelo Brier e fez 69/80 nas imagens. Teve o menor Brier nos três recortes.',
    limit:
      'Custa mais que os demais nas amostras comparáveis. A vantagem sobre Decisions nas duas provas maiores não demonstrou superioridade estatística.',
    target: 'visao-geral',
  },
];
function Choice() {
  return (
    <>
      <Heading title="Qual eu escolheria para cada situação?">
        Recomendações para começar um piloto, derivadas desta edição. A preferência depende do custo
        do erro, da revisão humana e da tarefa que realmente será executada.
      </Heading>
      <div className="choice-filters" role="group" aria-label="Filtrar situações">
        <button type="button" className="active" aria-pressed="true" data-choice-filter="all">
          Todas as situações
        </button>
        <button type="button" aria-pressed="false" data-choice-filter="texto">
          Decisões em texto
        </button>
        <button type="button" aria-pressed="false" data-choice-filter="visao">
          Decisões com imagens
        </button>
      </div>
      <div className="recommendation-list">
        {recommendations.map((r) => (
          <article key={r.id} data-recommendation={r.category}>
            <div className="recommendation-heading">
              <h2>{r.situation}</h2>
              <div>
                {r.picks.map((p) => (
                  <Provider key={p} id={p} />
                ))}
              </div>
            </div>
            <strong className="recommendation-verdict">{r.verdict}</strong>
            <div className="reading-columns">
              <div>
                <h3>O que sustenta a escolha</h3>
                <p>{r.evidence}</p>
                <a href={`#${r.target}`} data-chapter-link>
                  Conferir a evidência <ArrowRight size={15} />
                </a>
              </div>
              <div>
                <h3>Onde a conclusão termina</h3>
                <p>{r.limit}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
      <Note title="Para o que não testamos, ainda não há recomendação.">
        <p>
          Código, escrita criativa, OCR de documentos, áudio, agentes que executam ações e decisões
          médicas ou jurídicas não foram avaliados. Não extrapole estes resultados para essas
          tarefas.
        </p>
      </Note>
      <div className="closing-line">
        <h2>Escolha o modelo para a tarefa. Valide no seu domínio.</h2>
        <p>
          Use estas medidas para reduzir a lista de candidatos. Depois, rode uma amostra própria com
          gabarito, custo de revisão e critérios de aceitação definidos antes do resultado.
        </p>
      </div>
    </>
  );
}
function Sources({ data: d }: { data: ConclusionData }) {
  return (
    <>
      <Heading title="Uma edição fixada. Resultados rastreáveis.">
        Este relatório lê três execuções reais específicas. É uma fotografia dos dados de
        09/10/2026, preservada para a gravação; não muda quando outra rodada é iniciada.
      </Heading>
      <div className="source-runs">
        {[
          {
            label: 'Maratona de reuniões',
            data: d.series,
            count: '6 reuniões · 36 perguntas por modelo',
          },
          {
            label: 'Resiliência',
            data: d.brava,
            count: '298 itens · 5 baterias · nenhuma anulação',
          },
          { label: 'Imagens', data: d.visual, count: '80 fotos · 160 respostas disponíveis' },
        ].map((r) => (
          <article key={r.label}>
            <h2>{r.label}</h2>
            <p>
              {r.count} · {day(r.data.createdAt)} (Brasília)
            </p>
            <code>{r.data.id}</code>
          </article>
        ))}
      </div>
      <section className="spaced">
        <h2>Modelos efetivamente registrados</h2>
        <div className="model-versions">
          {d.models.map((m) => (
            <p key={m.provider}>
              <Provider id={m.provider} />
              <code>{m.versions.join(', ')}</code>
            </p>
          ))}
        </div>
      </section>
      <section className="spaced">
        <h2>Por que esta rodada de imagens?</h2>
        <p>
          É a primeira repetição completa sem falhas após a compactação do envio das imagens e a
          liberação da cota da Cloudflare. Todas as 80 fotos foram executadas novamente para os dois
          participantes. Não combinamos os melhores resultados de tentativas diferentes.
        </p>
        <p>
          A preparação foi igual para ambos: fotos com lado maior limitado a 1.600 px; quando o
          arquivo ultrapassou 180 KiB, conversão para WebP com qualidade 80, preservando dimensões e
          enquadramento. Os originais permaneceram no disco.
        </p>
        <details className="plain-details">
          <summary>
            Tentativas anteriores preservadas no histórico <ChevronDown size={16} />
          </summary>
          <div className="table-scroll" tabIndex={0}>
            <table>
              <thead>
                <tr>
                  <th>Início (Brasília)</th>
                  <th>Estado</th>
                  <th>Ocorrências registradas</th>
                </tr>
              </thead>
              <tbody>
                {d.previous.map((p) => (
                  <tr key={p.id}>
                    <th>
                      {day(p.createdAt)}
                      <small className="source-id">{p.id}</small>
                    </th>
                    <td>{p.phase === 'cancelled' ? 'Encerrada' : 'Concluída'}</td>
                    <td>
                      {[...new Set(p.errors.map((e) => `${names[e.provider]}: ${e.kind}`))].join(
                        ' · ',
                      )}{' '}
                      ({p.errors.length} falhas)
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>
      <div className="reading-columns">
        <section>
          <h2>O que estas provas permitem dizer</h2>
          <ul className="editorial-list">
            <li>
              Comparação dos mesmos fatos, perguntas e critérios em português, por APIs nativas.
            </li>
            <li>
              Gabaritos e pontuação congelados antes das respostas. Opus comenta às cegas, sem
              alterar os pontos.
            </li>
            <li>
              Uma chamada por item e provedor, sem retentativa automática. Nesta edição selecionada,
              nenhuma chamada falhou.
            </li>
            <li>
              Custo estimado, tempo observado e probabilidades completos para os participantes de
              cada prova.
            </li>
          </ul>
        </section>
        <section>
          <h2>O que elas não permitem dizer</h2>
          <ul className="editorial-list">
            <li>Que existe um vencedor universal ou que zero erros implica segurança.</li>
            <li>
              Que os provedores têm a mesma disponibilidade: o teste não é uma medição de SLA.
            </li>
            <li>Que as imagens medem OCR, geração visual ou toda capacidade multimodal.</li>
            <li>
              Que a nota aumentou ou diminuiu de uma prova para outra: as métricas e tarefas mudam.
            </li>
          </ul>
        </section>
      </div>
      <section className="spaced">
        <h2>Fontes das amostras</h2>
        <div className="source-links">
          <a
            href="https://huggingface.co/datasets/nilc-nlp/assin2"
            target="_blank"
            rel="noreferrer"
          >
            ASSIN 2 · implicação textual <ArrowUpRight size={15} />
          </a>
          <a href="https://github.com/franciellevargas/HateBR" target="_blank" rel="noreferrer">
            HateBR · discurso de ódio <ArrowUpRight size={15} />
          </a>
          <a
            href="https://github.com/americanas-tech/b2w-reviews01"
            target="_blank"
            rel="noreferrer"
          >
            B2W-Reviews01 · recomendação <ArrowUpRight size={15} />
          </a>
          <a
            href="https://huggingface.co/datasets/nyu-visionx/CV-Bench"
            target="_blank"
            rel="noreferrer"
          >
            CV-Bench · percepção visual <ArrowUpRight size={15} />
          </a>
        </div>
        <p>
          Datasets públicos podem ter aparecido no treinamento. Rótulos humanos e traduções também
          têm limitações. Os textos sensíveis do HateBR ficam omitidos; as fotografias e os textos
          completos dos datasets continuam sujeitos aos termos das fontes. As perguntas visuais são
          referências às anotações do CV-Bench.
        </p>
      </section>
      <details className="plain-details">
        <summary>
          Identificadores técnicos desta edição <ChevronDown size={16} />
        </summary>
        <dl className="provenance">
          <dt>Relatório preparado em</dt>
          <dd>{day(d.preparedAt)} (Brasília)</dd>
          <dt>Revisão do código ao preparar o relatório</dt>
          <dd>
            <code>{d.revision}</code>
          </dd>
          <dt>SHA-256 das regras usadas no relatório</dt>
          <dd>
            <code>{d.rulesHash}</code>
          </dd>
          <dt>Catálogo da Resiliência</dt>
          <dd>
            <code>{d.brava.hash}</code>
          </dd>
          <dt>Catálogo visual, incluindo a política de envio</dt>
          <dd>
            <code>{d.visual.hash}</code>
          </dd>
          {d.series.meetings.map((m) => (
            <div key={m.id}>
              <dt>{m.title}</dt>
              <dd>
                <code>{m.hash}</code>
              </dd>
            </div>
          ))}
        </dl>
        <p>
          O sufixo “dirty” indica alterações locais ao preparar este HTML. Essa revisão identifica a
          geração do relatório, não comprova sozinha o código exato de cada chamada anterior.
        </p>
      </details>
      <button type="button" className="secondary" id="download-data">
        <Download size={17} /> Baixar os dados deste relatório
      </button>
    </>
  );
}

export function ConclusionDocument({
  data,
  css,
  script,
  json,
  logos,
  brand,
}: {
  data: ConclusionData;
  css: string;
  script: string;
  json: string;
  logos: Record<Provider, string>;
  brand: { mark: string; favicon: string };
}) {
  const content = [
    <Home />,
    <Models data={data} logos={logos} />,
    <Overview data={data} />,
    <Meetings data={data} />,
    <Resilience data={data} />,
    <Vision data={data} />,
    <Costs data={data} />,
    <Metrics data={data} />,
    <Choice />,
    <BrierEceGuide data={data} />,
    <Sources data={data} />,
  ];
  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <meta name="color-scheme" content="dark" />
        <title>Conclusão · Jev × Decisions × Clef · One Model Arena</title>
        <link rel="icon" type="image/png" href={brand.favicon} sizes="32x32" />
        <style dangerouslySetInnerHTML={{ __html: css }} />
      </head>
      <body>
        <a href="#main-content" className="skip-link">
          Ir para o conteúdo
        </a>
        <header className="report-topbar">
          <a className="brand" href="#inicio" data-chapter-link>
            <img className="brand-mark" src={brand.mark} alt="" width={32} height={32} /> One Model
            Arena
            <span className="brand-suffix">/ Conclusão</span>
          </a>
          <div className="report-actions">
            <a href="/" id="back-arena" className="quiet">
              <ArrowLeft size={16} /> Arena
            </a>
            <button id="download-html" className="quiet" type="button" aria-label="Baixar HTML">
              <Download size={16} />
              <span>Baixar HTML</span>
            </button>
            <button id="present" className="secondary" type="button" aria-pressed="false">
              <Expand size={16} />
              <span>Apresentar</span>
            </button>
          </div>
        </header>
        <div className="report-layout">
          <aside className="report-sidebar">
            <p className="sidebar-intro">
              Jev × Decisions × Clef<span>Edição de 09 outubro 2026</span>
            </p>
            <nav aria-label="Capítulos do relatório">
              {chapters.map(([id, title, desc, Icon], i) => (
                <a
                  key={id}
                  href={`#${id}`}
                  data-chapter-link
                  aria-current={i === 0 ? 'page' : undefined}
                >
                  <Icon size={18} />
                  <span>
                    <strong>{title}</strong>
                    <small>{desc}</small>
                  </span>
                </a>
              ))}
            </nav>
            <div className="sidebar-foot">
              <span className="edition-dot" /> Dados reais, edição fixada
              <p>
                Use <kbd>←</kbd> <kbd>→</kbd> para navegar.
                <br />
                Sem avanço automático.
              </p>
            </div>
          </aside>
          <main id="main-content" tabIndex={-1}>
            {chapters.map(([id], i) => (
              <section
                id={id}
                key={id}
                className={`chapter${i === 0 ? ' active' : ''}`}
                data-chapter
                hidden={i !== 0}
              >
                {content[i]}
              </section>
            ))}
            <footer className="chapter-footer">
              <button id="previous-chapter" className="quiet" type="button" disabled>
                <ArrowLeft size={17} /> Anterior
              </button>
              <span id="chapter-position" aria-live="polite">
                1 de {chapters.length}
              </span>
              <button id="next-chapter" className="primary" type="button">
                Próximo capítulo <ArrowRight size={17} />
              </button>
            </footer>
          </main>
        </div>
        <div id="report-status" className="sr-only" role="status" />
        <script
          type="application/json"
          id="report-data"
          dangerouslySetInnerHTML={{ __html: json }}
        />
        <noscript>
          <style>
            {
              '[data-chapter][hidden], [role="tabpanel"][hidden] {display:block!important}.report-sidebar,.chapter-footer,.report-actions{display:none}.report-layout{display:block}'
            }
          </style>
          Ative JavaScript para usar a navegação interativa. Todo o relatório está disponível
          abaixo.
        </noscript>
        <script dangerouslySetInnerHTML={{ __html: script }} />
      </body>
    </html>
  );
}
