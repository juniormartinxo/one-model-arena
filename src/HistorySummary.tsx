import { BadgeDollarSign, Scale, Trophy } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { RunSummary } from '../shared/types';
import { isProvider, runProviders } from '../shared/types';
import { providerNames } from '../shared/presentation';

const dollars = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 5,
  maximumFractionDigits: 8,
});

export function HistorySummary({ run }: { run: RunSummary }) {
  const participants = runProviders(run);
  const winner = isProvider(run.winner) ? run.winner : null;
  const cheapest = isProvider(run.cheapest) ? run.cheapest : null;
  const demo = run.mode === 'demo';
  const complete = run.phase === 'complete';
  const interrupted = run.phase === 'cancelled' || run.phase === 'failed';
  return (
    <dl
      className="history-summary"
      aria-label="Resumo da reunião"
      style={{ '--competitors': participants.length } as CSSProperties}
    >
      <div className="history-award">
        <dt>Vencedor</dt>
        <dd className={winner ? `history-provider-${winner}` : ''}>
          {winner ? (
            <Trophy size={19} aria-hidden="true" />
          ) : run.winner === 'tie' ? (
            <Scale size={19} aria-hidden="true" />
          ) : null}
          <strong>
            {winner
              ? providerNames[winner]
              : demo
                ? 'Ensaio'
                : run.winner === 'tie'
                  ? 'Empate'
                  : complete
                    ? 'Inconclusivo'
                    : interrupted
                      ? 'Sem veredito'
                      : 'Aguardando'}
          </strong>
        </dd>
        <small>
          {demo
            ? 'Sem avaliação real'
            : complete
              ? 'Resultado da reunião'
              : interrupted
                ? 'Reunião interrompida'
                : 'Reunião em andamento'}
        </small>
      </div>
      {participants.map((provider) => {
        const cost = run.costs[provider] ?? { knownUsd: 0, unknown: run.completedRounds };
        return (
          <div className={`history-cost-${provider}`} key={provider}>
            <dt className={`history-provider-${provider}`}>
              {providerNames[provider]} · custo total
            </dt>
            <dd className="history-money">
              <strong>
                {demo
                  ? dollars.format(0)
                  : cost.unknown
                    ? cost.knownUsd > 0
                      ? `≥ ${dollars.format(cost.knownUsd)}`
                      : 'Desconhecido'
                    : dollars.format(cost.knownUsd)}
              </strong>
            </dd>
            <small>
              {demo
                ? 'Sem consumo de API'
                : cost.unknown
                  ? `Parcial · ${cost.unknown} sem custo informado`
                  : complete || interrupted
                    ? 'Estimado em USD'
                    : 'Estimado até agora'}
            </small>
          </div>
        );
      })}
      <div className="history-economy">
        <dt>Mais barato</dt>
        <dd className={cheapest ? `history-provider-${cheapest}` : ''}>
          {cheapest && <BadgeDollarSign size={20} aria-hidden="true" />}
          {run.cheapest === 'tie' && <Scale size={19} aria-hidden="true" />}
          <strong>
            {cheapest
              ? providerNames[cheapest]
              : run.cheapest === 'tie'
                ? 'Empate'
                : demo
                  ? 'Não se aplica'
                  : complete || interrupted
                    ? 'Não comparável'
                    : 'Aguardando'}
          </strong>
        </dd>
        <small>
          {demo
            ? 'Dados sintéticos'
            : run.cheapest === 'tie'
              ? 'Mesmo custo estimado'
              : cheapest
                ? 'Menor custo total'
                : !complete
                  ? 'Sem comparação final'
                  : 'Consumo desconhecido'}
        </small>
      </div>
    </dl>
  );
}
