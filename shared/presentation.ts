import type {
  Answer,
  BravaKind,
  DecisionReason,
  Mapping,
  Participant,
  Provider,
  Question,
  Run,
  Standing,
  Verdict,
} from './types';

export const providerNames: Record<Provider, string> = {
  jev: 'Jev',
  decisions: 'Decisions',
  clef: 'Clef',
};
export const providerVendors: Record<Provider, string> = {
  jev: 'TypeSafe AI',
  decisions: 'OpenAI',
  clef: 'Cloudflare',
};

// How each kind of second-stage round is named on screen.
export const roundNames: Record<
  BravaKind,
  { title: string; name: string; rehearsal: string; plural: string }
> = {
  brava: {
    title: 'Resiliência',
    name: 'Resiliência',
    rehearsal: 'Ensaio da Resiliência',
    plural: 'Rodadas de Resiliência',
  },
  visual: {
    title: 'Rodada das imagens',
    name: 'rodada das imagens',
    rehearsal: 'Ensaio da rodada das imagens',
    plural: 'Rodadas das imagens',
  },
};
const number = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
// The decision a viewer reads: the option, Sim/Não by the 80/20 rule, or the weighted level.
export function answerLabel(question: Question, answer?: Answer): string | null {
  if (!answer) return null;
  if (answer.type === 'refusal') return 'Recusa do provedor';
  if (answer.type === 'choice')
    return question.options?.find((o) => o.value === answer.value)?.label ?? String(answer.value);
  if (answer.type === 'predicate') {
    const value = Number(answer.value);
    return value >= 0.8 ? 'Sim' : value <= 0.2 ? 'Não' : 'Revisão humana';
  }
  return `${number(Number(answer.value))} / ${question.levels!.length - 1}`;
}
export function expectedLabel(question: Question): string {
  if (question.type === 'choice')
    return question.options!.find((o) => o.value === question.expected)!.label;
  if (question.type === 'predicate') return question.expected ? 'Sim' : 'Não';
  return `${question.expected} · ${question.levels![Number(question.expected)].label}`;
}
// New evaluations use explicit placeholders so Portuguese articles such as
// “A diferença” are never mistaken for participant A. The conservative fallback
// also renders existing recordings, without rewriting their original evidence.
export function revealParticipants(text: string, mapping?: Mapping): string {
  if (!mapping) return text;
  const name = (id: string) => {
    const provider = mapping[id as Participant];
    return provider ? providerNames[provider] : id;
  };
  return text
    .replace(/\[\[([ABC])\]\]/g, (_, id: string) => name(id))
    .replace(
      /\b(participante|modelo|concorrente)\s+([ABC])\b/gi,
      (_, prefix: string, id: string) => `${prefix} ${name(id.toUpperCase())}`,
    )
    .replace(
      /\b([ABC])(?=\s+(?:e|ou|contra|versus)\s+(?:[ABC]|Jev|Decisions|Clef)\b)/g,
      (_, id: string) => name(id),
    )
    .replace(/\b[ABC]\b/g, (id: string, offset: number, sentence: string) => {
      if (!mapping[id as Participant]) return id;
      const before = sentence.slice(0, offset);
      const after = sentence.slice(offset + 1);
      // B and C are not Portuguese articles, but may be part of a named plan/option.
      if (/\b(?:plano|opção|alternativa|nível|letra)\s+$/i.test(before)) return id;
      if (id !== 'A') return name(id);
      if (/\b(?:de|do|para|por|com|entre|contra|que|enquanto|superou)\s+$/.test(before))
        return name(id);
      if (/(?:Jev|Decisions|Clef)\s+(?:e|ou|contra|versus)\s+$/.test(before)) return name(id);
      if (/^\s*(?:[(:,;/]|[0-9]|$)/.test(after)) return name(id);
      if (
        /^\s+(?:venceu|ganhou|perdeu|empatou|respondeu|responde|escolheu|escolhe|acertou|errou|recebeu|recebe|obteve|marcou|pontuou|pontua|fez|foi|ficou|fica|deu|disse|teve|tem|tinha|tomou|decidiu|decide|classificou|classifica|identificou|reconheceu|confirmou|recusou|rejeitou|negou|aprovou|indicou|atribuiu|retornou|apontou|interpretou|inferiu|tratou|preservou|manteve|mantém|encerrou|encaminhou|evitou|mudou|ajustou|acompanhou|aderiu|atendeu|considerou|demonstrou|mostrou|contribuiu|superou|falhou|permaneceu|priorizou|solicitou|pediu|sugeriu|com|também|ainda|já|não|se)\b/i.test(
          after,
        )
      )
        return name(id);
      return id;
    });
}

const joined = (items: string[]) =>
  items.length > 1 ? `${items.slice(0, -1).join(', ')} e ${items.at(-1)}` : (items[0] ?? '');
// Plain-language statement of an objective result, used when Opus is unavailable or in rehearsals.
export function decisionText(
  decision: { winner: Provider | 'tie' | 'inconclusive'; reason: DecisionReason },
  table: Standing[],
) {
  const best = Math.max(...table.map((s) => s.correct));
  const leaders = table.filter((s) => s.correct === best);
  const total = table[0]?.total ?? 0;
  const leaderNames = joined(leaders.map((s) => providerNames[s.provider]));
  if (decision.reason === 'unavailable')
    return 'Sem vencedor: houve respostas indisponíveis que poderiam mudar a liderança.';
  if (decision.reason === 'tie')
    return leaders.length === table.length
      ? `Empate: todos fizeram ${best} de ${total} pontos pelo gabarito, com calibração equivalente.`
      : `${leaderNames} empataram na liderança com ${best} de ${total} pontos, com calibração equivalente.`;
  const winner = providerNames[decision.winner as Provider];
  if (decision.reason === 'calibration')
    return `${leaderNames} empataram com ${best} de ${total} pontos; ${winner} venceu no desempate, com probabilidades mais próximas do gabarito.`;
  return `${winner} fez mais pontos pelo gabarito: ${best} de ${total}.`;
}
const reasonSubtitles: Record<DecisionReason, string> = {
  points: 'Mais pontos pelo gabarito.',
  calibration: 'Empate em pontos, desempate pela calibração.',
  tie: 'Mesmos pontos e calibração equivalente.',
  unavailable: 'Respostas ausentes poderiam mudar a liderança.',
};
export function verdictSummary(verdict: Verdict): string {
  const source = verdict.passes.find((pass) => pass.result.summary === verdict.summary);
  return revealParticipants(verdict.summary, source?.mapping);
}

export function resultPresentation(run: Run) {
  const winner = run.verdict?.winner ?? 'inconclusive';
  const objective = run.verdict?.basis === 'objective' && run.verdict.reason;
  const subtitle = (fallback: string) => (objective ? reasonSubtitles[objective] : fallback);
  if (run.mode === 'demo')
    return {
      kind: 'demo',
      title: 'Ensaio concluído',
      subtitle: 'Demonstração sintética · sem chamadas de IA',
      Icon: 'demo',
    } as const;
  if (winner === 'tie')
    return {
      kind: 'tie',
      title: 'Empate',
      subtitle: subtitle('O Opus não identificou vantagem decisiva nesta reunião.'),
      Icon: 'tie',
    } as const;
  if (winner === 'inconclusive')
    return {
      kind: 'inconclusive',
      title: 'Resultado inconclusivo',
      subtitle: subtitle('Não há evidência suficiente para declarar um vencedor.'),
      Icon: 'inconclusive',
    } as const;
  return {
    kind: winner,
    title: `${providerNames[winner]} venceu`,
    subtitle: subtitle('Vencedor desta reunião segundo o Opus 5.5.'),
    Icon: 'winner',
  } as const;
}
