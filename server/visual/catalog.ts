import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { BravaBattery, BravaItem, Option, Question } from '../../shared/types';
import {
  cvbenchInfo,
  imagesDir,
  samplePath,
  type CvSample,
  type CvSampleItem,
  type CvTask,
} from './sample';
import { imagePolicy } from './images';

export { visualProviders } from '../../shared/types';
export { imageDataUrl } from './images';

type VisualBatteryId = Extract<
  BravaBattery['id'],
  'contagem' | 'relacao' | 'profundidade' | 'distancia'
>;
const batteryOf: Record<CvTask, VisualBatteryId> = {
  Count: 'contagem',
  Relation: 'relacao',
  Depth: 'profundidade',
  Distance: 'distancia',
};
export const visualBatteryInfo: Record<VisualBatteryId, Omit<BravaBattery, 'itemIds'>> = {
  contagem: {
    id: 'contagem',
    title: 'Contagem',
    description:
      'Quantos objetos de um tipo aparecem na foto. Quatro a seis alternativas: no chute, o acerto fica entre 17% e 25%.',
    unit: 'item',
  },
  relacao: {
    id: 'relacao',
    title: 'Posição relativa',
    description:
      'Se um objeto está à esquerda, à direita, acima ou abaixo de outro na foto. Duas alternativas: o chute acerta 50%.',
    unit: 'item',
  },
  profundidade: {
    id: 'profundidade',
    title: 'Profundidade',
    description:
      'Qual de dois objetos marcados por caixas coloridas está mais perto da câmera. Duas alternativas: o chute acerta 50%.',
    unit: 'item',
  },
  distancia: {
    id: 'distancia',
    title: 'Distância real',
    description:
      'Qual de dois objetos está mais perto de um terceiro no mundo real, não na foto. Duas alternativas: o chute acerta 50%.',
    unit: 'item',
  },
};
const order: CvTask[] = ['Count', 'Relation', 'Depth', 'Distance'];

// Nouns of the sampled questions. Gender and number drive the articles: o, a, os, as.
type Noun = { pt: string; f?: true; p?: true };
const nouns: Record<string, Noun> = {
  backpack: { pt: 'mochila', f: true },
  bag: { pt: 'bolsa', f: true },
  barrier: { pt: 'barreira', f: true },
  bed: { pt: 'cama', f: true },
  bench: { pt: 'banco' },
  bin: { pt: 'lixeira', f: true },
  bird: { pt: 'pássaro' },
  blinds: { pt: 'persianas', f: true, p: true },
  boat: { pt: 'barco' },
  book: { pt: 'livro' },
  bookcase: { pt: 'estante', f: true },
  books: { pt: 'livros', p: true },
  bottle: { pt: 'garrafa', f: true },
  // “Caixa” alone would clash with the colored boxes that mark the objects.
  box: { pt: 'caixa de papelão', f: true },
  buildings: { pt: 'prédios', p: true },
  bus: { pt: 'ônibus' },
  car: { pt: 'carro' },
  cat: { pt: 'gato' },
  'cell phone': { pt: 'celular' },
  chair: { pt: 'cadeira', f: true },
  clock: { pt: 'relógio' },
  cup: { pt: 'xícara', f: true },
  curtain: { pt: 'cortina', f: true },
  desk: { pt: 'escrivaninha', f: true },
  'dining table': { pt: 'mesa de jantar', f: true },
  door: { pt: 'porta', f: true },
  drawers: { pt: 'gavetas', f: true, p: true },
  dresser: { pt: 'cômoda', f: true },
  'fire hydrant': { pt: 'hidrante' },
  fork: { pt: 'garfo' },
  handbag: { pt: 'bolsa de mão', f: true },
  keyboard: { pt: 'teclado' },
  lamp: { pt: 'luminária', f: true },
  mirror: { pt: 'espelho' },
  monitor: { pt: 'monitor' },
  motorcycle: { pt: 'moto', f: true },
  mouse: { pt: 'mouse' },
  'music system': { pt: 'aparelho de som' },
  'night stand': { pt: 'criado-mudo' },
  'night table': { pt: 'mesa de cabeceira', f: true },
  pedestrian: { pt: 'pedestre' },
  person: { pt: 'pessoa', f: true },
  pillow: { pt: 'travesseiro' },
  pizza: { pt: 'pizza', f: true },
  printer: { pt: 'impressora', f: true },
  remote: { pt: 'controle remoto' },
  shelves: { pt: 'prateleiras', f: true, p: true },
  sink: { pt: 'pia', f: true },
  sofa: { pt: 'sofá' },
  speaker: { pt: 'alto-falante' },
  'sports ball': { pt: 'bola', f: true },
  'stop sign': { pt: 'placa de pare', f: true },
  table: { pt: 'mesa', f: true },
  'table lamp': { pt: 'abajur' },
  television: { pt: 'televisão', f: true },
  'tennis racket': { pt: 'raquete de tênis', f: true },
  tissues: { pt: 'lenços de papel', p: true },
  'traffic cone': { pt: 'cone de trânsito' },
  'traffic light': { pt: 'semáforo' },
  trailer: { pt: 'reboque' },
  train: { pt: 'trem' },
  tray: { pt: 'bandeja', f: true },
  tree: { pt: 'árvore', f: true },
  trees: { pt: 'árvores', f: true, p: true },
  truck: { pt: 'caminhão' },
  wall: { pt: 'parede', f: true },
  wheelbarrow: { pt: 'carrinho de mão' },
};
// Counted classes, as the dataset pluralizes them (“skys” included).
const counted: Record<string, Noun> = {
  bears: { pt: 'ursos', p: true },
  birds: { pt: 'pássaros', p: true },
  blinds: { pt: 'persianas', f: true, p: true },
  boats: { pt: 'barcos', p: true },
  clocks: { pt: 'relógios', p: true },
  elephants: { pt: 'elefantes', p: true },
  horses: { pt: 'cavalos', p: true },
  motorcycles: { pt: 'motos', f: true, p: true },
  'night tables': { pt: 'mesas de cabeceira', f: true, p: true },
  persons: { pt: 'pessoas', f: true, p: true },
  pictures: { pt: 'quadros', p: true },
  plants: { pt: 'plantas', f: true, p: true },
  skys: { pt: 'céus', p: true },
  trains: { pt: 'trens', p: true },
  vans: { pt: 'vans', f: true, p: true },
  windows: { pt: 'janelas', f: true, p: true },
};

