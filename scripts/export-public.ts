import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import type { Brava, Run, Series } from '../shared/types';
import { createPublication } from './public-edition';

const { values } = parseArgs({
  options: {
    db: { type: 'string', default: 'data/meetings.sqlite' },
    edition: { type: 'string' },
    title: { type: 'string' },
    series: { type: 'string' },
    brava: { type: 'string' },
    visual: { type: 'string' },
    out: { type: 'string', default: 'site/content/edition.json' },
    replace: { type: 'boolean', default: false },
    help: { type: 'boolean' },
  },
});
if (values.help) {
  console.log(
    'npm run public:export -- --edition primeira-edicao --title "Primeira edição" --series UUID --brava UUID --visual UUID\nSelecione pelo menos uma execução real concluída. --db escolhe o banco; --out escolhe o destino.\n--replace substitui uma edição já preparada. Nenhuma chamada de IA é feita.',
  );
  process.exit(0);
}
if (!values.edition || !values.title || !(values.series || values.brava || values.visual))
  throw new Error(
    'Informe --edition, --title e pelo menos um de --series, --brava ou --visual. Use --help.',
  );
const output = resolve(values.out);
if (
  existsSync(output) &&
  !values.replace &&
  JSON.parse(readFileSync(output, 'utf8')).status !== 'pending'
)
  throw new Error(
    'Já existe uma edição nesse destino. Escolha --out ou use --replace explicitamente.',
  );
const db = new DatabaseSync(resolve(values.db), { readOnly: true });
try {
  function get<T>(table: 'series' | 'runs' | 'bravas', id: string): T {
    const found = db.prepare(`SELECT snapshot FROM ${table} WHERE id=?`).get(id);
    if (!found) throw new Error(`Registro não encontrado em ${table}: ${id}`);
    return JSON.parse(String(found.snapshot));
  }
  const series = values.series ? get<Series>('series', values.series) : undefined;
  const bravas: Brava[] = [];
  for (const [id, kind] of [
    [values.brava, 'brava'],
    [values.visual, 'visual'],
  ] as const) {
    if (!id) continue;
    const brava = get<Brava>('bravas', id);
    if ((brava.kind ?? 'brava') !== kind)
      throw new Error(`O registro ${id} não é do tipo ${kind}.`);
    bravas.push(brava);
  }
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const dirty = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim();
  const rulesHash = createHash('sha256');
  for (const file of ['shared/scoring.ts', 'shared/report.ts', 'shared/brava-report.ts'])
    rulesHash.update(file).update(readFileSync(file));
  const publication = createPublication({
    id: values.edition,
    title: values.title,
    preparedAt: new Date().toISOString(),
    codeRevision: `${revision}${dirty ? '-dirty' : ''}`,
    rulesHash: rulesHash.digest('hex'),
    series: series
      ? { series, meetings: series.runIds.map((id) => get<Run>('runs', id)) }
      : undefined,
    bravas,
  });
  mkdirSync(dirname(output), { recursive: true });
  const temp = `${output}.tmp`;
  writeFileSync(temp, `${JSON.stringify(publication, null, 2)}\n`);
  renameSync(temp, output);
  console.log(
    `Edição preparada em ${output}. Confira-a com npm run dev:public. Nenhum deploy foi realizado.`,
  );
} finally {
  db.close();
}
