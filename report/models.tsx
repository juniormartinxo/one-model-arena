import React from 'react';
import { ArrowUpRight, AudioLines } from 'lucide-react';
import type { Provider } from '../shared/types';
import type { ConclusionData } from './data';

const profiles = [
  {
    id: 'jev',
    name: 'Jev',
    company: 'TypeSafe AI',
    summary:
      'Modelo feito para decisões estruturadas dentro de software. Recebe contexto e perguntas com alternativas definidas, devolvendo probabilidades que o sistema pode usar para decidir ou pedir revisão.',
    input: 'Texto e dados estruturados. O Jev 1.13 não recebe imagens, áudio ou vídeo.',
    openness: 'Serviço proprietário via API',
    license:
      'Pesos abertos não identificados nas fontes oficiais consultadas. Os SDKs públicos não tornam os pesos do Jev abertos.',
    tested: 'Reuniões e Resiliência. Não participou da prova de imagens.',
    links: [
      ['Modelos e entradas', 'https://docs.typesafe.ai/models'],
      ['Como funciona', 'https://docs.typesafe.ai/introduction'],
      ['SDKs públicos', 'https://github.com/typesafe-ai'],
    ],
  },
  {
    id: 'decisions',
    name: 'Decisions',
    company: 'OpenAI',
    summary:
      'Decisions é o nome da API. Nesta arena, ela usa o modelo gpt-6-luna para responder perguntas de sim/não, escolher alternativas ou avaliar uma escala. É voltada a classificação, encaminhamento e priorização.',
    input: 'Texto e imagens pela API Decisions, com respostas estruturadas e probabilidades.',
    openness: 'Serviço proprietário via API',
    license:
      'Pesos públicos do gpt-6-luna não identificados nas fontes consultadas. Usar a API ou um SDK aberto não permite executar esse modelo localmente.',
    tested: 'Reuniões, Resiliência e Imagens. “Decisions” no placar identifica essa integração.',
    links: [
      ['API Decisions', 'https://developers.openai.com/api/docs/guides/decisions'],
      ['Modelo gpt-6-luna', 'https://developers.openai.com/api/docs/models/gpt-6-luna'],
    ],
  },
  {
    id: 'clef',
    name: 'Clef',
    company: 'Cloudflare',
    summary:
      'Modelo de decisões multimodal com 27 bilhões de parâmetros. Avalia alternativas e devolve probabilidades. A publicação oficial inclui os pesos e código de inferência; a arena usou o serviço Workers AI.',
    input:
      'Texto, imagens e vídeo segundo a ficha oficial. Nesta edição, avaliamos texto e imagens.',
    openness: 'Pesos e código abertos · Apache 2.0',
    license:
      'Pode ser baixado e executado em infraestrutura própria sob a licença publicada. Isso não afirma que todos os dados e o processo de treinamento tenham sido publicados.',
    tested:
      'Reuniões, Resiliência e Imagens. O modelo registrado é clef; não avaliamos Clef-flash nem execução local.',
    links: [
      ['Ficha, pesos e licença', 'https://huggingface.co/Cloudflare/clef'],
      ['Workers AI', 'https://developers.cloudflare.com/workers-ai/models/clef/'],
    ],
  },
] satisfies {
  id: Provider;
  name: string;
  company: string;
  summary: string;
  input: string;
  openness: string;
  license: string;
  tested: string;
  links: string[][];
}[];

export function Models({ data, logos }: { data: ConclusionData; logos: Record<Provider, string> }) {
  return (
    <>
      <header className="chapter-heading">
        <h1 tabIndex={-1}>Quem são Jev, Decisions e Clef?</h1>
        <p>
          Três participantes voltados a decisões estruturadas. Conheça a empresa responsável, o que
          cada um recebe e o que está disponível para usar ou baixar.
        </p>
      </header>
      <video
        className="model-video"
        data-chapter-video
        data-src="/videos/octogono.mp4"
        data-file-src="../public/videos/octogono.mp4"
        aria-label="Jev, Decisions e Clef no octógono"
        muted
        playsInline
        preload="none"
        width={1280}
        height={720}
      >
        Seu navegador não consegue reproduzir este vídeo.
      </video>
      <div className="model-profiles">
        {profiles.map((p) => (
          <article className="model-profile" key={p.id} aria-labelledby={`model-name-${p.id}`}>
            <header className="model-identity">
              <img src={logos[p.id]} width="56" height="56" alt={`Logo da ${p.company}`} />
              <div>
                <h2 id={`model-name-${p.id}`} className={`provider ${p.id}`}>
                  {p.name}
                </h2>
                <p>{p.company}</p>
              </div>
            </header>
            <div className="model-description">
              <p>{p.summary}</p>
              <p>
                <strong>Entradas:</strong> {p.input}
              </p>
              <p>
                <strong>Na nossa bateria:</strong> {p.tested}
              </p>
              <div className="model-sources">
                {p.links.map(([label, url]) => (
                  <a key={url} href={url} target="_blank" rel="noreferrer">
                    {label}
                    <ArrowUpRight size={14} />
                  </a>
                ))}
              </div>
            </div>
            <dl className="model-facts">
              <div>
                <dt>Versão registrada nos testes</dt>
                <dd>
                  <code>
                    {data.models.find((m) => m.provider === p.id)?.versions.join(', ') ||
                      'Não registrada'}
                  </code>
                </dd>
              </div>
              <div>
                <dt>É open source?</dt>
                <dd>
                  <strong>{p.openness}</strong>
                  <p>{p.license}</p>
                </dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
      <aside className="reading-note model-opus">
        <AudioLines size={22} />
        <div>
          <strong>E o Opus?</strong>
          <p>
            É o avaliador e narrador da arena, via Claude CLI, da Anthropic. Comenta respostas após
            avaliação cega; não disputa o placar. Os pontos vêm do gabarito e das regras, e o custo
            do avaliador é separado dos participantes.
          </p>
        </div>
      </aside>
      <details className="plain-details">
        <summary>API, SDK aberto e pesos abertos: qual é a diferença?</summary>
        <p>
          <strong>API</strong> é a interface para usar um serviço remoto. <strong>SDK</strong> é a
          biblioteca que facilita a integração; seu código pode ser aberto enquanto o modelo
          permanece fechado. <strong>Pesos</strong> são os parâmetros treinados necessários para
          executar o modelo.
        </p>
        <p>
          No Clef, a ficha publica pesos e código sob Apache 2.0. Para Jev e gpt-6-luna, as fontes
          consultadas documentam o acesso por API e não apresentam pesos para download. Essa
          classificação descreve o material disponível; não é uma auditoria completa de abertura do
          treinamento.
        </p>
      </details>
      <p className="profile-date">
        Informações consultadas em 09/10/2026. Os links acima são das empresas ou de seus
        repositórios oficiais; as versões testadas vêm das execuções salvas. Recursos anunciados
        pelos fornecedores não equivalem a resultados medidos na arena. Logos das empresas usados
        para identificação.
      </p>
    </>
  );
}
