import React, { type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { providerNames } from '../shared/presentation';
import type { ConclusionData } from './data';
import { guideMeetingEvidence } from './metrics-guide-data';

const n = (v: number, digits = 5) => v.toLocaleString('pt-BR', { maximumFractionDigits: digits });
const pct = (v: number, digits = 2) => `${n(v * 100, digits)}%`;
function Table({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="table-scroll lesson-table" tabIndex={0} role="region" aria-label={label}>
      <table>{children}</table>
    </div>
  );
}
function Detail({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="plain-details">
      <summary>
        {title}
        <ChevronDown size={16} />
      </summary>
      {children}
    </details>
  );
}
const lessons = [
  ['brier', 'Brier'],
  ['ece', 'ECE'],
  ['contas', 'Contas dos testes reais'],
  ['limites', 'Comparação e limites'],
] as const;

export function MetricsGuide({
  data: d,
  chart,
  intervals,
}: {
  data: ConclusionData;
  chart: ReactNode;
  intervals: ReactNode;
}) {
  const meetings = guideMeetingEvidence(d);
  const examples = meetings.flatMap((m) =>
    m.rounds.filter((r) => r.id === 'f1' || r.id === 'p6').map((r) => ({ ...r, meeting: m.title })),
  );
  const bins = [d.brava, d.visual].flatMap((round, i) =>
    round.report.standings.map((s) => ({
      ...s,
      round: i === 0 ? 'Resiliência' : 'Imagens',
      id: `${i}-${s.provider}`,
    })),
  );
  return (
    <>
      <header className="chapter-heading">
        <h1 tabIndex={-1}>Brier e ECE, da ideia à conta.</h1>
        <p>
          O Brier avalia as probabilidades diante do gabarito. O ECE compara confiança e acerto em
          grupos de respostas. Nos dois, menor é melhor.
        </p>
      </header>
      <div className="tabs" role="tablist" aria-label="Explicações das métricas">
        {lessons.map(([id, label], i) => (
          <button
            key={id}
            id={`lesson-tab-${id}`}
            role="tab"
            aria-selected={i === 0}
            aria-controls={`lesson-${id}`}
            data-tab-target={`lesson-${id}`}
            tabIndex={i === 0 ? 0 : -1}
          >
            {label}
          </button>
        ))}
      </div>
      <section
        id="lesson-brier"
        className="tab-panel metric-lesson"
        role="tabpanel"
        aria-labelledby="lesson-tab-brier"
      >
        <div className="lesson-columns">
          <div>
            <h2>Brier é uma nota de erro das probabilidades</h2>
            <p>
              Ele mede a distância entre a distribuição prevista e a resposta certa. A alternativa
              correta deveria receber 100%; todas as outras, 0%. Quanto mais perto desse ideal,
              menor o erro.
            </p>
            <p>
              <strong>Na arena: 0 é perfeito; 2 é o pior possível.</strong> Não é porcentagem de
              erro nem número de perguntas erradas. Duas respostas que acertam podem ter Brier
              diferente, porque a confiança também conta.
            </p>
            <ol className="calculation-steps">
              <li>Converta as porcentagens para probabilidades: 90% vira 0,9.</li>
              <li>Monte o gabarito: 1 para a alternativa certa e 0 para as demais.</li>
              <li>
                Para cada alternativa, subtraia o gabarito da probabilidade e eleve ao quadrado.
              </li>
              <li>Some os quadrados: esse é o Brier da pergunta.</li>
              <li>
                Some os Brier das perguntas elegíveis e divida pela quantidade delas: essa é a média
                do boletim.
              </li>
            </ol>
          </div>
          <div className="brier-demo">
            <h2>Experimente a confiança</h2>
            <p>
              Exemplo ilustrativo: o gabarito é <strong>Sim</strong>. Mova a barra e veja o custo de
              errar com certeza.
            </p>
            <label htmlFor="guide-brier-confidence">
              Probabilidade de Sim <output id="guide-brier-confidence-value">90%</output>
            </label>
            <input type="range" id="guide-brier-confidence" min="0" max="100" defaultValue="90" />
            <div className="brier-calculation">
              <span id="guide-brier-formula">(1 − 0,90)² + (0 − 0,10)²</span>
              <strong id="guide-brier-result">0,02</strong>
            </div>
            <p id="guide-brier-explanation" aria-live="polite">
              Acertar com convicção deixa o Brier perto de zero.
            </p>
          </div>
        </div>
        <div className="formula-strip">
          <strong>Brier da pergunta = Σ (pₖ − yₖ)²</strong>
          <span>Brier médio = soma dos Brier ÷ N</span>
        </div>
        <p>
          <strong>pₖ</strong> é a probabilidade da alternativa k; <strong>yₖ</strong> é 1 se ela é
          correta e 0 caso contrário; <strong>Σ</strong> significa somar todas as alternativas;{' '}
          <strong>N</strong> é o número de perguntas elegíveis. O quadrado impede que diferenças
          positivas e negativas se anulem e aumenta a penalidade das grandes distâncias.
        </p>
        <Table label="Exemplos do Brier binário">
          <caption>Uma pergunta de Sim ou Não, com gabarito Sim · exemplos ilustrativos</caption>
          <thead>
            <tr>
              <th>O modelo disse</th>
              <th>Conta</th>
              <th>Brier</th>
              <th>Leitura</th>
            </tr>
          </thead>
          <tbody>
            {[
              [100, 'Certeza correta'],
              [90, 'Acerto com confiança'],
              [60, 'Inclinação para Sim'],
              [50, 'Probabilidades iguais'],
              [10, 'Erro com confiança'],
              [0, 'Certeza errada'],
            ].map(([confidence, label]) => {
              const p = Number(confidence) / 100;
              return (
                <tr key={confidence}>
                  <th>
                    Sim {confidence}%, Não {100 - Number(confidence)}%
                  </th>
                  <td>
                    (1 − {n(p)})² + (0 − {n(1 - p)})²
                  </td>
                  <td>
                    <strong>{n(2 * (1 - p) ** 2)}</strong>
                  </td>
                  <td>{label}</td>
                </tr>
              );
            })}
          </tbody>
        </Table>
        <Detail title="E quando há três ou mais alternativas?">
          <p>
            O cálculo é o mesmo. Exemplo ilustrativo: Baixa 10%, Média 70%, Alta 20%, com gabarito
            Média. O vetor previsto é (0,1; 0,7; 0,2) e o ideal é (0; 1; 0).
          </p>
          <p className="formula-strip">
            <strong>(0,1 − 0)² + (0,7 − 1)² + (0,2 − 0)² = 0,01 + 0,09 + 0,04 = 0,14</strong>
          </p>
          <p>
            Em perguntas de escala, o Brier usa essa distribuição por nível. Não usa a média
            ponderada dos níveis exibida como resposta. Por isso, a nota de acerto da arena e o
            Brier avaliam aspectos diferentes.
          </p>
        </Detail>
        <Detail title="Por que vai até 2? Não existe Brier de 0 a 1?">
          <p>
            Ao apostar 100% em uma alternativa errada, há dois erros máximos: 1 na alternativa
            escolhida e 1 na correta. A soma é 1² + 1² = 2; as outras alternativas contribuem zero.
          </p>
          <p>
            Na convenção binária que mede só a probabilidade de Sim, o intervalo é 0 a 1. A arena
            soma Sim e Não: para uma pergunta binária, seu Brier é exatamente o dobro dessa
            convenção. Antes de comparar boletins de ferramentas diferentes, confira a fórmula.
          </p>
        </Detail>
        <Detail title="Qual é o Brier de um chute uniforme?">
          <p>
            Ao distribuir igualmente entre K alternativas, o Brier é <strong>1 − 1/K</strong>: 0,5
            em duas; aproximadamente 0,667 em três; 0,75 em quatro; 0,8 em cinco. É uma referência
            para a previsão uniforme, não um limite universal entre bom e ruim.
          </p>
          <p>
            O número de alternativas e a dificuldade mudam essa referência. Compare modelos nos
            mesmos itens; evite usar o Brier bruto para dizer que uma prova foi mais fácil que
            outra.
          </p>
        </Detail>
      </section>
      <section
        id="lesson-ece"
        className="tab-panel metric-lesson"
        role="tabpanel"
        aria-labelledby="lesson-tab-ece"
        hidden
      >
        <div className="lesson-columns">
          <div>
            <h2>ECE: a confiança combina com o acerto?</h2>
            <p>
              <strong>Expected Calibration Error</strong>, ou erro de calibração esperado, estima a
              diferença entre confiança e taxa de acerto. Se o modelo dá 90% de confiança em muitas
              respostas, esperamos que acerte cerca de 90% delas.
            </p>
            <p>
              Acertar só 70% nesse grupo indica excesso de confiança. Acertar 100% indica confiança
              abaixo do acerto observado. O ECE usa o valor absoluto da diferença: ambos contam como
              descalibração.
            </p>
            <p>
              <strong>0% é ajuste perfeito nesta amostra e nestas faixas.</strong> Isso não garante
              que a próxima resposta esteja correta nem que o modelo se mantenha calibrado em outro
              cenário.
            </p>
          </div>
          <div>
            <h2>Quando disse X%, acertou quanto?</h2>
            {chart}
            <p>
              Dados reais da Resiliência. Cada ponto é uma faixa com respostas; a diagonal marca
              confiança igual ao acerto. Abaixo: excesso de confiança. Acima: confiança abaixo do
              acerto.
            </p>
          </div>
        </div>
        <ol className="calculation-steps">
          <li>
            Pegue a alternativa de maior probabilidade de cada resposta; essa probabilidade é a
            confiança usada aqui.
          </li>
          <li>
            Marque acerto 1 quando essa alternativa corresponde exatamente ao gabarito; caso
            contrário, 0.
          </li>
          <li>Agrupe as respostas nas cinco faixas de confiança usadas pela arena.</li>
          <li>
            Em cada faixa, calcule a confiança média e a fração de acertos, depois a diferença
            absoluta entre elas.
          </li>
          <li>
            Multiplique cada diferença pela proporção de respostas nessa faixa e some as
            contribuições.
          </li>
        </ol>
        <div className="formula-strip">
          <strong>ECE = Σ (nᵦ / N) × |acertoᵦ − confiançaᵦ|</strong>
          <span>ECE em % = ECE decimal × 100</span>
        </div>
        <p>
          <strong>nᵦ</strong> é a quantidade de respostas na faixa b; <strong>N</strong> é o total
          de respostas utilizáveis desse modelo; <strong>|…|</strong> pega a distância sem sinal.
          Acerto e confiança entram de 0 a 1. No boletim, 0,05 aparece como 5%.
        </p>
        <Table label="Exemplo ponderado do ECE">
          <caption>Exemplo ilustrativo com 100 respostas</caption>
          <thead>
            <tr>
              <th>Faixa</th>
              <th>Respostas</th>
              <th>Confiança média</th>
              <th>Acertos</th>
              <th>Diferença</th>
              <th>Peso</th>
              <th>Contribuição</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th>90–100%</th>
              <td>80</td>
              <td>95%</td>
              <td>76/80 = 95%</td>
              <td>0 p.p.</td>
              <td>80%</td>
              <td>0 p.p.</td>
            </tr>
            <tr>
              <th>70–80%</th>
              <td>20</td>
              <td>75%</td>
              <td>10/20 = 50%</td>
              <td>25 p.p.</td>
              <td>20%</td>
              <td>5 p.p.</td>
            </tr>
          </tbody>
        </Table>
        <p className="formula-strip">
          <strong>(80/100 × |0,95 − 0,95|) + (20/100 × |0,50 − 0,75|) = 0,05 = 5%</strong>
        </p>
        <p>
          A média simples das duas diferenças seria 12,5 pontos, mas estaria errada: a faixa com 80
          respostas precisa pesar quatro vezes mais que a faixa com 20. <strong>p.p.</strong>{' '}
          significa pontos percentuais; 95% menos 70% são 25 p.p., não uma redução relativa de 25%.
        </p>
        <div className="brier-demo ece-demo">
          <h2>Experimente a calibração</h2>
          <p>
            Nos mesmos 100 exemplos acima, mantenha as 80 respostas do primeiro grupo e mude os
            acertos nas 20 respostas de confiança 75%.
          </p>
          <label htmlFor="guide-ece-hits">
            Acertos no grupo de 20 <output id="guide-ece-hits-value">10 / 20</output>
          </label>
          <input type="range" id="guide-ece-hits" min="0" max="20" defaultValue="10" />
          <div className="brier-calculation">
            <span id="guide-ece-formula">20% × |50% − 75%|</span>
            <strong id="guide-ece-result">5%</strong>
          </div>
          <p id="guide-ece-explanation" aria-live="polite">
            Confiança acima do acerto nesse grupo: 75% de confiança para 50% de acertos.
          </p>
        </div>
        <Detail title="Quais são as faixas e qual confiança entra na conta?">
          <p>
            As faixas nominais são 50–60%, 60–70%, 70–80%, 80–90% e 90–100%. Confianças abaixo de
            50%, possíveis em perguntas com várias opções, também entram na primeira faixa. A última
            inclui 100%. Faixas vazias têm contribuição zero e não entram como observações
            adicionais.
          </p>
          <p>
            A arena usa a maior probabilidade do vetor, não o campo separado de confiança declarado
            pelo provedor. Em empate de probabilidade, a primeira alternativa do vetor é escolhida.
            Para reproduzir os limites exatamente, o código usa{' '}
            <code>min(4, max(0, floor((p − 0.5) × 10)))</code>; valores exatamente no limite podem
            ser afetados pela representação decimal em ponto flutuante.
          </p>
          <p>
            O acerto do ECE compara a alternativa mais provável ao gabarito exato. Isso difere da
            regra de pontos: uma resposta binária pode ir para revisão humana, e uma escala usa
            tolerância na média dos níveis. Portanto, a taxa de acerto usada pelo ECE pode ser
            diferente da taxa de pontos do placar.
          </p>
        </Detail>
        <Detail title="O ECE mede honestidade?">
          <p>
            “Honestidade da confiança” é uma analogia útil para o vídeo, não uma intenção do modelo.
            ECE é uma medida empírica de calibração por faixas. Um ECE baixo não prova sinceridade,
            capacidade de explicar o próprio raciocínio ou ausência de viés.
          </p>
          <p>
            Um modelo binário que sempre diz 50% e acerta metade tem ECE zero e Brier 0,5. A
            confiança combina com os acertos, mas não distingue os casos. Calibração sozinha não
            basta para escolher um modelo.
          </p>
        </Detail>
      </section>
      <section
        id="lesson-contas"
        className="tab-panel metric-lesson"
        role="tabpanel"
        aria-labelledby="lesson-tab-contas"
        hidden
      >
        <h2>Abra a conta de uma resposta real</h2>
        <p>
          Dois casos das reuniões ilustram a diferença entre errar com convicção e encaminhar uma
          resposta para revisão. As probabilidades abaixo são as registradas nesta edição.
        </p>
        <label className="lesson-select">
          Pergunta e modelo
          <select data-metric-select="brier-real">
            {examples.flatMap((e) =>
              e.results.map((r) => (
                <option key={`${e.id}-${r.provider}`} value={`${e.id}-${r.provider}`}>
                  {e.title} · {providerNames[r.provider]}
                </option>
              )),
            )}
          </select>
        </label>
        {examples.flatMap((e) =>
          e.results.map((r, i) => (
            <div
              key={`${e.id}-${r.provider}`}
              data-metric-group="brier-real"
              data-metric-value={`${e.id}-${r.provider}`}
              hidden={e !== examples[0] || i !== 0}
            >
              <h3>
                {e.meeting} ·{' '}
                <span className={`provider ${r.provider}`}>{providerNames[r.provider]}</span>
              </h3>
              <p>
                {e.question} <strong>Gabarito: {e.expected}.</strong>
              </p>
              <p>
                Resposta no placar: <strong>{r.label}</strong>. {r.effect}
              </p>
              <Table label={`Cálculo real do Brier, ${e.id}, ${providerNames[r.provider]}`}>
                <thead>
                  <tr>
                    <th>Alternativa</th>
                    <th>Probabilidade p</th>
                    <th>Gabarito y</th>
                    <th>Diferença p − y</th>
                    <th>Erro ao quadrado</th>
                  </tr>
                </thead>
                <tbody>
                  {r.probabilities.map((p) => {
                    const y = Number(p.value === e.expectedValue);
                    return (
                      <tr key={p.value}>
                        <th>{p.label}</th>
                        <td>
                          {pct(p.probability, 4)} = {n(p.probability, 6)}
                        </td>
                        <td>{y}</td>
                        <td>{n(p.probability - y, 6)}</td>
                        <td>{n((p.probability - y) ** 2, 8)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <th colSpan={4}>Soma = Brier desta pergunta</th>
                    <td>
                      <strong>{r.brier === null ? 'Não calculado' : n(r.brier, 8)}</strong>
                    </td>
                  </tr>
                </tfoot>
              </Table>
            </div>
          )),
        )}
        <h2>Da pergunta para o boletim</h2>
        <p>
          Nas reuniões, os três responderam às mesmas 36 perguntas. O Brier do boletim é a soma dos
          36 erros dividida por 36, incluindo probabilidades de respostas enviadas para revisão
          humana.
        </p>
        <Table label="Reconstrução do Brier nas reuniões">
          <thead>
            <tr>
              <th>Modelo</th>
              <th>Soma dos Brier</th>
              <th>Perguntas</th>
              <th>Brier médio</th>
            </tr>
          </thead>
          <tbody>
            {d.series.report.standings.map((s) => {
              const scores = meetings
                .flatMap((m) => m.rounds)
                .filter(
                  (q) =>
                    q.results.length === d.series.report.standings.length &&
                    q.results.every((r) => r.brier !== null),
                )
                .map((q) => q.results.find((r) => r.provider === s.provider)!.brier!);
              return (
                <tr key={s.provider}>
                  <th className={`provider ${s.provider}`}>{providerNames[s.provider]}</th>
                  <td>
                    {n(
                      scores.reduce((a, b) => a + b, 0),
                      8,
                    )}
                  </td>
                  <td>{scores.length}</td>
                  <td>
                    <strong>{n(s.brier!, 8)}</strong>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
        <p>
          Jev e Decisions fizeram 35/36 pontos. O erro do Decisions com 95% em Não pesa muito no
          Brier; a revisão do Jev com 76% em Sim fica mais perto do gabarito. Clef acertou as 36 e
          teve o menor Brier.
        </p>
        <h2>Reconstrua o ECE faixa por faixa</h2>
        <label className="lesson-select">
          Prova e modelo
          <select data-metric-select="ece-real">
            {bins.map((s) => (
              <option key={s.id} value={s.id}>
                {s.round} · {providerNames[s.provider]}
              </option>
            ))}
          </select>
        </label>
        {bins.map((s, i) => {
          const total = s.calibration.reduce((sum, b) => sum + b.count, 0);
          return (
            <div key={s.id} data-metric-group="ece-real" data-metric-value={s.id} hidden={i !== 0}>
              <Table label={`Cálculo real do ECE, ${s.round}, ${providerNames[s.provider]}`}>
                <caption>
                  {s.round} · {providerNames[s.provider]} · {total} respostas utilizáveis
                </caption>
                <thead>
                  <tr>
                    <th>Faixa nominal</th>
                    <th>Respostas</th>
                    <th>Confiança média</th>
                    <th>Acerto exato</th>
                    <th>Diferença</th>
                    <th>Peso</th>
                    <th>Contribuição</th>
                  </tr>
                </thead>
                <tbody>
                  {s.calibration.map((b, j) => (
                    <tr key={j}>
                      <th>{j === 0 ? 'Até 60%*' : `${n(b.from * 100)}–${n(b.to * 100)}%`}</th>
                      <td>{b.count}</td>
                      <td>{b.count ? pct(b.confidence, 4) : '—'}</td>
                      <td>
                        {b.count
                          ? `${Math.round(b.accuracy * b.count)}/${b.count} · ${pct(b.accuracy, 4)}`
                          : '—'}
                      </td>
                      <td>
                        {b.count ? `${n(Math.abs(b.accuracy - b.confidence) * 100, 4)} p.p.` : '—'}
                      </td>
                      <td>{total ? pct(b.count / total, 4) : '—'}</td>
                      <td>
                        {total
                          ? `${n((b.count / total) * Math.abs(b.accuracy - b.confidence) * 100, 5)} p.p.`
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th colSpan={6}>Soma das contribuições = ECE do boletim</th>
                    <td>
                      <strong>{s.ece === null ? 'Não calculado' : pct(s.ece, 5)}</strong>
                    </td>
                  </tr>
                </tfoot>
              </Table>
              <p>
                * A primeira faixa também recebe valores abaixo de 50%. Rótulos são nominais; veja a
                regra exata na aba ECE. Os cálculos usam a precisão registrada; o arredondamento é
                só para exibição.
              </p>
            </div>
          );
        })}
        <p>
          O boletim das reuniões não calcula ECE. Aqui reproduzimos os ECE existentes de Resiliência
          e Imagens, sem criar uma nova métrica para aquela prova.
        </p>
        <Detail title="Quem entra no denominador? E se a API falhar?">
          <p>
            <strong>Brier:</strong> entram somente os itens com respostas utilizáveis de todos os
            participantes daquela prova. Assim, cada modelo é comparado no mesmo conjunto. Recusa e
            falha não viram Brier zero. Sem itens comuns, o resultado é ausente, não perfeito.
          </p>
          <p>
            <strong>ECE:</strong> cada modelo usa suas próprias respostas utilizáveis. Com falhas,
            os conjuntos podem diferir; comparar os ECE sem checar a cobertura pode enganar. Nesta
            edição, as três execuções selecionadas estão completas e sem falhas de serviço.
          </p>
          <p>
            Itens anulados são removidos antes das métricas. Respostas de revisão humana com
            distribuição válida continuam nas contas. A nota de Resiliência pondera baterias e
            grupos; Brier e ECE são calculados por item, sem reaplicar aqueles pesos. A ausência de
            resposta continua aparecendo separadamente no placar.
          </p>
        </Detail>
      </section>
      <section
        id="lesson-limites"
        className="tab-panel metric-lesson"
        role="tabpanel"
        aria-labelledby="lesson-tab-limites"
        hidden
      >
        <h2>Qual pergunta cada métrica responde?</h2>
        <Table label="Comparação de métricas">
          <thead>
            <tr>
              <th>Métrica</th>
              <th>Pergunta</th>
              <th>O que entra</th>
              <th>Limite da leitura</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th>Pontos / acerto</th>
              <td>Decidiu conforme a regra?</td>
              <td>Gabarito, limiar binário e tolerância de escala</td>
              <td>Não descreve toda a distribuição de probabilidades.</td>
            </tr>
            <tr>
              <th>Brier · 0 a 2</th>
              <td>As probabilidades ficaram perto do que aconteceu?</td>
              <td>Todas as alternativas e o gabarito</td>
              <td>Mistura qualidade preditiva e calibração; não isola a calibração.</td>
            </tr>
            <tr>
              <th>ECE · 0% a 100%</th>
              <td>A confiança combina com o acerto nos grupos?</td>
              <td>Maior probabilidade, acerto exato e faixas</td>
              <td>Pode ser baixo em um modelo que discrimina pouco os casos.</td>
            </tr>
          </tbody>
        </Table>
        <h2>Por que um vence no Brier e outro no ECE?</h2>
        <p>
          Na Resiliência, Decisions teve ECE de{' '}
          <strong>
            {pct(d.brava.report.standings.find((s) => s.provider === 'decisions')!.ece!, 3)}
          </strong>
          . Clef teve o menor Brier,{' '}
          <strong>
            {n(d.brava.report.standings.find((s) => s.provider === 'clef')!.brier!, 6)}
          </strong>
          . O primeiro resumiu melhor a correspondência entre confiança e acerto nas faixas; o
          segundo teve menor erro quadrático nas probabilidades. Isso não obriga o Clef a ter mais
          pontos: nesta prova, Decisions fez a maior nota.
        </p>
        <Detail title="Como o desempate realmente funciona na arena?">
          <p>
            Nas <strong>reuniões</strong>, o Brier entra quando há igualdade de pontos. Em{' '}
            <strong>Resiliência e Imagens</strong>, entram no desempate os modelos a menos de 1
            ponto do maior resultado na escala de 0 a 100. Nesses empates, o menor Brier só decide
            se a diferença para o segundo menor é de pelo menos <strong>0,005</strong>; caso
            contrário, o empate permanece.
          </p>
          <p>
            Na Resiliência, Decisions fez 98,11 pontos e Clef 97,44: distância de aproximadamente
            0,67 ponto. A vantagem de Brier do Clef foi aproximadamente 0,00653, suficiente pela
            regra. <strong>ECE não é critério de desempate.</strong> Falhas capazes de mudar a
            liderança podem tornar o resultado inconclusivo.
          </p>
        </Detail>
        <Detail title="Poucas respostas podem produzir um ECE enganoso?">
          <p>
            Sim. Com três respostas em uma faixa, um único acerto a mais ou a menos muda a taxa de
            acerto em cerca de 33,3 pontos percentuais. A contribuição para o ECE geral ainda é
            multiplicada pelo peso dessa faixa.
          </p>
          <p>
            O número e os limites das faixas também mudam o resultado. Dentro de uma faixa, excesso
            e falta de confiança em subgrupos podem se compensar antes do valor absoluto. ECE zero
            no agregado pode esconder problemas por classe, contexto ou grupo.
          </p>
          <p>
            Nas imagens, os ECE foram {pct(d.visual.report.standings[0].ece!, 3)} e{' '}
            {pct(d.visual.report.standings[1].ece!, 3)}: proximidade que não sustenta uma
            preferência prática. Não calculamos intervalo de confiança do ECE nesta edição.
          </p>
        </Detail>
        <Detail title="Como usar isso para escolher um modelo?">
          <p>
            Comece pela qualidade da decisão e pelo custo dos erros no seu cenário. Use Brier para
            avaliar as probabilidades e ECE para examinar limiares de confiança. Olhe também revisão
            humana, cobertura, custo e tempo. Revalide tudo em exemplos representativos da sua
            aplicação.
          </p>
          <p>
            Um modelo pode reduzir erros automáticos ao mandar mais casos para revisão. A arena usa
            revisão binária quando a probabilidade de Sim fica estritamente entre 20% e 80%; nos
            limites, 20% leva a Não e 80% a Sim. Esses valores são uma política desta demonstração,
            não uma recomendação universal de segurança.
          </p>
        </Detail>
        {intervals}
        <details className="plain-details">
          <summary>
            Fórmulas, implementação e referências
            <ChevronDown size={16} />
          </summary>
          <p>
            Fonte do cálculo nesta edição: <code>shared/scoring.ts · brier</code>; população comum e
            desempate em <code>shared/report.ts</code>; faixas, ECE, itens anulados e desempate em{' '}
            <code>shared/brava-report.ts</code>. A versão das regras está registrada no capítulo
            Evidências e limites.
          </p>
          <p>
            Para aprofundar calibração:{' '}
            <a
              href="https://proceedings.mlr.press/v70/guo17a.html"
              target="_blank"
              rel="noreferrer"
            >
              Guo et al., On Calibration of Modern Neural Networks (2017)
            </a>
            . As cinco faixas e as regras de pontuação descritas aqui são escolhas da arena.
          </p>
        </details>
      </section>
    </>
  );
}
