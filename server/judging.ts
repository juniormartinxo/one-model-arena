import { randomInt } from 'node:crypto';
import { z } from 'zod';
import type {
  Brava,
  BravaBattery,
  BravaItem,
  BravaReport,
  DecisionReason,
  Mapping,
  Participant,
  Provider,
  Question,
  Run,
  SeriesReport,
  Standing,
} from '../shared/types';
import { CALIBRATION_MARGIN } from '../shared/report';
const bounded = z.string().min(1).max(3000);
const letters: Participant[] = ['A', 'B', 'C'];
const listed = (items: string[]) =>
  items.length > 1 ? `${items.slice(0, -1).join(', ')} e ${items.at(-1)}` : items.join('');
const participantsOf = (mapping: Mapping) => letters.filter((l) => mapping[l]);
const participantReferences = (mapping: Mapping) => {
  const ids = participantsOf(mapping);
  return `Nos campos de texto, escreva os participantes exclusivamente como ${listed(ids.map((l) => `[[${l}]]`))}, inclusive em resumos, evidências e limitações. Preserve ${ids.join('/')} sem colchetes apenas no campo enum participant. O aplicativo revelará os nomes depois do julgamento.`;
};
export const narrationSchema = z.object({
  introduction: bounded,
  rounds: z.array(z.object({ id: z.string(), transition: z.string().min(1).max(500) })).length(6),
});
export const feedbackSchema = z.object({ text: z.string().min(1).max(1500) });
const evidence = z
  .array(
    z.object({
      roundId: z.string(),
      participant: z.enum(['A', 'B', 'C', 'both']),
      observation: bounded,
    }),
  )
  .min(1)
  .max(12);
