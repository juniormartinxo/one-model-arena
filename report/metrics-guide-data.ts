import type { ConclusionData, Evidence } from './data';

// Reconstruct the lesson from the saved report; never rewrite its evidence or scores.
function withBrier(question: Evidence) {
  const options = question.results.flatMap((result) => result.probabilities);
  const expectedValue =
    question.type === 'score'
      ? question.expected.split(' · ')[0]
      : options.find((option) => option.label === question.expected)?.value;
  if (expectedValue === undefined || !options.some((option) => option.value === expectedValue)) {
    throw new Error(`Gabarito ausente nas alternativas do relatório: ${question.id}`);
  }
  return {
    ...question,
    expectedValue,
    results: question.results.map((result) => ({
      ...result,
      brier:
        result.status === 'unavailable' || !result.probabilities.length
          ? null
          : result.probabilities.reduce(
              (sum, option) =>
                sum + (option.probability - Number(option.value === expectedValue)) ** 2,
              0,
            ),
    })),
  };
}

export function guideMeetingEvidence(data: ConclusionData) {
  return data.series.meetings.map((meeting) => ({
    ...meeting,
    rounds: meeting.rounds.map(withBrier),
  }));
}
