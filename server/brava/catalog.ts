import { createHash } from 'node:crypto';
import type {
  Answer,
  BravaBattery,
  BravaBatteryId,
  BravaItem,
  Provider,
  ProviderResult,
  Round,
  Scenario,
} from '../../shared/types';
import { gradeAnswer } from '../../shared/scoring';
import { scenarios } from '../scenarios';
import { requestFor } from '../providers';
import { abstention, injection, negation, noiseText } from './authored';
import { portugueseItems } from './datasets';

type TextBatteryId = Exclude<BravaBatteryId, 'contagem' | 'relacao' | 'profundidade' | 'distancia'>;
export const batteryInfo: Record<TextBatteryId, Omit<BravaBattery, 'itemIds'>> = {
  robustez: {
    id: 'robustez',
    title: 'Robustez',
    description:
      'As 36 perguntas da rodada 1 com a forma alterada: alternativas em outra ordem, texto irrelevante, erros de digitação e uma evidência a mais a favor do gabarito. Um grupo só conta se todas as versões acertarem.',
    unit: 'grupo',
  },
  portugues: {
    id: 'portugues',
    title: 'Português real',
    description:
      'Textos reais com rótulo humano: implicação entre frases (ASSIN 2), linguagem ofensiva em comentários (HateBR) e recomendação em avaliações de compra (B2W).',
    unit: 'item',
  },
  abstencao: {
    id: 'abstencao',
    title: 'Saber dizer “não”',
    description:
      'Pedidos fora do escopo e perguntas sobre dados que não estão no texto. O certo é escolher “fora do escopo” ou “não informado” em vez de adivinhar.',
    unit: 'item',
  },
  negacao: {
    id: 'negacao',
    title: 'Negação',
    description:
      'Doze grupos com quatro versões do mesmo trecho: original, paráfrase, escopo alterado e negação desfeita. Um grupo só conta se as quatro acertarem.',
    unit: 'grupo',
  },
  injecao: {
    id: 'injecao',
    title: 'Injeção e pressão',
    description:
      'Instruções escondidas em recibos e e-mails, aprovações falsas e argumentos de autoridade, misturados a exceções legítimas que devem ser aceitas.',
    unit: 'item',
  },
};
export const batteryOrder: TextBatteryId[] = [
  'robustez',
  'portugues',
  'abstencao',
  'negacao',
  'injecao',
];

// Words whose change would alter the meaning, never touched by the typo perturbation.
const protectedWords = new Set([
  'nenhum',
  'nenhuma',
  'nunca',
  'exceto',
  'salvo',
  'apenas',
  'somente',
  'também',
  'ainda',
]);
// Deterministic typos: swapped letters in some long words and accents dropped in others.
export function typos(text: string) {
  let eligible = 0;
  return text.replace(/\p{L}+/gu, (word) => {
    if (word.length < 5 || word === word.toUpperCase() || protectedWords.has(word.toLowerCase()))
      return word;
    eligible++;
    if (eligible % 5 === 0) {
      const i = Math.floor(word.length / 2);
      return word.slice(0, i - 1) + word[i] + word[i - 1] + word.slice(i + 1);
    }
    if (eligible % 3 === 0) return word.normalize('NFD').replace(/\p{M}/gu, '');
    return word;
  });
}

function robustness(): BravaItem[] {
  return scenarios.flatMap((scenario) =>
    scenario.rounds.flatMap((round) => {
      const base = {
        battery: 'robustez' as const,
        context: scenario.context,
        group: round.id,
      };
      const make = (
        variant: NonNullable<BravaItem['variant']>,
        label: string,
        change: Partial<BravaItem> = {},
      ): BravaItem => {
        const id = `rob-${round.id}-${variant}`;
        return {
          ...base,
          id,
          title: `${round.title} · ${label}`,
          facts: round.facts,
          variant,
          question: { ...round.question, id },
          ...change,
        };
      };
      const q = round.question;
      return [
        make('original', 'original'),
        make('ruido', 'com texto irrelevante', { noise: true }),
        make('digitacao', 'com erros de digitação', { facts: typos(round.facts) }),
        q.type === 'choice'
          ? make('ordem', 'alternativas invertidas', {
              question: { ...q, id: `rob-${round.id}-ordem`, options: [...q.options!].reverse() },
            })
          : make('direcao', 'com evidência a favor', {
              facts: `${round.facts}\nInformação adicional confirmada: ${q.rationale}`,
            }),
      ];
    }),
  );
}

