import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { edition as reportEdition } from '../report/edition';
import { publicationSchema } from '../shared/publication';

const publication = publicationSchema.parse(
  JSON.parse(readFileSync('site/content/edition.json', 'utf8')),
);
const report = readFileSync('reports/relatorio-conclusao.html', 'utf8');

describe('public conclusion', () => {
  it('publishes the same runs the conclusion report was written for', () => {
    expect(publication.status).toBe('published');
    if (publication.status !== 'published') return;
    const sources = Object.fromEntries(
      publication.edition.results.map((r) => [r.kind, r.sourceId]),
    );
    expect(sources).toEqual({
      maratona: reportEdition.series,
      brava: reportEdition.brava,
      imagens: reportEdition.visual,
    });
  });

  it('pairs the edition with the rules embedded in the report', () => {
    if (publication.status !== 'published') throw new Error('Edição não publicada');
    expect(report).toContain(`"rulesHash":"${publication.edition.rulesHash}"`);
    for (const id of Object.values(reportEdition).slice(2)) expect(report).toContain(id);
  });
});
