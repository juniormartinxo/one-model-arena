import { randomInt } from 'node:crypto';
import { z } from 'zod';
import type {
  JudgePass,
  Mapping,
  Participant,
  Provider,
  Question,
  Run,
  Verdict,
} from '../shared/types';
import { runProviders } from '../shared/types';
const bounded = z.string().min(1).max(3000);
const letters: Participant[] = ['A', 'B', 'C'];
const listed = (items: string[]) =>
  items.length > 1 ? `${items.slice(0, -1).join(', ')} e ${items.at(-1)}` : items.join('');
const participantsOf = (mapping: Mapping) => letters.filter((l) => mapping[l]);
const participantReferences = (mapping: Mapping) => {
  const ids = participantsOf(mapping);
  return `Nos campos de texto, escreva os participantes exclusivamente como ${listed(ids.map((l) => `[[${l}]]`))}, inclusive em resumos, evidências e limitações. Preserve ${ids.join('/')} sem colchetes apenas nos campos enum winner e participant. O aplicativo revelará os nomes depois do julgamento.`;
};
export const narrationSchema = z.object({
  introduction: bounded,
  rounds: z.array(z.object({ id: z.string(), transition: z.string().min(1).max(500) })).length(6),
});
export const feedbackSchema = z.object({
  winner: z.enum(['A', 'B', 'C', 'tie', 'inconclusive']),
  text: z.string().min(1).max(1500),
});
export const judgeSchema = z.object({
  winner: z.enum(['A', 'B', 'C', 'tie', 'inconclusive']),
  summary: bounded,
  evidence: z
    .array(
      z.object({
        roundId: z.string(),
        participant: z.enum(['A', 'B', 'C', 'both']),
        observation: bounded,
      }),
    )
    .min(1)
    .max(12),
  limitations: z.array(bounded).min(1).max(5),
});
export type { Mapping };
function assign(order: Provider[]): Mapping {
  return Object.fromEntries(order.map((p, i) => [letters[i], p])) as Mapping;
}
function shuffled(items: Provider[]) {
  const order = [...items];
  for (let i = order.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}
export function blindMapping(participants: Provider[]): Mapping {
  return assign(shuffled(participants));
}
// Cyclic rotations of one random order: every participant takes every position exactly once.
export function judgeRotations(participants: Provider[]): Mapping[] {
  const order = shuffled(participants);
  return order.map((_, shift) => assign([...order.slice(shift), ...order.slice(0, shift)]));
}
// Translates a blind winner letter back to its provider.
export function revealWinner(mapping: Mapping, winner: Participant | 'tie' | 'inconclusive') {
  return winner === 'tie' || winner === 'inconclusive'
    ? winner
    : (mapping[winner] ?? 'inconclusive');
}
function scoringRule(question: Question) {
  if (question.type === 'choice')
    return 'Choice: 1 ponto se o valor escolhido coincide com o gabarito; caso contrário, 0. Não existe limiar de probabilidade nem tolerância numérica para choice. Escolher esclarecer ou revisar pode valer 1 ponto quando essa é a ação prevista no gabarito.';
  if (question.type === 'predicate')
    return 'Predicate: valor é a probabilidade de Sim. Sim >= 0.8; Não <= 0.2. Entre os limites, a ação é revisão humana e vale 0 ponto. Uma decisão Sim/Não aderente ao gabarito vale 1 ponto. Não existe tolerância de score para predicate.';
  return 'Score: 1 ponto se a distância entre o valor retornado e o nível de referência for no máximo 0.4; caso contrário, 0. Os limiares de predicate não se aplicam a score.';
}
export function blindData(run: Run, mapping: Mapping, onlyRound?: string) {
  return {
    scenario: { title: run.scenario.title, context: run.scenario.context },
    scoring:
      'Pontos e grade já foram calculados pelo aplicativo. Explique-os pela scoringRule específica de cada rodada; não use regras de outro tipo de pergunta. Incerteza e indisponibilidade são diferentes de erro. As distribuições e a confiança declarada foram omitidas: não mudam a pontuação de choice e não são evidência de precisão.',
    rounds: run.rounds
      .filter((r) => !onlyRound || r.roundId === onlyRound)
      .map((r) => {
        const original = run.scenario.rounds.find((o) => o.id === r.roundId)!;
        const participant = (p: Provider) => {
          const value = r.results[p];
          return {
            answer: value?.answer ? { type: value.answer.type, value: value.answer.value } : null,
            grade: value?.grade ?? null,
            points: value?.grade.status === 'correct' ? 1 : 0,
            unavailable: !value?.answer || value.answer.type === 'refusal',
          };
        };
        return {
          roundId: r.roundId,
          title: original.title,
          facts: original.facts,
          question: original.question,
          scoringRule: scoringRule(original.question),
          ...(Object.fromEntries(
            participantsOf(mapping).map((l) => [l, participant(mapping[l]!)]),
          ) as Partial<Record<Participant, ReturnType<typeof participant>>>),
        };
      }),
  };
}
export function narrationPrompt(run: Run) {
  return `Prepare uma abertura curta e uma transição de até duas frases por rodada para uma reunião em português. Faça as transições como um apresentador, antes de cada pergunta. As perguntas e critérios abaixo estão congelados e serão exibidos literalmente: não altere nem proponha novos fatos, respostas ou gabaritos. Não mencione vencedores. Retorne os seis ids na mesma ordem. Dados:\n${JSON.stringify({ title: run.scenario.title, context: run.scenario.context, rounds: run.scenario.rounds.map((r) => ({ id: r.id, title: r.title, facts: r.facts, question: r.question.text })) })}`;
}
export function commentaryPrompt(run: Run, mapping: Mapping, roundId: string) {
  const ids = participantsOf(mapping);
  return `Comente esta rodada de uma reunião em até 100 palavras, em português. Compare a contribuição das decisões dos participantes ${listed(ids)} com os fatos e a regra de referência. Explique os pontos já calculados usando apenas a scoringRule desta rodada; não invente outros limiares, probabilidades ou justificativas internas dos modelos. Escolha um participante apenas se ele contribuiu mais que todos os outros; se não houver um único melhor, dê empate. Se qualquer participante estiver indisponível, dê inconclusive: falta de resposta não prova inferioridade. Não use marcas, custo nem velocidade. ${participantReferences(mapping)} Dados:\n${JSON.stringify(blindData(run, mapping, roundId))}`;
}
export function judgePrompt(run: Run, mapping: Mapping) {
  const ids = participantsOf(mapping);
  return `Julgue a contribuição para esta reunião em português, usando apenas os fatos, decisões e rubrica fornecidos. Cite roundId reais nas evidências. Compare aderência aos fatos, prioridade correta, revisão humana apropriada e mudança adequada diante de nova evidência. Escolha ${ids.join('/')} apenas com vantagem concreta sobre todos os demais participantes; sem um único melhor, use tie. Qualquer rodada sem decisão utilizável de um participante torna o veredito global inconclusive; comente o que ainda foi observado. Não trate a pequena amostra como benchmark universal nem confiança como precisão. Não invente raciocínios dos participantes. Inclua limites do teste. ${participantReferences(mapping)} Dados:\n${JSON.stringify(blindData(run, mapping))}`;
}
export function combineVerdicts(passes: JudgePass[], run: Run): Verdict {
  const participants = runProviders(run);
  const unavailable = run.rounds.some((r) =>
    participants.some((p) => !r.results[p]?.answer || r.results[p]?.answer?.type === 'refusal'),
  );
  const winners = passes.map((p) => revealWinner(p.mapping, p.result.winner));
  if (unavailable || passes.length !== participants.length || winners.some((w) => w !== winners[0]))
    return {
      winner: 'inconclusive',
      summary: unavailable
        ? 'Há decisões ausentes. A comparação de qualidade ficou incompleta.'
        : 'O julgamento mudou ao trocar as posições dos participantes. Resultado inconclusivo.',
      passes,
    };
  return { winner: winners[0], summary: passes[0].result.summary, passes };
}
