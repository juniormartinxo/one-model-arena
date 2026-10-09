import { test, expect, type APIRequestContext } from '@playwright/test';
import type { Provider, Run, SeriesSnapshot } from '../../shared/types';
import { buildSeriesReport } from '../../shared/report';

async function clearActive(request: APIRequestContext) {
  for (const item of await (await request.get('/api/series')).json())
    if (item.phase === 'running') await request.post(`/api/series/${item.id}/cancel`);
  for (const item of await (await request.get('/api/runs')).json())
    if (!['complete', 'cancelled', 'failed'].includes(item.phase))
      await request.post(`/api/runs/${item.id}/cancel`);
}

test('runs the whole rehearsal marathon without clicks and ends on the report', async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  await clearActive(request);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  await page
    .getByRole('link', { name: /^Rodada 1 · piloto automático Maratona de reuniões/ })
    .click();
  await expect(page).toHaveURL(/#\/maratona$/);
  await page.getByRole('button', { name: 'Ensaio da Maratona de reuniões', exact: true }).click();
  await expect(page.locator('.app')).toHaveClass(/recording/);
  const progress = page.getByLabel('Progresso da Maratona de reuniões');
  await expect(progress).toContainText('Reunião 1 de 6');
  await expect(page.getByText('Piloto automático', { exact: true })).toBeVisible();
  await expect(page.locator('.opus-panel.has-feedback')).toBeVisible({ timeout: 30_000 });
  // Recording mode: the whole stage stays inside a full HD screen, no scrolling.
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(
    true,
  );
  await expect(
    page.getByRole('button', { name: /Próxima rodada|Começar primeira rodada/ }),
  ).toHaveCount(0);
  await expect(progress).toContainText('Reunião 2 de 6', { timeout: 30_000 });
  await page.screenshot({ path: '.impeccable/review/marathon-running-fullhd.png' });
  const report = page.getByRole('dialog', { name: 'Ensaio da Maratona de reuniões concluído' });
  await expect(report).toBeVisible({ timeout: 90_000 });
  await expect(report.locator('.podium-card')).toHaveCount(3);
  await expect(report).toContainText('36 decisões por modelo');
  await expect(report).toContainText('Nada aqui mede os modelos');
  await expect(report.locator('.recommendation')).toHaveCount(0);
  await expect(report.locator('.battery')).toHaveCount(3);
  await report.getByRole('button', { name: 'Ver detalhes' }).click();
  await expect(page.getByRole('region', { name: 'Boletim da Maratona de reuniões' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Histórico', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Abrir boletim' }).first()).toBeVisible();
});