function noun(name: string, table = nouns) {
  const n = table[name];
  if (!n) throw new Error(`Sem tradução para “${name}” no CV-Bench.`);
  return n;
}
// Article contracted with a preposition: “o” → “do” / “ao”.
const the = (n: Noun) => `${n.f ? 'a' : 'o'}${n.p ? 's' : ''}`;
const ofThe = (n: Noun) => `d${the(n)}`;
const toThe = (n: Noun) => (n.f ? (n.p ? 'às' : 'à') : `a${the(n)}`);
const is = (n: Noun) => (n.p ? 'estão' : 'está');
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const marked = { red: 'caixa vermelha', blue: 'caixa azul', green: 'caixa verde' };
const directions: Record<string, string> = {
  left: 'à esquerda',
  right: 'à direita',
  above: 'acima',
  below: 'abaixo',
};
const letters = 'ABCDEF';

function match(item: CvSampleItem, pattern: RegExp) {
  const m = item.question.match(pattern);
  if (!m) throw new Error(`Pergunta ${item.idx} do CV-Bench fora do modelo esperado.`);
  return m;
}
// Questions follow four fixed English templates; each becomes a Portuguese question whose
// options keep the dataset's letters, so the reference answer is the dataset's own.
export function translate(item: CvSampleItem): Pick<Question, 'text' | 'options'> {
  const opts = (labels: string[], description: (label: string, i: number) => string): Option[] =>
    labels.map((label, i) => ({ value: letters[i], label, description: description(label, i) }));
  if (item.task === 'Count') {
    const [, cls] = match(item, /^How many (.+) are in the image\?$/);
    const n = noun(cls, counted);
    return {
      text: `Quant${n.f ? 'as' : 'os'} ${n.pt} há na imagem?`,
      options: opts(item.choices, (c) => `Total na imagem: ${c}.`),
    };
  }
  if (item.task === 'Relation') {
    const [, a, boxed, b] = match(
      item,
      /^Considering the relative positions of the (.+?)( \(annotated by the red box\))? and the (.+) in the image provided, where is the .+ located with respect to the .+\?$/,
    );
    const x = noun(a);
    const y = noun(b);
    const subject = `${the(x)} ${x.pt}${boxed ? ` (${marked.red})` : ''}`;
    return {
      text: `Na imagem, onde ${is(x)} ${subject} em relação ${toThe(y)} ${y.pt}?`,
      options: opts(
        item.choices.map((c) => directions[c] ?? c),
        (d) => `${cap(subject)} ${is(x)} ${d} ${ofThe(y)} ${y.pt}.`,
      ),
    };
  }
  if (item.task === 'Depth') {
    const [, a, b] = match(
      item,
      /^Which object is closer to the camera taking this photo, the (.+) \(highlighted by a red box\) or the (.+) \(highlighted by a blue box\)\?$/,
    );
    const pair = [
      [noun(a), marked.red],
      [noun(b), marked.blue],
    ] as const;
    const label = ([n, box]: (typeof pair)[number]) => `${the(n)} ${n.pt} (${box})`;
    return {
      text: `Qual objeto está mais perto da câmera que tirou a foto: ${label(pair[0])} ou ${label(pair[1])}?`,
      options: opts(
        pair.map((p) => cap(label(p))),
        (l, i) => `${l} ${is(pair[i][0])} mais perto da câmera.`,
      ),
    };
  }
  const [, r, a, b] = match(
    item,
    /^Estimate the real-world distances between objects in this image\. Which object is closer to the (.+) \(highlighted by a red box\), the (.+) \(highlighted by a blue box\) or the (.+) \(highlighted by a green box\)\?$/,
  );
  const ref = noun(r);
  const pair = [
    [noun(a), marked.blue],
    [noun(b), marked.green],
  ] as const;
  const label = ([n, box]: (typeof pair)[number]) => `${the(n)} ${n.pt} (${box})`;
  const target = `${ofThe(ref)} ${ref.pt} (${marked.red})`;
  return {
    text: `Considerando as distâncias no mundo real, qual objeto está mais perto ${target}: ${label(pair[0])} ou ${label(pair[1])}?`,
    options: opts(
      pair.map((p) => cap(label(p))),
      (l, i) => `${l} ${is(pair[i][0])} mais perto ${target}.`,
    ),
  };
}

