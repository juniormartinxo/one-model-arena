import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import type { Run } from '../../shared/types';

async function completedDemo(request: APIRequestContext): Promise<Run> {
  const history = await (await request.get('/api/runs')).json();
  for (const item of history)
    if (!['complete', 'cancelled', 'failed'].includes(item.phase))
      await request.post(`/api/runs/${item.id}/cancel`);
  const created = await (
    await request.post('/api/runs', { data: { scenarioId: 'produto', mode: 'demo' } })
  ).json();
  for (let i = 0; i < 6; i++) {
    await expect
      .poll(async () => (await (await request.get(`/api/runs/${created.id}`)).json()).phase)
      .toBe('ready');
    await request.post(`/api/runs/${created.id}/advance`);
  }
  await expect
    .poll(async () => (await (await request.get(`/api/runs/${created.id}`)).json()).phase)
    .toBe('complete');
  return (await request.get(`/api/runs/${created.id}`)).json();
}

// A two-way recording, as saved before Clef joined the comparison.
async function resultFixture(request: APIRequestContext): Promise<Run> {
  const run = await completedDemo(request);
  // Browser-only fixtures; no live API invocation and no modification of saved evidence.
  run.mode = 'live';
  delete run.providers;
  for (const r of run.rounds) delete r.results.clef;
  for (const r of run.rounds) {
    const q = run.scenario.rounds.find((x) => x.id === r.roundId)!.question;
    for (const provider of ['jev', 'decisions'] as const) {
      const value = r.results[provider]!;
      value.model = provider === 'jev' ? 'jev-1.13.0' : 'gpt-6-luna';
      value.grade = { status: 'correct', effect: q.success };
      value.answer!.value = typeof q.expected === 'boolean' ? Number(q.expected) : q.expected;
    }
  }
  run.rounds[5].results.jev!.grade = { status: 'uncertain', effect: 'Revisão humana.' };
  run.rounds[5].results.jev!.answer!.value = 0.73;
  run.rounds[5].feedback = {
    winner: 'decisions',
    mapping: { A: 'decisions', B: 'jev' },
    text: '[[A]] venceu esta rodada. A resposta de [[B]] exige revisão.',
  };
  const summary =
    'B venceu por 6 a 5. Os dois participantes tiveram resposta utilizável em todas as rodadas e decidiram igual de p1 a p5. A diferença concreta apareceu em p6, quando chegou a nova evidência: o teste concluído no Windows, o ambiente afetado. B respondeu 1, que fica acima de 0,8, e encerrou a correção com evidência adequada. A respondeu 0,73, que cai na faixa de revisão humana (entre 20% e 80%) e não pontua. A resposta de A foi incerteza, não erro. Ainda assim, a política e os fatos de p6 deixam claro que a exigência foi cumprida: não restam passos pendentes. Por isso, a revisão humana atrasa o encerramento sem necessidade. A vantagem de B é real, mas pequena: vem de uma única rodada.';
  run.verdict = {
    winner: 'decisions',
    summary,
    passes: [
      {
        mapping: { A: 'jev', B: 'decisions' },
        result: {
          winner: 'B',
          summary,
          evidence: [
            {
              roundId: 'p6',
              participant: 'B',
              observation: '[[B]] considerou a evidência atual; [[A]] pediu revisão.',
            },
          ],
          limitations: ['A amostra é pequena.'],
        },
      },
      {
        mapping: { A: 'decisions', B: 'jev' },
        result: {
          winner: 'A',
          summary: '[[A]] venceu por 6 a 5. A diferença foi a revisão solicitada por [[B]].',
          evidence: [
            {
              roundId: 'p6',
              participant: 'A',
              observation: '[[A]] encerrou o caso; [[B]] pediu revisão.',
            },
          ],
          limitations: ['A amostra é pequena.'],
        },
      },
    ],
  };
  return run;
}

async function showSaved(page: Page, run: Run) {
  await page.route(`**/api/runs/${run.id}`, (route) => route.fulfill({ json: run }));
  await page.addInitScript((id) => sessionStorage.setItem('meeting', id), run.id);
  await page.goto('/');
  await page.getByRole('button', { name: 'Ver resultado', exact: true }).click();
}

