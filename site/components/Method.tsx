import { useState } from 'react';
import { ArrowRight, Check, LockKeyhole, Shuffle, Scale } from 'lucide-react';
import { tabKeys } from './Results';
const steps = [
  {
    title: 'O contexto é o mesmo.',
    text: 'Cada participante recebe os mesmos fatos e a mesma pergunta, adaptados apenas ao contrato da sua API.',
    Icon: Shuffle,
  },
  {
    title: 'A referência vem antes.',
    text: 'Perguntas, critérios e gabaritos são definidos antes das respostas. A pontuação é calculada por regras explícitas.',
    Icon: LockKeyhole,
  },
  {
    title: 'A análise vem depois.',
    text: 'O Opus comenta com identidades A/B/C. Sua interpretação fica separada da pontuação pelo gabarito.',
    Icon: Scale,
  },
];
export function Method() {
  const [step, setStep] = useState(0);
  const [confidence, setConfidence] = useState(80);
  const brier = 2 * (1 - confidence / 100) ** 2;
  return (
    <section className="method-section" id="metodo" aria-labelledby="method-title">
      <div className="section-shell">
        <div className="section-heading">
          <h2 id="method-title">
            O caminho importa
            <br />
            <span>tanto quanto o placar.</span>
          </h2>
          <p>
            Uma comparação precisa deixar rastros.
            <br />
            Da pergunta à nota, cada etapa tem um papel.
          </p>
        </div>
        <div className="method-workbench">
          <div
            className="method-steps"
            role="tablist"
            aria-label="Etapas do método"
            aria-orientation="vertical"
            onKeyDown={tabKeys}
          >
            {steps.map((s, i) => (
              <button
                role="tab"
                aria-selected={step === i}
                aria-controls={`method-panel-${i}`}
                id={`method-tab-${i}`}
                tabIndex={step === i ? 0 : -1}
                key={s.title}
                onClick={() => setStep(i)}
              >
                <span className="step-number">0{i + 1}</span>
                <span>
                  <strong>{s.title}</strong>
                  <span>{s.text}</span>
                </span>
                <ArrowRight size={19} />
              </button>
            ))}
          </div>
          <div
            className="method-example"
            role="tabpanel"
            id={`method-panel-${step}`}
            aria-labelledby={`method-tab-${step}`}
            key={step}
            tabIndex={0}
          >
            {step === 0 ? (
              <>
                <div className="example-document">
                  <h3>Uma decisão. O mesmo contexto.</h3>
                  <p className="example-label">Exemplo didático · não é resposta de modelo.</p>
                  <p>
                    Uma despesa pode ser aprovada se não ultrapassar R$ 500. O pedido é de R$ 480.
                  </p>
                  <div className="example-question">A despesa pode ser aprovada?</div>
                </div>
                <div className="example-fan" aria-label="Contexto idêntico para cada participante">
                  <span>Participante A</span>
                  <span>Participante B</span>
                  <span>Participante C</span>
                </div>
                <p className="example-note">
                  Nenhum participante recebe o gabarito ou a resposta dos demais.
                </p>
              </>
            ) : step === 1 ? (
              <>
                <div className="example-document">
                  <LockKeyhole size={27} />
                  <h3>O gabarito já estava definido.</h3>
                  <p className="example-label">Exemplo didático · não é resposta de modelo.</p>
                  <p>R$ 480 está dentro do limite de R$ 500.</p>
                  <div className="reference-answer">
                    <Check size={20} />
                    <span>
                      Resposta esperada: <strong>sim</strong>
                    </span>
                  </div>
                </div>
                <p className="example-note">
                  Perguntas de sim/não usam limiares de confiança. A arena marca respostas entre 20%
                  e 80% para revisão humana; o modelo não solicita essa revisão.
                </p>
              </>
            ) : (
              <>
                <div className="example-document">
                  <Scale size={27} />
                  <h3>Comentário não vale ponto.</h3>
                  <p className="example-label">Exemplo didático · não é resposta de modelo.</p>
                  <p>
                    A regra determina a pontuação. O Opus recebe as identidades ocultas e interpreta
                    acertos e divergências.
                  </p>
                  <div className="separated-roles">
                    <span>
                      Gabarito <ArrowRight size={15} /> Pontos
                    </span>
                    <span>
                      Opus <ArrowRight size={15} /> Análise
                    </span>
                  </div>
                </div>
                <p className="example-note">
                  O comentário é uma leitura do avaliador, não uma explicação produzida pelos
                  modelos concorrentes.
                </p>
              </>
            )}
          </div>
        </div>
        <div className="calibration-explainer">
          <div>
            <h3>
              Probabilidades e gabarito.
              <br />O Brier mede a distância.
            </h3>
            <p>
              O Brier compara a confiança declarada com o gabarito. Menor é melhor. Neste exemplo
              binário, a resposta correta é “sim”. Mova a confiança para ver a diferença.
            </p>
            <a className="inline-link" href="#limites">
              Conheça as outras métricas <ArrowRight size={16} />
            </a>
          </div>
          <div className="calibration-control">
            <label htmlFor="confidence">
              Confiança em “sim”<output htmlFor="confidence">{confidence}%</output>
            </label>
            <input
              id="confidence"
              type="range"
              min="0"
              max="100"
              value={confidence}
              onChange={(e) => setConfidence(Number(e.target.value))}
              style={{ '--confidence': `${confidence}%` } as React.CSSProperties}
            />
            <div className="range-ends">
              <span>Certeza errada</span>
              <span>Certeza correta</span>
            </div>
            <div className="brier-readout">
              <span>Brier deste exemplo</span>
              <output aria-live="polite">
                {brier.toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </output>
              <small>Escala de 0 a 2 · menor é melhor</small>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