test('presents a live-looking report with honest, data-backed highlights', async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  await clearActive(request);
  const started: SeriesSnapshot = await (
    await request.post('/api/series', { data: { mode: 'demo' } })
  ).json();
  await expect
    .poll(
      async () =>
        (await (await request.get(`/api/series/${started.series.id}`)).json()).series.phase,
      {
        timeout: 90_000,
      },
    )
    .toBe('complete');
  const snapshot: SeriesSnapshot = await (
    await request.get(`/api/series/${started.series.id}`)
  ).json();
  const runs: Run[] = await Promise.all(
    snapshot.series.runIds.map(async (id) => (await request.get(`/api/runs/${id}`)).json()),
  );
  // Browser-only fixture: usage, latency and a few misses shaped like a real marathon.
  const perCall: Record<Provider, { cost: number; ms: number }> = {
    jev: { cost: 0.0000142, ms: 610 },
    decisions: { cost: 0.0000318, ms: 1180 },
    clef: { cost: 0.0000815, ms: 430 },
  };
  const misses: Record<Provider, string[]> = {
    jev: ['p6', 'a4', 'd2'],
    decisions: ['c5'],
    clef: ['a1', 'd5'],
  };
  for (const run of runs) {
    run.mode = 'live';
    for (const round of run.rounds) {
      const q = run.scenario.rounds.find((r) => r.id === round.roundId)!.question;
      for (const p of ['jev', 'decisions', 'clef'] as const) {
        const result = round.results[p]!;
        result.costUsd = perCall[p].cost;
        result.durationMs = perCall[p].ms;
        result.inputTokens = 340;
        const miss = misses[p].includes(round.roundId);
        result.grade = {
          status: miss ? 'incorrect' : 'correct',
          effect: miss ? q.failure : q.success,
        };
        const value = miss
          ? q.type === 'choice'
            ? q.options!.find((o) => o.value !== q.expected)!.value
            : q.type === 'predicate'
              ? Number(!q.expected) * 0.9 + 0.05
              : Number(q.expected) === 2
                ? 0.6
                : 2
          : q.type === 'predicate'
            ? Number(q.expected) * 0.97 + 0.015
            : q.expected;
        const keys = q.options?.map((o) => o.value) ??
          q.levels?.map((_, i) => String(i)) ?? ['true', 'false'];
        const chosen = q.type === 'choice' ? String(value) : String(Math.round(Number(value)));
        result.answer = {
          type: q.type,
          value: value as string | number,
          probabilities: keys.map((k) => ({
            value: k,
            label: k,
            probability:
              q.type === 'predicate'
                ? k === 'true'
                  ? Number(value)
                  : 1 - Number(value)
                : k === chosen
                  ? 0.92
                  : 0.08 / (keys.length - 1),
          })),
        };
      }
    }
  }
  const report = buildSeriesReport(runs, ['jev', 'decisions', 'clef']);
  const series = {
    ...snapshot.series,
    mode: 'live' as const,
    report,
    analysis: {
      mapping: { A: 'clef' as const, B: 'jev' as const, C: 'decisions' as const },
      headline: '[[C]] errou só uma vez em 36; [[A]] e [[B]] tropeçaram nos casos avançados',
      summary:
        '[[C]] liderou com 35 acertos. [[A]] errou em a1 e d5, onde era preciso reconhecer que a alternativa não servia ao público afetado e que a contradição exigia revisão. [[B]] errou p6, a4 e d2: tratou evidência superada e escopo de aditivo de forma inadequada.',
      evidence: [
        {
          roundId: 'c5',
          participant: 'C' as const,
          observation: '[[C]] escolheu cancelar sem esclarecer o alvo.',
        },
        {
          roundId: 'd2',
          participant: 'B' as const,
          observation: '[[B]] estendeu o aditivo a outra unidade.',
        },
      ],
      limitations: ['36 perguntas fictícias.'],
    },
  };
  await page.route(`**/api/series/${series.id}`, (route) =>
    route.fulfill({ json: { series, run: runs.at(-1) } }),
  );
  await page.addInitScript((id) => sessionStorage.setItem('series', id), series.id);
  await page.goto('/');
  await page.getByRole('button', { name: 'Ver boletim', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: /errou só uma vez/ });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.podium-card.is-winner')).toContainText('Decisions');
  await expect(dialog.locator('.recommendation')).toHaveCount(3);
  await expect(dialog.locator('.recommendation').nth(1)).toContainText('Jev');
  await expect(dialog.locator('.recommendation').nth(2)).toContainText('Clef');
  for (const [width, height, name] of [
    [1920, 1080, 'fullhd'],
    [1440, 1000, 'desktop'],
    [390, 844, 'mobile'],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(1600);
    expect(await dialog.evaluate((d) => d.scrollWidth <= d.clientWidth)).toBe(true);
    await page.screenshot({ path: `.impeccable/review/marathon-report-${name}.png` });
    await dialog.locator('.series-dialog-content').evaluate((e) => (e.scrollTop = 900));
    await page.screenshot({ path: `.impeccable/review/marathon-report-${name}-2.png` });
    await dialog.locator('.series-dialog-content').evaluate((e) => (e.scrollTop = 1900));
    await page.screenshot({ path: `.impeccable/review/marathon-report-${name}-3.png` });
    await dialog.locator('.series-dialog-content').evaluate((e) => (e.scrollTop = 0));
  }
});
