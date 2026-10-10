import { describe, it, expect, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { scenarios } from '../server/scenarios';
import { requestFor, normalize, evaluate } from '../server/providers';
import { gradeAnswer, metrics } from '../shared/scoring';
import { config } from '../server/config';
import { providers } from '../shared/types';
const scenario = scenarios[0];
describe('native API contracts', () => {
  it('sends identical evidence and instructions, without the answer key', () => {
    for (const scenario of scenarios)
      for (const round of scenario.rounds) {
        const j = requestFor('jev', scenario, round) as any,
          d = requestFor('decisions', scenario, round) as any,
          c = requestFor('clef', scenario, round) as any;
        expect(j.state).toBe(d.input);
        expect(c.model).toBe(config.CLEF_MODEL);
        expect({ ...c, model: j.model }).toEqual(j);
        expect(j.questions[round.question.id].instructions).toBe(d.questions[0].instructions);
        for (const body of [j, d]) {
          expect(JSON.stringify(body)).not.toContain('expected');
          expect(JSON.stringify(body)).not.toContain(round.question.rationale);
        }
        if (round.question.type === 'score')
          expect(j.questions[round.question.id].criteria).toEqual(
            d.questions[0].levels.map((l: any) => `${l.label}: ${l.description}`),
          );
        if (round.question.type === 'choice')
          expect(j.questions[round.question.id].criteria).toEqual(
            Object.fromEntries(d.questions[0].choices.map((c: any) => [c.value, c.description])),
          );
      }
  });
  it('normalizes equivalent choice distributions', () => {
    const r = scenario.rounds[0];
    const jev = {
      model: 'jev-1.13.0',
      usage: { input_tokens: 100 },
      answers: {
        [r.question.id]: {
          type: 'choice',
          choice: 'financeiro',
          confidence: 0.8,
          probabilities: { financeiro: 0.9, logistica: 0.05, tecnica: 0.05 },
        },
      },
    };
    const decisions = {
      model: 'gpt-6-luna',
      usage: { input_tokens: 100 },
      answers: [
        {
          name: r.question.id,
          type: 'choice',
          choice: 'financeiro',
          confidence: 0.8,
          probabilities: [
            { value: 'financeiro', probability: 0.9 },
            { value: 'logistica', probability: 0.05 },
            { value: 'tecnica', probability: 0.05 },
          ],
        },
      ],
    };
    expect(normalize('jev', jev, r).answer).toEqual(normalize('decisions', decisions, r).answer);
  });
  it('normalizes noul, predicate, score and refusal', () => {
    const p = scenario.rounds[1],
      s = scenario.rounds[2];
    const j = normalize(
      'jev',
      {
        model: 'jev',
        usage: { input_tokens: 20 },
        answers: { [p.question.id]: { type: 'noul', noul: 0.1 } },
      },
      p,
    );
    const d = normalize(
      'decisions',
      {
        model: 'luna',
        usage: { input_tokens: 20 },
        answers: [{ name: p.question.id, type: 'predicate', probability: 0.1 }],
      },
      p,
    );
    expect(j.answer).toEqual(d.answer);
    expect(gradeAnswer(p.question, j.answer).status).toBe('correct');
    const score = normalize(
      'jev',
      {
        model: 'jev',
        usage: { input_tokens: 20 },
        answers: {
          [s.question.id]: {
            type: 'score',
            score: 1.9,
            confidence: 0.8,
            probabilities: { '0': 0, '1': 0.1, '2': 0.9 },
          },
        },
      },
      s,
    );
    expect(score.answer.value).toBe(1.9);
    expect(gradeAnswer(s.question, score.answer).status).toBe('correct');
    const refusal = normalize(
      'decisions',
      {
        model: 'luna',
        usage: { input_tokens: 20 },
        answers: [{ name: p.question.id, type: 'refusal' }],
      },
      p,
    );
    expect(gradeAnswer(p.question, refusal.answer).status).toBe('unavailable');
  });
  it('unwraps the Workers AI envelope and reads Clef with the Jev contract', () => {
    const p = scenario.rounds[1],
      r = scenario.rounds[0];
    const body = {
      model: 'clef',
      usage: { input_tokens: 232, output_tokens: 0 },
      answers: {
        [r.question.id]: {
          type: 'choice',
          choice: 'financeiro',
          confidence: 0.93,
          probabilities: { financeiro: 0.9779, logistica: 0.0095, tecnica: 0.0126 },
        },
        [p.question.id]: { type: 'noul', noul: 0.0096 },
      },
    };
    const wrapped = { result: body, success: true, errors: [], messages: [] };
    expect(normalize('clef', wrapped, r)).toEqual(normalize('jev', body, r));
    expect(normalize('clef', wrapped, p).answer.value).toBe(0.0096);
    expect(normalize('clef', wrapped, r).inputTokens).toBe(232);
    expect(() =>
      normalize('clef', { success: false, errors: [{ code: 1, message: 'Sem cota' }] }, r),
    ).toThrow('Sem cota');
    expect(() => normalize('clef', body, r)).toThrow();
  });
  it('calls the configured Cloudflare account and reports its error without retrying', async () => {
    Object.assign(config, { CLOUDFLARE_ACCOUNT_ID: 'f'.repeat(32), CLOUDFLARE_API_TOKEN: 't' });
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          result: null,
          errors: [{ code: 4006, message: 'daily free allocation of 10,000 neurons used' }],
        }),
        { status: 429 },
      ),
    );
    const result = await evaluate(
      'clef',
      scenario,
      scenario.rounds[0],
      new AbortController().signal,
      fetcher,
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toBe(
      `https://api.cloudflare.com/client/v4/accounts/${'f'.repeat(32)}/ai/run/@cf/cloudflare/clef`,
    );
    expect(fetcher.mock.calls[0][1].headers.Authorization).toBe('Bearer t');
    expect(result.error).toContain('429');
    expect(result.error).toContain('10,000 neurons');
    expect(result.costUsd).toBeNull();
    expect(result.grade.status).toBe('unavailable');
  });
  it('keeps Clef usage when a wrapped answer fails validation', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          result: { model: 'clef', usage: { input_tokens: 100, output_tokens: 0 }, answers: {} },
          success: true,
          errors: [],
        }),
      ),
    );
    const result = await evaluate(
      'clef',
      scenario,
      scenario.rounds[0],
      new AbortController().signal,
      fetcher,
    );
    expect(result.error).toBe('Resposta incompatível com o contrato da API.');
    expect(result.costUsd).toBeCloseTo(0.000024);
  });
  it('distinguishes Clef capacity errors from quota exhaustion and preserves diagnostics', async () => {
    const raw = {
      success: false,
      errors: [{ code: 3040, message: 'Capacity temporarily exceeded, please try again.' }],
    };
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(raw), {
        status: 429,
        headers: { 'cf-ray': 'capacity-test', 'retry-after': '5' },
      }),
    );
    const result = await evaluate(
      'clef',
      scenario,
      scenario.rounds[0],
      new AbortController().signal,
      fetcher,
    );
    expect(result.error).toContain('Capacidade do provedor temporariamente esgotada');
    expect(result.raw).toEqual(raw);
    expect(result.http).toEqual({ status: 429, requestId: 'capacity-test', retryAfter: '5' });
    expect(result.inputTokens).toBeNull();
    expect(result.costUsd).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each([
    {
      body: JSON.stringify({
        error: { message: 'Upstream request timed out', code: 'gateway_timeout' },
      }),
      detail: 'Upstream request timed out',
    },
    { body: '<html><body>Gateway timeout</body></html>', detail: 'gateway timeout' },
  ])('preserves Decisions HTTP 504 evidence for $body', async ({ body, detail }) => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(body, {
        status: 504,
        headers: { 'x-request-id': 'timeout-test' },
      }),
    );
    const result = await evaluate(
      'decisions',
      scenario,
      scenario.rounds[0],
      new AbortController().signal,
      fetcher,
    );
    expect(result.error).toContain('HTTP 504. Tempo limite no serviço do provedor');
    expect(result.error).toContain(detail);
    expect(result.raw).toEqual(body.startsWith('{') ? JSON.parse(body) : body);
    expect(result.http).toEqual({ status: 504, requestId: 'timeout-test', retryAfter: null });
    expect(result.costUsd).toBeNull();
    expect(result.grade.status).toBe('unavailable');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('bounds oversized gateway error evidence and retains the HTTP status', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('x'.repeat(20_000), { status: 502 }));
    const result = await evaluate(
      'decisions',
      scenario,
      scenario.rounds[0],
      new AbortController().signal,
      fetcher,
    );
    expect(result.raw).toEqual({ text: 'x'.repeat(16_384), truncated: true });
    expect(result.error).toContain('HTTP 502');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('rejects missing or invalid distributions instead of silently counting a point', () => {
    const r = scenario.rounds[0];
    for (const probabilities of [
      { financeiro: 0.9 },
      { financeiro: 0.9, logistica: 0.5, tecnica: 0.1 },
      { financeiro: 1, logistica: 0, unexpected: 0 },
    ]) {
      expect(() =>
        normalize(
          'jev',
          {
            model: 'jev',
            usage: { input_tokens: 20 },
            answers: {
              [r.question.id]: {
                type: 'choice',
                choice: 'financeiro',
                confidence: 0.8,
                probabilities,
              },
            },
          },
          r,
        ),
      ).toThrow();
    }
  });
  it('does not retry HTTP failures or invent zero cost', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{}', { status: 429 }));
    const result = await evaluate(
      'jev',
      scenario,
      scenario.rounds[0],
      new AbortController().signal,
      fetcher,
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.error).toContain('429');
    expect(result.costUsd).toBeNull();
    expect(result.grade.status).toBe('unavailable');
  });
  it('preserves usage and raw evidence when answer validation fails', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ model: 'jev', usage: { input_tokens: 100 }, answers: {} })),
      );
    const result = await evaluate(
      'jev',
      scenario,
      scenario.rounds[0],
      new AbortController().signal,
      fetcher,
    );
    expect(result.raw).toBeDefined();
    expect(result.costUsd).toBeCloseTo(0.0000042);
    expect(result.grade.status).toBe('unavailable');
  });
});
describe('frozen scoring', () => {
  it('preserves the original three scenarios byte-for-byte as serialized in prior exports', () => {
    const original = {
      loja: '4cd92a464d22f7bebdf008f92c598f49210efefb24757c70174721db32a7795e',
      produto: '0ff853382d56add047ea8709ffb1792c9a51b020f25d86424da75746df0cda8f',
      fornecedor: '36ed205d061db11bce36753229df41a9d29f21a29ca1d225236ed70888460128',
    };
    for (const [id, hash] of Object.entries(original)) {
      const scenario = scenarios.find((s) => s.id === id);
      expect(createHash('sha256').update(JSON.stringify(scenario)).digest('hex')).toBe(hash);
    }
  });
  it('changes only option order in the dossier control while preserving evidence and the correct answer', () => {
    const s = scenarios.find((s) => s.id === 'dossie-estresse')!;
    const first = s.rounds[0],
      last = s.rounds[5];
    expect(last.facts).toBe(first.facts);
    expect(last.question.text).toBe(first.question.text);
    expect(last.question.expected).toBe(first.question.expected);
    expect(last.question.options).toEqual([...first.question.options!].reverse());
    for (const provider of providers) {
      const original = JSON.stringify(requestFor(provider, s, first));
      const reordered = JSON.stringify(requestFor(provider, s, last));
      expect(original).not.toContain(first.title);
      expect(reordered).not.toContain(last.title);
    }
  });
  it('distinguishes uncertainty from a wrong predicate', () => {
    const q = scenario.rounds[1].question;
    expect(gradeAnswer(q, { type: 'predicate', value: 0.5, probabilities: [] }).status).toBe(
      'uncertain',
    );
    expect(gradeAnswer(q, { type: 'predicate', value: 0.2, probabilities: [] }).status).toBe(
      'correct',
    );
    expect(gradeAnswer(q, { type: 'predicate', value: 0.8, probabilities: [] }).status).toBe(
      'incorrect',
    );
  });
  it('has unique scenarios, six unique rounds, and valid reference answers throughout the catalog', () => {
    expect(new Set(scenarios.map((s) => s.id)).size).toBe(scenarios.length);
    const questionIds = scenarios.flatMap((s) => s.rounds.map((r) => r.question.id));
    expect(new Set(questionIds).size).toBe(questionIds.length);
    for (const s of scenarios) {
      expect(s.rounds).toHaveLength(6);
      expect(new Set(s.rounds.map((r) => r.id)).size).toBe(6);
      for (const r of s.rounds) {
        if (r.question.type === 'choice') {
          expect(r.question.options?.some((o) => o.value === r.question.expected)).toBe(true);
          expect(new Set(r.question.options!.map((o) => o.value)).size).toBe(
            r.question.options!.length,
          );
        } else if (r.question.type === 'predicate') {
          expect(typeof r.question.expected).toBe('boolean');
        } else {
          expect(r.question.levels?.[Number(r.question.expected)]).toBeDefined();
        }
      }
    }
  });
});