const context =
  'Foto real, anexada a esta mensagem. Caixas coloridas desenhadas sobre a foto identificam os objetos citados pela cor. Responda olhando a imagem.';

export function visualItems(sample: CvSample = readSample()): BravaItem[] {
  return order.flatMap((task) =>
    sample.items
      .filter((x) => x.task === task)
      .map((x): BravaItem => {
        const battery = batteryOf[task];
        const id = `img-${battery}-${x.idx}`;
        const expected = letters[x.answer.charCodeAt(1) - 65];
        return {
          id,
          battery,
          title: `Foto #${x.idx}`,
          context,
          facts: `Foto de ${x.source}.`,
          question: {
            id,
            type: 'choice',
            ...translate(x),
            expected,
            rationale: `Gabarito do ${cvbenchInfo.name}.`,
            success: 'Alternativa igual ao gabarito do dataset.',
            failure: 'Alternativa diferente do gabarito do dataset.',
          },
          source: { dataset: cvbenchInfo.name, id: String(x.idx), license: cvbenchInfo.license },
          image: { file: `cvbench-${x.idx}` },
        };
      }),
  );
}
const readSample = (): CvSample => JSON.parse(readFileSync(samplePath, 'utf8'));

// The photos live in data/, with the extension found when they were downloaded.
export function imageFiles(dataDir: string) {
  const dir = imagesDir(dataDir);
  if (!existsSync(dir)) return new Map<string, string>();
  return new Map(readdirSync(dir).map((f) => [f.replace(/\.\w+$/, ''), join(dir, f)]));
}

export function buildVisualCatalog(dataDir: string) {
  const items = visualItems();
  const files = imageFiles(dataDir);
  const batteries: BravaBattery[] = order.map((task) => {
    const id = batteryOf[task];
    return {
      ...visualBatteryInfo[id],
      itemIds: items.filter((i) => i.battery === id).map((i) => i.id),
    };
  });
  const missing = items.filter((i) => !files.has(i.image!.file)).length;
  const hash = createHash('sha256').update(JSON.stringify({ items, imagePolicy })).digest('hex');
  return { items, batteries, missing, hash };
}
