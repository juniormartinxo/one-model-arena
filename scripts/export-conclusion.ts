import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import type { Brava, Run, Series, Provider } from '../shared/types';
import { edition } from '../report/edition';
import { buildConclusionData } from '../report/data';
import { ConclusionDocument } from '../report/document';
import { arenaAnimationScript } from '../report/animation';

const { values } = parseArgs({
  options: {
    db: { type: 'string', default: 'data/meetings.sqlite' },
    out: { type: 'string', default: 'reports/relatorio-conclusao.html' },
  },
});
const db = new DatabaseSync(resolve(values.db!), { readOnly: true });
try {
  function get<T>(table: string, id: string): T {
    const row = db.prepare(`SELECT snapshot FROM ${table} WHERE id=?`).get(id);
    if (!row) throw new Error(`Execução selecionada não encontrada: ${id}`);
    return JSON.parse(String(row.snapshot));
  }
  const series = get<Series>('series', edition.series);
  const rules = createHash('sha256');
  for (const path of ['shared/scoring.ts', 'shared/report.ts', 'shared/brava-report.ts'])
    rules.update(path).update(readFileSync(path));
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const dirty = !!execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim();
  const data = buildConclusionData(
    series,
    series.runIds.map((id) => get<Run>('runs', id)),
    get<Brava>('bravas', edition.brava),
    get<Brava>('bravas', edition.visual),
    db
      .prepare('SELECT snapshot FROM bravas ORDER BY rowid')
      .all()
      .map((r) => JSON.parse(String(r.snapshot))),
    {
      preparedAt: new Date().toISOString(),
      revision: `${revision}${dirty ? '-dirty' : ''}`,
      rulesHash: rules.digest('hex'),
    },
  );
  const fonts = [
    ['Manrope Variable', 'manrope', 'manrope-latin-wght-normal.woff2'],
    ['DM Sans Variable', 'dm-sans', 'dm-sans-latin-wght-normal.woff2'],
  ]
    .map(
      ([family, folder, filename]) =>
        `@font-face{font-family:'${family}';font-weight:100 900;font-style:normal;font-display:swap;src:url(data:font/woff2;base64,${readFileSync(`node_modules/@fontsource-variable/${folder}/files/${filename}`).toString('base64')}) format('woff2')}`,
    )
    .join('\n');
  const css =
    fonts +
    readFileSync('report/style.css', 'utf8') +
    readFileSync('report/meeting-brief.css', 'utf8') +
    readFileSync('report/models.css', 'utf8') +
    readFileSync('report/home.css', 'utf8') +
    readFileSync('report/metrics-guide.css', 'utf8');
  const script =
    arenaAnimationScript() +
    '\n' +
    readFileSync('report/interactive.js', 'utf8') +
    '\n' +
    readFileSync('report/metrics-guide.js', 'utf8');
  const json = JSON.stringify(data).replaceAll('<', '\\u003c');
  const logos = Object.fromEntries(
    [
      ['jev', 'typesafe'],
      ['decisions', 'openai'],
      ['clef', 'cloudflare'],
    ].map(([provider, name]) => [
      provider,
      'data:image/svg+xml;base64,' + readFileSync(`report/assets/${name}.svg`).toString('base64'),
    ]),
  ) as Record<Provider, string>;
  const brand = {
    mark:
      'data:image/png;base64,' +
      readFileSync('public/brand/one-model-arena-96.png').toString('base64'),
    favicon: 'data:image/png;base64,' + readFileSync('public/favicon-32.png').toString('base64'),
  };
  const html =
    '<!doctype html>' +
    renderToStaticMarkup(
      createElement(ConclusionDocument, { data, css, script, json, logos, brand }),
    );
  const output = resolve(values.out!);
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(`${output}.tmp`, html);
  renameSync(`${output}.tmp`, output);
  console.log(
    `Relatório: ${output}\n3 execuções fixadas · ${Math.round(Buffer.byteLength(html) / 1024)} KiB · sem chamadas de IA e sem alterações no banco.`,
  );
} finally {
  db.close();
}
