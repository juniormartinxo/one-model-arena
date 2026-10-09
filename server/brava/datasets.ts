import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { BravaItem, Question } from '../../shared/types';

// Public Portuguese datasets with human labels. Their text is downloaded by `npm run datasets`
// into data/ and never committed; only the sampled ids live in the repository.
export type DatasetItem = {
  dataset: 'assin2' | 'hatebr' | 'b2w';
  id: string;
  text: string;
  label: boolean;
};
export type SampleIds = { seed: string; assin2: string[]; hatebr: string[]; b2w: string[] };
export const idsPath = resolve(import.meta.dirname, 'portugues-ids.json');
export const datasetsPath = (dataDir: string) => join(dataDir, 'datasets', 'portugues.json');

export const datasetInfo = {
  assin2: {
    name: 'ASSIN 2',
    license: 'licença não declarada pela fonte',
    url: 'https://huggingface.co/datasets/nilc-nlp/assin2',
    citation:
      'Real, Fonseca e Oliveira (2020). The ASSIN 2 shared task: a quick overview. PROPOR 2020.',
    context:
      'Pares de frases em português, anotados por pessoas. Considere que a frase 1 é verdadeira. Responda se a frase 2 decorre dela, isto é, se a frase 2 também precisa ser verdadeira.',
    question: 'A frase 2 decorre da frase 1?',
    title: 'Implicação (ASSIN 2)',
  },
  hatebr: {
    name: 'HateBR',
    license: 'CC BY-NC 4.0, uso de pesquisa',
    url: 'https://github.com/franciellevargas/HateBR',
    citation:
      'Vargas et al. (2022). HateBR: A Large Expert Annotated Corpus of Brazilian Instagram Comments for Offensive Language and Hate Speech Detection. LREC 2022.',
    context:
      'Comentário real de uma rede social, anotado por especialistas. Considere ofensivo o comentário que contém insulto, xingamento, ataque ou linguagem que desqualifica pessoas ou grupos.',
    question: 'O comentário é ofensivo?',
    title: 'Linguagem ofensiva (HateBR)',
  },
  b2w: {
    name: 'B2W-Reviews01',
    license: 'CC BY-NC-SA 4.0, crédito à B2W Digital',
    url: 'https://github.com/americanas-tech/b2w-reviews01',
    citation:
      'Real et al. (2019). B2W-Reviews01: an open product reviews corpus. STIL 2019. Dados de B2W Digital.',
    context:
      'Avaliação real de um cliente de loja online. A nota em estrelas foi omitida. Responda com base no texto.',
    question: 'O cliente recomendaria este produto a um amigo?',
    title: 'Recomendação (B2W)',
  },
} as const;

export function portugueseItems(dataDir: string): BravaItem[] | null {
  const path = datasetsPath(dataDir);
  if (!existsSync(path)) return null;
  const { items } = JSON.parse(readFileSync(path, 'utf8')) as { items: DatasetItem[] };
  return items.map((x) => {
    const info = datasetInfo[x.dataset];
    const id = `pt-${x.dataset}-${x.id}`;
    const question: Question = {
      id,
      type: 'predicate',
      text: info.question,
      expected: x.label,
      rationale: `Rótulo humano do ${info.name}.`,
      success: 'Decisão igual ao rótulo humano.',
      failure: 'Decisão diferente do rótulo humano.',
    };
    return {
      id,
      battery: 'portugues',
      title: `${info.title} #${x.id}`,
      context: info.context,
      facts: x.text,
      question,
      source: { dataset: info.name, id: x.id, license: info.license },
      ...(x.dataset === 'hatebr' ? { sensitive: true } : {}),
    };
  });
}
