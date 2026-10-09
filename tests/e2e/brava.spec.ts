import { test, expect, type APIRequestContext } from '@playwright/test';
import type { Brava, BravaView, Provider } from '../../shared/types';
import { buildBravaReport, compact } from '../../shared/brava-report';
import { gradeAnswer } from '../../shared/scoring';

async function clearActive(request: APIRequestContext) {
  for (const item of await (await request.get('/api/bravas')).json())
    if (!['complete', 'cancelled', 'failed'].includes(item.phase))
      await request.post(`/api/bravas/${item.id}/cancel`);
  for (const item of await (await request.get('/api/series')).json())
    if (item.phase === 'running') await request.post(`/api/series/${item.id}/cancel`);
  for (const item of await (await request.get('/api/runs')).json())
    if (!['complete', 'cancelled', 'failed'].includes(item.phase))
      await request.post(`/api/runs/${item.id}/cancel`);
}

test('runs the rehearsal Resiliência by itself and ends on its own report', async ({
  page,
  request,
}) => {
  test.setTimeout(180_000);
  await clearActive(request);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/#/brava');
  await page.getByRole('button', { name: 'Ensaio da Resiliência', exact: true }).click();
  await expect(page.locator('.app')).toHaveClass(/recording/);
  const live = page.getByRole('region', { name: 'Resiliência ao vivo' });
  await expect(live).toBeVisible();
  await expect(live.locator('.brava-row')).toHaveCount(3);
  await expect(live.locator('.brava-tile.is-correct').first()).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: '.impeccable/review/brava-running-fullhd.png' });
  const report = page.getByRole('dialog', { name: 'Ensaio da Resiliência concluído' });
  await expect(report).toBeVisible({ timeout: 150_000 });
  await expect(report.locator('.podium-card')).toHaveCount(3);
  await expect(report.locator('.calibration svg')).toBeVisible();
  await report.getByRole('button', { name: 'Ver detalhes' }).click();
  await expect(page.getByRole('region', { name: 'Boletim da Resiliência' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Histórico', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Rodadas de Resiliência' })).toBeVisible();
});

test('presents a live-looking Resiliência report with margins, calibration and the round 1 comparison', async ({
  page,
  request,
}) => {
  test.setTimeout(180_000);
  await clearActive(request);
  const started: BravaView = await (
    await request.post('/api/bravas', { data: { mode: 'demo' } })
  ).json();
  await expect
    .poll(async () => (await (await request.get(`/api/bravas/${started.id}`)).json()).phase, {
      timeout: 150_000,
    })
    .toBe('complete');
  const { brava }: { brava: Brava } = await (
    await request.get(`/api/bravas/${started.id}/export`)
  ).json();
  // Browser-only fixture: answers, usage and latency shaped like a real run.
  const miss: Record<Provider, number> = { jev: 0.16, decisions: 0.11, clef: 0.09 };
  const ms: Record<Provider, number> = { jev: 320, decisions: 340, clef: 780 };
  const cost: Record<Provider, number> = { jev: 0.000024, decisions: 0.000037, clef: 0.000095 };
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  brava.mode = 'live';
  for (const item of brava.items)
    for (const p of brava.providers) {
      const r = brava.results[item.id][p]!;
      const q = item.question;
      const wrong = rand() < miss[p];
      const confidence = 0.75 + rand() * 0.24;
      const keys =
        q.type === 'predicate'
          ? ['true', 'false']
          : (q.options?.map((o) => o.value) ?? q.levels!.map((_, i) => String(i)));
      const expected = String(q.expected);
      const chosen = wrong ? keys.find((k) => k !== expected)! : expected;
      const probabilities = keys.map((k) => ({
        value: k,
        label: k,
        probability: k === chosen ? confidence : (1 - confidence) / (keys.length - 1),
      }));
      const value =
        q.type === 'predicate'
          ? probabilities[0].probability
          : q.type === 'score'
            ? Number(chosen)
            : chosen;
      r.answer = { type: q.type, value, probabilities, confidence };
      r.grade = gradeAnswer(q, r.answer);
      r.costUsd = cost[p];
      r.durationMs = ms[p] + rand() * 80;
      r.inputTokens = 380;
    }
  brava.report = buildBravaReport(brava, brava.providers, {
    seriesId: 'fixture',
    decisions: 36,
    accuracy: { jev: 34 / 36, decisions: 35 / 36, clef: 1 },
  });
  brava.analysis = {
    mapping: { A: 'clef', B: 'jev', C: 'decisions' },
    headline: 'Na Resiliência, [[A]] liderou, mas ninguém passou ileso pela negação',
    summary:
      '[[A]] teve a maior nota média. [[B]] mudou de resposta com texto irrelevante; [[C]] adivinhou onde deveria dizer "não informado".',
    evidence: [
      {
        roundId: 'neg-voo-escopo',
        participant: 'B',
        observation: '[[B]] errou a versão com escopo alterado.',
      },
    ],
    limitations: ['Itens escritos pelo autor do teste.'],
  };
  const shown: BravaView = {
    ...brava,
    results: Object.fromEntries(
      Object.entries(brava.results).map(([id, by]) => {
        const q = brava.items.find((i) => i.id === id)!.question;
        return [id, Object.fromEntries(Object.entries(by).map(([p, r]) => [p, compact(q, r!)]))];
      }),
    ),
  };
  await page.route(`**/api/bravas/${brava.id}`, (route) => route.fulfill({ json: shown }));
  await page.addInitScript((id) => sessionStorage.setItem('brava', id), brava.id);
  await page.goto('/');
  await page.getByRole('button', { name: 'Ver boletim da Resiliência', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: /ninguém passou ileso/ });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.round-compare-row')).toHaveCount(3);
  await expect(dialog.locator('.calibration circle').first()).toBeVisible();
  for (const [width, height, name] of [
    [1920, 1080, 'fullhd'],
    [390, 844, 'mobile'],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(1600);
    expect(await dialog.evaluate((d) => d.scrollWidth <= d.clientWidth)).toBe(true);
    const content = dialog.locator('.series-dialog-content');
    for (const [i, top] of [0, 900, 1800, 2700].entries()) {
      await content.evaluate((e, y) => (e.scrollTop = y), top);
      await page.screenshot({ path: `.impeccable/review/brava-report-${name}-${i + 1}.png` });
    }
    await content.evaluate((e) => (e.scrollTop = 0));
  }
});