test('names the real participants in both mappings, reveals automatically once, and supports keyboard and replay', async ({
  page,
  request,
}) => {
  const run = await resultFixture(request);
  let first = true;
  await page.route(`**/api/runs/${run.id}`, (route) => {
    const value = first ? { ...run, phase: 'judging' } : run;
    first = false;
    return route.fulfill({ json: value });
  });
  await page.route(`**/api/runs/${run.id}/events`, (route) =>
    route.fulfill({ contentType: 'text/event-stream', body: `data: ${JSON.stringify(run)}\n\n` }),
  );
  await page.addInitScript((id) => sessionStorage.setItem('meeting', id), run.id);
  await page.goto('/');
  const dialog = page.getByRole('dialog', { name: 'Decisions venceu' });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.verdict-scenario')).toHaveText(
    'Execução real · O que entra no lançamento?',
  );
  await expect(dialog.locator('.final-analysis')).toContainText('Decisions venceu por 6 a 5');
  await expect(dialog.locator('.final-analysis')).toContainText('A resposta de Jev foi incerteza');
  await expect(dialog.locator('.final-score-team.jev strong')).toHaveText('5');
  await expect(dialog.locator('.final-score-team.decisions strong')).toHaveText('6');
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  const reveal = page.getByRole('button', { name: 'Ver resultado', exact: true });
  await expect(reveal).toBeFocused();
  const inline = page.getByRole('region', { name: 'Veredito da reunião' });
  await inline.getByText('Julgamento 1 · primeira avaliação cega', { exact: true }).click();
  await inline.getByText('Julgamento 2 · identidades invertidas', { exact: true }).click();
  await expect(inline).toContainText('Decisions considerou a evidência atual; Jev pediu revisão.');
  await expect(inline).toContainText('Decisions encerrou o caso; Jev pediu revisão.');
  await expect(page.getByRole('region', { name: 'Comentário do Opus' })).toContainText(
    'Decisions venceu esta rodada. A resposta de Jev exige revisão.',
  );
  await page.getByRole('button', { name: 'Modo gravação' }).click();
  await reveal.click();
  await page.keyboard.press('Escape');
  await expect(page.locator('.app')).toHaveClass(/recording/);
  await expect(reveal).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('.app')).not.toHaveClass(/recording/);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Decisions venceu' })).toBeVisible();
  await expect(dialog).not.toBeVisible();
  await reveal.click();
  await expect(dialog.locator('.verdict-scenario')).toHaveText(
    'Replay · Execução real · O que entra no lançamento?',
  );
  for (const [width, height, name] of [
    [1920, 1080, 'fullhd'],
    [1440, 1000, 'desktop'],
    [1060, 900, 'user-1060'],
    [390, 844, 'mobile'],
  ] as const) {
    await page.setViewportSize({ width, height });
    await dialog.locator('.verdict-modal-content').evaluate((e) => (e.scrollTop = 0));
    await page.waitForFunction(() => document.fonts.status === 'loaded');
    await dialog.evaluate(async (element) => {
      await Promise.all(element.getAnimations({ subtree: true }).map((a) => a.finished));
    });
    expect(await dialog.evaluate((d) => d.scrollWidth <= d.clientWidth)).toBe(true);
    await expect(dialog.getByRole('button', { name: 'Voltar à reunião' })).toBeInViewport();
    await page.screenshot({ path: `.impeccable/review/verdict-${name}.png` });
  }
  const content = dialog.locator('.verdict-modal-content');
  await content.evaluate((e) => (e.scrollTop = e.scrollHeight));
  expect(await content.evaluate((e) => e.scrollTop)).toBeGreaterThan(0);
  await dialog.getByRole('button', { name: 'Voltar à reunião' }).click();
  await reveal.click();
  await expect.poll(() => content.evaluate((e) => e.scrollTop)).toBe(0);
  await expect(dialog.getByRole('heading', { name: 'Decisions venceu' })).toBeInViewport();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await dialog.getByRole('button', { name: 'Fechar resultado' }).click();
  await reveal.click();
  expect(
    await dialog.locator('.verdict-hero h2').evaluate((e) => getComputedStyle(e).animationName),
  ).toBe('none');
});

