// Downloads the public Portuguese datasets used by the rodada brava and keeps only the sampled
// items, in data/ (never committed). The repository stores only the sampled ids.
//   npm run datasets            rebuild the sample from the committed ids
//   npm run datasets -- --resample   draw a new sample (changes the catalog hash)
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { config } from '../server/config';
import { idsPath, datasetsPath, type DatasetItem, type SampleIds } from '../server/brava/datasets';

const PER_CLASS = 10;
const SEED = 'rodada-brava-1';

function random(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
  let a = (h << 13) | (h >>> 19);
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function sample<T>(items: T[], n: number, rand: () => number) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}
// RFC 4180 CSV: quoted fields may contain commas, quotes and line breaks.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field || row.length) rows.push([...row, field]);
  return rows;
}
const records = (text: string) => {
  const [header, ...rows] = parseCsv(text);
  return rows
    .filter((r) => r.length === header.length)
    .map((r, index) => ({
      index,
      ...Object.fromEntries(header.map((h, i) => [h, r[i]])),
    })) as (Record<string, string> & { index: number })[];
};
async function get(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Falha ao baixar ${url}: HTTP ${res.status}`);
  return res.text();
}

async function assin2() {
  const rows: {
    sentence_pair_id: number;
    premise: string;
    hypothesis: string;
    entailment_judgment: number;
  }[] = [];
  for (let offset = 0; ; offset += 100) {
    const page = JSON.parse(
      await get(
        `https://datasets-server.huggingface.co/rows?dataset=nilc-nlp/assin2&config=default&split=test&offset=${offset}&length=100`,
      ),
    );
    rows.push(...page.rows.map((r: { row: (typeof rows)[number] }) => r.row));
    if (rows.length >= page.num_rows_total) break;
  }
  return rows.map((r): DatasetItem => ({
    dataset: 'assin2',
    id: String(r.sentence_pair_id),
    text: `Frase 1: ${r.premise}\nFrase 2: ${r.hypothesis}`,
    label: r.entailment_judgment === 1,
  }));
}
async function hatebr() {
  return records(
    await get('https://raw.githubusercontent.com/franciellevargas/HateBR/main/dataset/HateBR.csv'),
  )
    .filter((r) => (r.comentario ?? '').trim().length >= 25 && ['0', '1'].includes(r.label_final))
    .map((r): DatasetItem => ({
      dataset: 'hatebr',
      id: r.id,
      text: `Comentário: ${r.comentario.trim()}`,
      label: r.label_final === '1',
    }));
}
async function b2w() {
  return records(
    await get(
      'https://raw.githubusercontent.com/americanas-tech/b2w-reviews01/main/B2W-Reviews01.csv',
    ),
  )
    .filter(
      (r) =>
        ['Yes', 'No'].includes(r.recommend_to_a_friend) &&
        (r.review_text ?? '').trim().length >= 60 &&
        r.review_text.trim().length <= 350,
    )
    .map((r): DatasetItem => ({
      dataset: 'b2w',
      id: String(r.index),
      text: `Título: ${(r.review_title ?? '').trim() || '(sem título)'}\nAvaliação: ${r.review_text.trim()}`,
      label: r.recommend_to_a_friend === 'Yes',
    }));
}

const resample = process.argv.includes('--resample') || !existsSync(idsPath);
const sources = { assin2, hatebr, b2w } as const;
const ids: SampleIds = resample
  ? { seed: SEED, assin2: [], hatebr: [], b2w: [] }
  : JSON.parse(readFileSync(idsPath, 'utf8'));
const chosen: DatasetItem[] = [];
for (const [name, load] of Object.entries(sources) as [
  keyof typeof sources,
  () => Promise<DatasetItem[]>,
][]) {
  process.stdout.write(`Baixando ${name}… `);
  const all = await load();
  let picked: DatasetItem[];
  if (resample) {
    const rand = random(`${SEED}:${name}`);
    picked = [true, false].flatMap((label) =>
      sample(
        all.filter((x) => x.label === label),
        PER_CLASS,
        rand,
      ),
    );
    ids[name] = picked.map((x) => x.id);
  } else {
    const byId = new Map(all.map((x) => [x.id, x]));
    picked = ids[name].map((id) => {
      const item = byId.get(id);
      if (!item)
        throw new Error(`O item ${name}#${id} não existe mais na fonte. Rode com --resample.`);
      return item;
    });
  }
  chosen.push(...picked);
  console.log(`${all.length} itens, ${picked.length} selecionados.`);
}
if (resample) writeFileSync(idsPath, `${JSON.stringify(ids, null, 2)}\n`);
const out = resolve(datasetsPath(config.DATA_DIR));
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({ downloadedAt: new Date().toISOString(), items: chosen }));
console.log(`Amostra gravada em ${join(config.DATA_DIR, 'datasets')} (fora do Git).`);
