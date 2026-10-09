import { describe, expect, it } from 'vitest';
import { revealParticipants, verdictSummary, resultPresentation } from '../shared/presentation';
import type { Run, Verdict } from '../shared/types';

describe('participant names after blind judging', () => {
  const mapping = { A: 'jev', B: 'decisions' } as const;
  it('reveals explicit references while preserving Portuguese articles and technical text', () => {
    expect(
      revealParticipants(
        'A decisão de [[A]] foi melhor. [[B]] respondeu 0,73. A API usa UTF-8.',
        mapping,
      ),
    ).toBe('A decisão de Jev foi melhor. Decisions respondeu 0,73. A API usa UTF-8.');
    expect(
      revealParticipants(
        'Participante A superou o participante B. A diferença foi pequena.',
        mapping,
      ),
    ).toBe('Participante Jev superou o participante Decisions. A diferença foi pequena.');
    expect(revealParticipants('A e [[B]] empataram.', mapping)).toBe('Jev e Decisions empataram.');
  });
  it('renders the existing recording without turning articles into model names', () => {
    const text =
      'B venceu por 6 a 5. A diferença apareceu em p6. B respondeu 1. A respondeu 0,73. A resposta de A foi incerteza, não erro. A vantagem de B é real.';
    expect(revealParticipants(text, mapping)).toBe(
      'Decisions venceu por 6 a 5. A diferença apareceu em p6. Decisions respondeu 1. Jev respondeu 0,73. A resposta de Jev foi incerteza, não erro. A vantagem de Decisions é real.',
    );
    expect(
      revealParticipants(
        'A e B acertaram. B e A empataram. Placar: A 6/6 e B 5/6. A se adaptou.',
        mapping,
      ),
    ).toBe(
      'Jev e Decisions acertaram. Decisions e Jev empataram. Placar: Jev 6/6 e Decisions 5/6. Jev se adaptou.',
    );
    expect(revealParticipants('A política admite o plano B e a opção A.', mapping)).toBe(
      'A política admite o plano B e a opção A.',
    );
  });
  it('reveals a third participant without touching unmapped letters', () => {
    const three = { A: 'jev', B: 'decisions', C: 'clef' } as const;
    expect(revealParticipants('C errou; A e B acertaram. C venceu a rodada.', three)).toBe(
      'Clef errou; Jev e Decisions acertaram. Clef venceu a rodada.',
    );
    expect(revealParticipants('Participante C superou o nível C.', three)).toBe(
      'Participante Clef superou o nível C.',
    );
    expect(revealParticipants('C venceu.', mapping)).toBe('C venceu.');
  });
  it('keeps answer options when the text already names participants with placeholders', () => {
    const images = { A: 'clef', B: 'decisions' } as const;
    // Opus output from the rodada das imagens 405f3260: (A) and (B) are the options' letters.
    expect(
      revealParticipants(
        'Distância real, livros: [[A]] acertou a mesa (B) e [[B]] escolheu a estante (A).',
        images,
      ),
    ).toBe('Distância real, livros: Clef acertou a mesa (B) e Decisions escolheu a estante (A).');
    expect(
      revealParticipants(
        'Os dois erraram: responderam o ônibus (B), mas o gabarito era a moto (A).',
        images,
        true,
      ),
    ).toBe('Os dois erraram: responderam o ônibus (B), mas o gabarito era a moto (A).');
    expect(revealParticipants('O participante B e [[A]] empataram.', images)).toBe(
      'O participante Decisions e Clef empataram.',
    );
  });
  it('uses each pass’s mapping rather than the winner or current round mapping', () => {
    const text = '[[B]] venceu. A vantagem de [[B]] foi pequena.';
    const verdict: Verdict = {
      winner: 'decisions',
      summary: text,
      passes: [
        { mapping, result: { winner: 'B', summary: text, evidence: [], limitations: [] } },
        {
          mapping: { A: 'decisions', B: 'jev' },
          result: { winner: 'A', summary: '[[A]] venceu.', evidence: [], limitations: [] },
        },
      ],
    };
    const original = JSON.stringify(verdict);
    expect(verdictSummary(verdict)).toBe('Decisions venceu. A vantagem de Decisions foi pequena.');
    expect(revealParticipants(verdict.passes[1].result.summary, verdict.passes[1].mapping)).toBe(
      'Decisions venceu.',
    );
    expect(JSON.stringify(verdict)).toBe(original);
    expect(
      verdictSummary({
        ...verdict,
        winner: 'inconclusive',
        summary: 'O julgamento mudou ao inverter A e B.',
      }),
    ).toBe('O julgamento mudou ao inverter A e B.');
  });
  it.each([
    ['live', 'jev', 'Jev venceu'],
    ['live', 'decisions', 'Decisions venceu'],
    ['live', 'clef', 'Clef venceu'],
    ['live', 'tie', 'Empate'],
    ['live', 'inconclusive', 'Resultado inconclusivo'],
    ['demo', 'jev', 'Ensaio concluído'],
  ] as const)('presents %s/%s honestly', (mode, winner, title) => {
    expect(resultPresentation({ mode, verdict: { winner } } as Run).title).toBe(title);
  });
});
