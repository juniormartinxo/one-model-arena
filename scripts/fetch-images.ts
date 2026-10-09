// Downloads the CV-Bench photos used by the rodada 3 into data/ (never committed). The sampled
// questions are committed in server/visual/cvbench-sample.json; this script only fetches images.
//   npm run imagens                 download the photos of the committed sample
//   npm run imagens -- --resample   draw a new sample (changes the catalog hash)
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { config } from '../server/config';
import {
  imageExtensions,
  imageType,
  imagesDir,
  samplePath,
  type CvSample,
  type CvSampleItem,
  type CvTask,
} from '../server/visual/sample';
import { random, sample } from './sampling';

const PER_TASK = 20;
const SEED = 'rodada-3-imagens-1';
const TASKS: CvTask[] = ['Count', 'Relation', 'Depth', 'Distance'];
const ROWS =
  'https://datasets-server.huggingface.co/rows?dataset=nyu-visionx/CV-Bench&config=default&split=test';

type Row = {
  idx: number;
  task: CvTask;
  source: string;
  source_dataset: string;
  question: string;
  choices: string[];
  answer: string;
  image: { src: string };
};
// The dataset server rate-limits bursts: requests are spaced and a 429 waits before retrying.
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function get(url: string) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url);
    if (res.ok) return res;
    if (res.status !== 429 || attempt === 6)
      throw new Error(`Falha ao baixar ${url}: HTTP ${res.status}`);
    await wait(Number(res.headers.get('retry-after')) * 1000 || 5000 * attempt);
  }
}
const json = async (url: string) => (await get(url)).json();
const toItem = (r: Row): CvSampleItem => ({
  idx: r.idx,
  task: r.task,
  source: r.source,
  sourceDataset: r.source_dataset,
  question: r.question,
  choices: r.choices,
  answer: r.answer,
});

const resample = process.argv.includes('--resample') || !existsSync(samplePath);
let chosen: CvSampleItem[];
if (resample) {
  const rows: Row[] = [];
  for (let offset = 0; ; offset += 100) {
    const page = await json(`${ROWS}&offset=${offset}&length=100`);
    rows.push(...page.rows.map((r: { row: Row }) => r.row));
    process.stdout.write(`\rLendo perguntas do CV-Bench… ${rows.length}/${page.num_rows_total}`);
    if (rows.length >= page.num_rows_total) break;
  }
  console.log();
  chosen = TASKS.flatMap((task) =>
    sample(
      rows.filter((r) => r.task === task),
      PER_TASK,
      random(`${SEED}:${task}`),
    )
      .sort((a, b) => a.idx - b.idx)
      .map(toItem),
  );
  writeFileSync(
    samplePath,
    `${JSON.stringify({ seed: SEED, items: chosen } satisfies CvSample, null, 2)}\n`,
  );
  console.log(`Nova amostra com ${chosen.length} perguntas gravada em server/visual.`);
} else chosen = (JSON.parse(readFileSync(samplePath, 'utf8')) as CvSample).items;

const dir = imagesDir(config.DATA_DIR);
mkdirSync(dir, { recursive: true });
const present = new Set(readdirSync(dir).map((f) => f.replace(/\.\w+$/, '')));
let downloaded = 0;
for (const item of chosen) {
  const name = `cvbench-${item.idx}`;
  if (present.has(name)) continue;
  // Image links from the dataset server expire, so each one is requested right before download.
  const page = await json(`${ROWS}&offset=${item.idx}&length=1`);
  const row: Row = page.rows[0].row;
  if (row.idx !== item.idx || row.question !== item.question)
    throw new Error(`A pergunta ${item.idx} mudou na fonte. Rode com --resample.`);
  const bytes = Buffer.from(await (await get(row.image.src)).arrayBuffer());
  const type = imageType(bytes);
  if (!type) throw new Error(`Formato inesperado na imagem ${item.idx}.`);
  writeFileSync(join(dir, `${name}.${imageExtensions[type]}`), bytes);
  downloaded++;
  await wait(1000);
  process.stdout.write(`\rBaixando imagens… ${downloaded}`);
}
console.log(
  `\n${chosen.length} imagens em ${join(config.DATA_DIR, 'datasets', 'imagens')} (fora do Git); ${downloaded} baixadas agora.`,
);
