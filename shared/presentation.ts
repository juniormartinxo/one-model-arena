import type { Mapping, Participant, Provider, Run, Verdict } from './types';

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

export function verdictSummary(verdict: Verdict): string {
  const source = verdict.passes.find((pass) => pass.result.summary === verdict.summary);
  return revealParticipants(verdict.summary, source?.mapping);
}

export function resultPresentation(run: Run) {
  const winner = run.verdict?.winner ?? 'inconclusive';
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
      subtitle: 'O Opus não identificou vantagem decisiva nesta reunião.',
      Icon: 'tie',
    } as const;
  if (winner === 'inconclusive')
    return {
      kind: 'inconclusive',
      title: 'Resultado inconclusivo',
      subtitle: 'Não há evidência suficiente para declarar um vencedor.',
      Icon: 'inconclusive',
    } as const;
  return {
    kind: winner,
    title: `${providerNames[winner]} venceu`,
    subtitle: 'Vencedor desta reunião segundo o Opus 5.5.',
    Icon: 'winner',
  } as const;
}