export function buildCatalog(dataDir: string) {
  const portuguese = portugueseItems(dataDir);
  const groups: Record<TextBatteryId, BravaItem[] | null> = {
    robustez: robustness(),
    portugues: portuguese,
    abstencao: abstention,
    negacao: negation,
    injecao: injection,
  };
  const items = batteryOrder.flatMap((id) => groups[id] ?? []);
  const batteries: BravaBattery[] = batteryOrder
    .filter((id) => groups[id])
    .map((id) => ({ ...batteryInfo[id], itemIds: groups[id]!.map((i) => i.id) }));
  const skipped = portuguese
    ? []
    : [
        {
          battery: 'portugues' as const,
          reason: 'Amostra dos datasets não encontrada. Rode npm run datasets.',
        },
      ];
  const hash = createHash('sha256').update(JSON.stringify(items)).digest('hex');
  return { items, batteries, skipped, hash };
}

// The adapters take a scenario and a round; an item maps onto both. Noise goes between the
// rules and the facts, where a real document would put unrelated notes.
export function asRequest(item: BravaItem): { scenario: Scenario; round: Round } {
  return {
    scenario: {
      id: item.battery,
      title: item.battery,
      description: '',
      context: item.context,
      rounds: [],
    },
    round: {
      id: item.id,
      title: item.title,
      facts: item.noise ? `${noiseText}\n\nFatos do caso:\n${item.facts}` : item.facts,
      question: item.question,
    },
  };
}

// Synthetic answers for the rehearsal: deterministic, with some misses, doubts and flips so the
// screen can be checked. They are not measurements of any model.
const rate: Record<Provider, number> = { jev: 0.14, decisions: 0.1, clef: 0.08 };
export function demoAnswer(provider: Provider, item: BravaItem): ProviderResult {
  const roll =
    parseInt(createHash('sha1').update(`${provider}:${item.id}`).digest('hex').slice(0, 8), 16) /
    0xffffffff;
  const q = item.question;
  const wrong = roll < rate[provider];
  const unsure = !wrong && q.type === 'predicate' && roll < rate[provider] + 0.05;
  const keys =
    q.type === 'predicate'
      ? ['true', 'false']
      : (q.options?.map((o) => o.value) ?? q.levels!.map((_, i) => String(i)));
  const expectedKey = String(q.expected);
  const chosen = wrong ? keys.find((k) => k !== expectedKey)! : expectedKey;
  let answer: Answer;
  if (q.type === 'predicate') {
    const yes = unsure ? 0.6 : chosen === 'true' ? 0.94 : 0.06;
    answer = {
      type: 'predicate',
      value: yes,
      probabilities: [
        { value: 'true', label: 'Sim', probability: yes },
        { value: 'false', label: 'Não', probability: 1 - yes },
      ],
    };
  } else {
    answer = {
      type: q.type,
      value: q.type === 'score' ? Number(chosen) : chosen,
      confidence: 0.8,
      probabilities: keys.map((k) => ({
        value: k,
        label: q.options?.find((o) => o.value === k)?.label ?? k,
        probability: k === chosen ? 0.9 : 0.1 / (keys.length - 1),
      })),
    };
  }
  const { scenario, round } = asRequest(item);
  return {
    provider,
    answer,
    grade: gradeAnswer(q, answer),
    durationMs: 0,
    model: 'fixture-sintetica',
    inputTokens: 0,
    costUsd: 0,
    request: requestFor(provider, scenario, round),
    raw: { synthetic: true },
  };
}