export const analysisSchema = z.object({
  summary: bounded,
  evidence,
  limitations: z.array(bounded).min(1).max(5),
});
export const seriesAnalysisSchema = analysisSchema.extend({
  headline: z.string().min(1).max(140),
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
// Translates the objective winner into the blind letter shown to Opus.
export function blindWinner(mapping: Mapping, winner: Provider | 'tie' | 'inconclusive') {
  return winner === 'tie' || winner === 'inconclusive'
    ? winner
    : participantsOf(mapping).find((l) => mapping[l] === winner)!;
}
function blindStandings(table: Standing[], mapping: Mapping) {
  return Object.fromEntries(
    participantsOf(mapping).map((l) => {
      const s = table.find((x) => x.provider === mapping[l])!;
      return [
        l,
        {
          points: s.correct,
          diverged: s.incorrect,
          humanReview: s.uncertain,
          unavailable: s.unavailable,
          questions: s.total,
          meanBrier: s.brier === null ? null : Number(s.brier.toFixed(4)),
        },
      ];
    }),
  );
}
const reasons: Record<DecisionReason, string> = {
  points: 'o vencedor fez mais pontos pelo gabarito',
  calibration: `houve empate em pontos; venceu quem teve Brier médio menor, com diferença mínima de ${CALIBRATION_MARGIN}`,
  tie: 'empate: mesmos pontos e calibração equivalente',
  unavailable: 'sem vencedor: respostas ausentes poderiam mudar a liderança',
};
const outcome = (
  mapping: Mapping,
  winner: Provider | 'tie' | 'inconclusive',
  reason: DecisionReason,
  table: Standing[],
) => ({
  winner: blindWinner(mapping, winner),
  rule: reasons[reason],
  brierNote:
    'Brier mede a distância entre as probabilidades e o gabarito: 0 é certeza correta, 2 é certeza errada. Só compara rodadas respondidas por todos.',
  standings: blindStandings(table, mapping),
});
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
export function commentaryPrompt(
  run: Run,
  mapping: Mapping,
  roundId: string,
  winner: Provider | 'tie' | 'inconclusive',
) {
  const ids = participantsOf(mapping);
  return `Comente esta rodada de uma reunião em até 100 palavras, em português, para o público de um vídeo. Compare as decisões dos participantes ${listed(ids)} com os fatos e a regra de referência. O resultado da rodada já foi decidido pelo gabarito e não muda: ${JSON.stringify(blindWinner(mapping, winner))} (tie: nenhum participante se destacou sozinho; inconclusive: faltou resposta). Explique os pontos usando apenas a scoringRule desta rodada; não invente limiares, probabilidades ou justificativas internas dos modelos. Falta de resposta não prova inferioridade. Não use marcas, custo nem velocidade. ${participantReferences(mapping)} Dados:\n${JSON.stringify(blindData(run, mapping, roundId))}`;
}
export function analysisPrompt(
  run: Run,
  mapping: Mapping,
  decision: { winner: Provider | 'tie' | 'inconclusive'; reason: DecisionReason },
  table: Standing[],
) {
  return `Explique em português, para o público de um vídeo, o resultado desta reunião. O resultado já foi decidido pelo aplicativo com uma regra objetiva e não deve ser contestado nem alterado: ${JSON.stringify(outcome(mapping, decision.winner, decision.reason, table))}. Mostre em que rodadas as decisões se separaram e por quê, com roundId reais nas evidências. Só fale em calibração se ela decidiu o resultado. Não trate a pequena amostra como benchmark universal nem confiança como precisão. Não invente raciocínios dos participantes. Inclua limites do teste. ${participantReferences(mapping)} Dados:\n${JSON.stringify(blindData(run, mapping))}`;
}
export function seriesAnalysisPrompt(runs: Run[], report: SeriesReport, mapping: Mapping) {
  const data = {
    outcome: outcome(mapping, report.winner, report.reason, report.standings),
    batteries: report.batteries.map((b) => ({
      label: b.label,
      questions: b.total,
      points: Object.fromEntries(participantsOf(mapping).map((l) => [l, b.correct[mapping[l]!]])),
    })),
    meetings: runs.map((r) => r.scenario.title),
    divergences: runs.flatMap((r) =>
      blindData(r, mapping).rounds.filter((round) =>
        participantsOf(mapping).some((l) => round[l]?.points !== 1),
      ),
    ),
  };
  return `Escreva a leitura final de uma "Maratona de reuniões" com ${runs.length} reuniões fictícias em português, com ${report.decisions} decisões por participante, para o público de um vídeo. O vencedor já foi decidido pelo aplicativo com regra objetiva e não deve ser contestado: veja outcome. Dê uma manchete curta e verdadeira (headline, até 140 caracteres), um resumo de até 150 palavras e evidências com roundId reais, priorizando as rodadas em divergences. Diga onde cada participante se destacou ou tropeçou, por bateria, sem exagero. Se todos empataram, diga isso com clareza: empate também é resultado. Não use marcas, custo nem velocidade; esses números são mostrados separadamente pelo aplicativo. Não invente raciocínios dos participantes nem trate a amostra como benchmark universal. Inclua limites do teste. ${participantReferences(mapping)} Dados:\n${JSON.stringify(data)}`;
}

// --- Rodada brava: Opus opens, comments each battery and writes the final reading, all blind ---
export const bravaIntroSchema = z.object({ introduction: bounded });
const bravaItem = (brava: Brava, item: BravaItem, mapping: Mapping) => ({
  itemId: item.id,
  title: item.title,
  facts: item.facts,
  question: item.question.text,
  options: item.question.options?.map((o) => `${o.value}: ${o.label}`),
  expected: String(item.question.expected),
  ...Object.fromEntries(
    participantsOf(mapping).map((l) => {
      const r = brava.results[item.id]?.[mapping[l]!];
      return [
        l,
        r?.answer && r.answer.type !== 'refusal'
          ? { answer: r.answer.value, grade: r.grade.status }
          : { answer: null, grade: 'unavailable' },
      ];
    }),
  ),
});
const sensitiveNote =
  'Alguns textos são comentários reais de redes sociais e podem conter ofensas: nunca reproduza esses trechos; descreva-os em termos gerais.';
// Opus never sees the photos: it reads the question, the options, the reference and the answers.
const visualNote =
  'Você não vê as fotos: use só a pergunta, as alternativas, o gabarito e as respostas, sem descrever o conteúdo das imagens além do que a pergunta diz.';
export function bravaIntroPrompt(brava: Brava) {
  if (brava.kind === 'visual')
    return `Escreva uma abertura curta, de até 70 palavras, em português, para a "rodada das imagens" de um vídeo: a terceira rodada, em que modelos de decisão estruturada olham fotos reais e escolhem entre alternativas. Só ${brava.providers.length} participantes leem imagens. Explique em linguagem simples o que será testado, sem prometer vencedor e sem citar marcas. Baterias: ${JSON.stringify(brava.batteries.map((b) => ({ title: b.title, description: b.description, items: b.itemIds.length })))}`;
  return `Escreva uma abertura curta, de até 70 palavras, em português, para a "Resiliência" de um vídeo: uma segunda bateria de testes, mais difícil, para modelos de decisão estruturada. Explique em linguagem simples o que será testado, sem prometer vencedor e sem citar marcas. Baterias: ${JSON.stringify(brava.batteries.map((b) => ({ title: b.title, description: b.description, items: b.itemIds.length })))}`;
}
export function batteryCommentPrompt(
  brava: Brava,
  battery: BravaBattery,
  mapping: Mapping,
  scores: Record<Participant, number>,
) {
  const items = battery.itemIds
    .map((id) => brava.items.find((i) => i.id === id)!)
    .filter((i) =>
      participantsOf(mapping).some(
        (l) => brava.results[i.id]?.[mapping[l]!]?.grade.status !== 'correct',
      ),
    )
    .slice(0, 14)
    .map((i) => bravaItem(brava, i, mapping));
  const visual = brava.kind === 'visual';
  return `Comente em até 100 palavras, em português, para o público de um vídeo, o resultado da bateria "${battery.title}". O que ela testa: ${battery.description} As notas já foram calculadas pelo aplicativo (fração de ${battery.unit === 'grupo' ? 'grupos inteiros acertados' : 'itens acertados'}) e não mudam: ${JSON.stringify(scores)}. Use os erros listados para explicar onde cada participante tropeçou, citando ${visual ? 'o tipo de pergunta' : 'o tipo de armadilha'}. Se ninguém errou, diga isso. ${visual ? 'Compare as notas com o acerto do chute descrito na bateria. ' : ''}Não invente raciocínios dos modelos nem use marcas, custo ou velocidade. ${visual ? visualNote : sensitiveNote} ${participantReferences(mapping)} Itens com algum erro: ${JSON.stringify(items)}`;
}
const perturbationNames = {
  ordem: 'mesmas alternativas em ordem invertida',
  ruido: 'texto irrelevante acrescentado antes dos fatos',
  digitacao: 'erros de digitação nos fatos',
  direcao: 'uma evidência a mais a favor do gabarito acrescentada aos fatos',
} as const;
export function bravaAnalysisPrompt(brava: Brava, report: BravaReport, mapping: Mapping) {
  const letter = (p: Provider) => participantsOf(mapping).find((l) => mapping[l] === p)!;
  const outcome = {
    winner: blindWinner(mapping, report.winner),
    rule: `${reasons[report.reason]}. A nota geral é a média simples das notas das baterias.`,
    overall: Object.fromEntries(
      report.standings.map((s) => [letter(s.provider), Number(s.score.toFixed(3))]),
    ),
    margins: report.margins.map((m) => ({
      vs: letter(m.vs),
      interval95: [Number(m.low.toFixed(3)), Number(m.high.toFixed(3))],
      withinMargin: m.within,
    })),
  };
  const batteries = report.batteries.map((b) => ({
    title: b.title,
    units: b.units,
    scores: Object.fromEntries(
      report.participants.map((p) => [letter(p), Number(b.scores[p].toFixed(3))]),
    ),
  }));
  const calibration = Object.fromEntries(
    report.standings.map((s) => [letter(s.provider), { meanBrier: s.brier, ece: s.ece }]),
  );
  const examples = report.divergences.slice(0, 20).map((d) =>
    bravaItem(
      brava,
      brava.items.find((i) => i.id === d.itemId)!,
      mapping,
    ),
  );
  if (brava.kind === 'visual')
    return `Escreva a leitura final da "rodada das imagens", ${report.items} perguntas sobre fotos reais do CV-Bench, para o público de um vídeo. O vencedor já foi decidido pelo aplicativo com regra objetiva e não deve ser contestado: veja outcome. Se o intervalo de 95% de uma diferença inclui zero (withinMargin), diga que a diferença está dentro da margem de erro. Dê uma manchete curta e verdadeira (headline, até 140 caracteres), um resumo de até 160 palavras e evidências com os itemId reais no campo roundId. Diga em que cada participante foi forte ou fraco, por bateria, comparando com o acerto do chute de cada bateria (descrito em batteryDescriptions), e fale de calibração quando for relevante. Não use marcas, custo nem velocidade. Não invente raciocínios. ${visualNote} Inclua limites do teste, como a amostra pequena e o dataset ser público desde 2024. ${participantReferences(mapping)} Dados:\n${JSON.stringify({ outcome, batteries, batteryDescriptions: Object.fromEntries(brava.batteries.map((b) => [b.title, b.description])), calibration, examples })}`;
  const data = {
    outcome: {
      winner: blindWinner(mapping, report.winner),
      rule: `${reasons[report.reason]}. A nota geral é a média simples das notas das baterias.`,
      overall: Object.fromEntries(
        report.standings.map((s) => [letter(s.provider), Number(s.score.toFixed(3))]),
      ),
      margins: report.margins.map((m) => ({
        vs: letter(m.vs),
        interval95: [Number(m.low.toFixed(3)), Number(m.high.toFixed(3))],
        withinMargin: m.within,
      })),
    },
    batteries: report.batteries.map((b) => ({
      title: b.title,
      units: b.units,
      scores: Object.fromEntries(
        report.participants.map((p) => [letter(p), Number(b.scores[p].toFixed(3))]),
      ),
    })),
    // Descriptive names: short keys led Opus to call the added evidence an inverted question.
    robustnessDecisionChanges: Object.fromEntries(
      report.standings.map((s) => [
        letter(s.provider),
        Object.fromEntries(
          Object.entries(s.flips).map(([variant, d]) => [
            perturbationNames[variant as keyof typeof perturbationNames],
            {
              questions: d.compared,
              decisionChanged: d.changed,
              towardReferenceAnswer: d.toward,
              awayFromReferenceAnswer: d.away,
            },
          ]),
        ),
      ]),
    ),
    annulledItems: report.annulled.map((a) => ({ itemId: a.itemId, reason: a.reason })),
    calibration: Object.fromEntries(
      report.standings.map((s) => [letter(s.provider), { meanBrier: s.brier, ece: s.ece }]),
    ),
    abstention: Object.fromEntries(
      report.standings.map((s) => [
        letter(s.provider),
        { guessedInsteadOfAbstaining: s.invented, of: s.abstentionItems },
      ]),
    ),
    examples: report.divergences.slice(0, 20).map((d) =>
      bravaItem(
        brava,
        brava.items.find((i) => i.id === d.itemId)!,
        mapping,
      ),
    ),
  };
  return `Escreva a leitura final da "Resiliência", uma bateria de ${report.items} testes difíceis em português, para o público de um vídeo. O vencedor já foi decidido pelo aplicativo com regra objetiva e não deve ser contestado: veja outcome. Se o intervalo de 95% de uma diferença inclui zero (withinMargin), diga que a diferença está dentro da margem de erro. Dê uma manchete curta e verdadeira (headline, até 140 caracteres), um resumo de até 160 palavras e evidências com os itemId reais no campo roundId. Diga em que cada participante foi forte ou fraco, por bateria, citando mudanças de decisão na robustez (diga o tipo de alteração com as palavras dos dados e se a mudança foi rumo ao gabarito ou para longe dele), adivinhações onde deveria se abster e calibração quando forem relevantes. Não use marcas, custo nem velocidade. Não invente raciocínios. ${sensitiveNote} Inclua limites do teste. ${participantReferences(mapping)} Dados:\n${JSON.stringify(data)}`;
}
