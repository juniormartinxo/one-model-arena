import React from 'react';
import { ArrowRight, ArrowUpRight, Pause, Play } from 'lucide-react';

export function Home() {
  return (
    <div className="home-hero">
      <div className="home-copy">
        <h1 tabIndex={-1}>
          Modelos.
          <br />
          <span>À prova.</span>
        </h1>
        <p className="home-statement">
          A mesma pergunta.
          <br />O que muda é a resposta.
        </p>
        <p className="home-description">
          Uma arena para comparar decisões de IA em português. Testes visíveis, critérios explícitos
          e espaço para olhar além do vencedor.
        </p>
        <div className="home-actions">
          <a className="primary" href="#modelos" data-chapter-link>
            Conhecer os modelos <ArrowRight size={17} />
          </a>
          <a className="quiet" href="#visao-geral" data-chapter-link>
            Ver a conclusão <ArrowUpRight size={17} />
          </a>
        </div>
      </div>
      <div className="arena-art">
        <canvas aria-hidden="true" />
        <div className="arena-art-center" aria-hidden="true">
          <span>ONE</span>
          <span>MODEL</span>
          <span>ARENA</span>
        </div>
        <div className="arena-art-caption">
          <span>O mesmo desafio. Diferentes decisões.</span>
          <button
            type="button"
            className="motion-toggle"
            data-home-motion
            aria-label="Pausar animação"
            aria-pressed="false"
          >
            <span data-motion-icon="pause">
              <Pause size={13} />
            </span>
            <span data-motion-icon="play" hidden>
              <Play size={13} />
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
