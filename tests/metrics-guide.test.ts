import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ConclusionData } from '../report/data';
import { guideMeetingEvidence } from '../report/metrics-guide-data';

const html = readFileSync('reports/relatorio-conclusao.html', 'utf8');
const data: ConclusionData = JSON.parse(html.match(/id="report-data">(.*?)<\/script>/s)![1]);

describe('contas explicadas de Brier e ECE', () => {
  it('reconstrói os três Brier publicados sem alterar as evidências salvas', () => {
    const before = JSON.stringify(data);
    const questions = guideMeetingEvidence(data).flatMap((meeting) => meeting.rounds);
    expect(questions).toHaveLength(36);
    for (const standing of data.series.report.standings) {
      const scores = questions.map(
        (question) =>
          question.results.find((result) => result.provider === standing.provider)!.brier!,
      );
      expect(scores.every(Number.isFinite)).toBe(true);
      expect(scores.reduce((sum, score) => sum + score, 0) / scores.length).toBeCloseTo(
        standing.brier!,
        12,
      );
    }
    expect(JSON.stringify(data)).toBe(before);
  });

  it('mostra os valores da bateria atual nos exemplos de erro e revisão humana', () => {
    const questions = guideMeetingEvidence(data).flatMap((meeting) => meeting.rounds);
    const wrong = questions
      .find((question) => question.id === 'f1')!
      .results.find((result) => result.provider === 'decisions')!;
    const review = questions
      .find((question) => question.id === 'p6')!
      .results.find((result) => result.provider === 'jev')!;
    expect(wrong.brier).toBeCloseTo(1.805, 12);
    expect(review.value).toBe(0.76);
    expect(review.status).toBe('uncertain');
    expect(review.brier).toBeCloseTo(0.1152, 12);
  });

  it('reconstitui cada ECE publicado somando as contribuições ponderadas das faixas', () => {
    for (const round of [data.brava, data.visual]) {
      for (const standing of round.report.standings) {
        const total = standing.calibration.reduce((sum, bin) => sum + bin.count, 0);
        expect(total).toBe(standing.total);
        const ece = standing.calibration.reduce(
          (sum, bin) => sum + (bin.count / total) * Math.abs(bin.accuracy - bin.confidence),
          0,
        );
        expect(ece).toBeCloseTo(standing.ece!, 12);
      }
    }
  });
});