test('presents a three-way verdict with three scores and rotated judgments', async ({
  page,
  request,
}) => {
  const run = await completedDemo(request);
  run.mode = 'live';
  for (const r of run.rounds) {
    const q = run.scenario.rounds.find((x) => x.id === r.roundId)!.question;
    for (const provider of ['jev', 'decisions', 'clef'] as const)
      r.results[provider]!.grade = { status: 'correct', effect: q.success };
  }
  run.rounds[5].results.jev!.grade = { status: 'uncertain', effect: 'Revisão humana.' };
  run.rounds[2].results.decisions!.grade = { status: 'incorrect', effect: 'Divergência.' };
  const base = { evidence: [], limitations: ['A amostra é pequena.'] };
  run.verdict = {
    winner: 'clef',
    summary: '[[C]] venceu por 6 a 5 contra [[A]] e [[B]].',
    passes: [
      {
        mapping: { A: 'jev', B: 'decisions', C: 'clef' },
        result: { ...base, winner: 'C', summary: '[[C]] venceu por 6 a 5 contra [[A]] e [[B]].' },
      },
      {
        mapping: { A: 'clef', B: 'jev', C: 'decisions' },
        result: { ...base, winner: 'A', summary: '[[A]] venceu.' },
      },
      {
        mapping: { A: 'decisions', B: 'clef', C: 'jev' },
        result: { ...base, winner: 'B', summary: '[[B]] venceu.' },
      },
    ],
  };
  await showSaved(page, run);
  const dialog = page.getByRole('dialog', { name: 'Clef venceu' });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.final-analysis')).toContainText(
    'Clef venceu por 6 a 5 contra Jev e Decisions.',
  );
  await expect(dialog.locator('.final-score-team')).toHaveCount(3);
  await expect(dialog.locator('.final-score-team.clef strong')).toHaveText('6');
  await expect(dialog.getByLabel('Vencedor segundo o Opus')).toHaveCount(1);
  for (const [width, height, name] of [
    [1440, 1000, 'desktop'],
    [390, 844, 'mobile'],
  ] as const) {
    await page.setViewportSize({ width, height });
    await dialog.evaluate(async (element) => {
      await Promise.all(element.getAnimations({ subtree: true }).map((a) => a.finished));
    });
    expect(await dialog.evaluate((d) => d.scrollWidth <= d.clientWidth)).toBe(true);
    await page.screenshot({ path: `.impeccable/review/verdict-three-way-${name}.png` });
  }
  await dialog.getByRole('button', { name: 'Voltar à reunião' }).click();
  const inline = page.getByRole('region', { name: 'Veredito da reunião' });
  await expect(inline.getByText('Julgamento 3 · posições rotacionadas')).toBeVisible();
});

for (const winner of ['jev', 'tie', 'inconclusive', 'demo'] as const) {
  test(`presents the ${winner} outcome without inventing a winner`, async ({ page, request }) => {
    const run = await resultFixture(request);
    if (winner === 'demo') run.mode = 'demo';
    else run.verdict!.winner = winner;
    run.verdict!.summary =
      winner === 'jev'
        ? '[[A]] venceu esta reunião.'
        : winner === 'tie'
          ? 'Os dois contribuíram igualmente.'
          : winner === 'demo'
            ? 'Ensaio sintético, sem comparação real.'
            : 'Os dois julgamentos não concordaram sobre o vencedor.';
    run.verdict!.passes[0].result.summary = run.verdict!.summary;
    if (winner === 'jev') {
      run.rounds[5].results.jev!.grade.status = 'correct';
      run.rounds[5].results.decisions!.grade.status = 'uncertain';
    }
    const title =
      winner === 'jev'
        ? 'Jev venceu'
        : winner === 'tie'
          ? 'Empate'
          : winner === 'demo'
            ? 'Ensaio concluído'
            : 'Resultado inconclusivo';
    await showSaved(page, run);
    const dialog = page.getByRole('dialog', { name: title });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('.verdict-scenario')).toContainText(
      winner === 'demo' ? 'Replay · Ensaio sintético' : 'Replay · Execução real',
    );
    if (winner === 'jev')
      await expect(dialog.locator('.final-analysis')).toHaveText(/Jev venceu esta reunião/);
    else await expect(dialog.getByLabel('Vencedor segundo o Opus')).toHaveCount(0);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await dialog.evaluate(async (element) => {
      await Promise.all(element.getAnimations({ subtree: true }).map((a) => a.finished));
    });
    await page.screenshot({ path: `.impeccable/review/verdict-${winner}.png` });
    await dialog.getByRole('button', { name: 'Voltar à reunião' }).click();
    await expect(dialog).not.toBeVisible();
  });
}
