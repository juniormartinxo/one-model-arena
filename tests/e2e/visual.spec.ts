import { test, expect, type APIRequestContext } from '@playwright/test';

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

test('runs the rehearsal rodada das imagens with two models and ends on its own report', async ({
  page,
  request,
}) => {
  test.setTimeout(180_000);
  await clearActive(request);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/#/imagens');
  await page.getByRole('button', { name: 'Ensaio da rodada das imagens', exact: true }).click();
  const live = page.getByRole('region', { name: 'Rodada das imagens ao vivo' });
  await expect(live).toBeVisible();
  await expect(live.locator('.brava-row')).toHaveCount(2);
  await expect(live.getByRole('heading', { name: 'Contagem' })).toBeVisible();
  await expect(live.locator('.brava-tile.is-correct').first()).toBeVisible({ timeout: 30_000 });
  // Recording mode: the whole stage stays inside a full HD screen, no scrolling.
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(
    true,
  );
  const report = page.getByRole('dialog', { name: 'Ensaio da rodada das imagens concluído' });
  await expect(report).toBeVisible({ timeout: 150_000 });
  await expect(report.locator('.podium-card')).toHaveCount(2);
  expect(
    await report
      .locator('.report-hero h2')
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
  ).toBeLessThanOrEqual(36);
  // A finished round marks every battery done, the last one included.
  await expect(live.locator('.brava-steps li.done')).toHaveCount(4);
  await expect(report.getByText('Acertos').first()).toBeVisible();
  await expect(report.getByText('Mudou de resposta quando só a forma mudou')).toHaveCount(0);
  await report.getByRole('button', { name: 'Ver detalhes' }).click();
  await expect(page.getByRole('region', { name: 'Boletim da rodada das imagens' })).toBeVisible();
  // Completing the round must not shrink the whole page to fit the full report.
  await expect
    .poll(() => page.locator('main').evaluate((el) => getComputedStyle(el).zoom))
    .toBe('1');
  const summary = page.locator('.brava-report.is-summary');
  await expect(summary).toBeVisible();
  expect(await summary.evaluate((el) => el.getBoundingClientRect().bottom <= innerHeight)).toBe(
    true,
  );
  expect(
    await page.locator('main').evaluate((el) => el.getBoundingClientRect().width),
  ).toBeGreaterThan(1500);
  // Full HD at 110% and 120% zoom has a smaller CSS viewport. Check the actions,
  // not only the report: they must remain on screen without hiding page overflow.
  for (const viewport of [
    { width: 1920, height: 1080 },
    { width: 1745, height: 981 },
    { width: 1600, height: 900 },
  ]) {
    await page.getByRole('button', { name: 'Sair da gravação', exact: true }).click();
    await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(false);
    await page.setViewportSize(viewport);
    await page.getByRole('button', { name: 'Modo gravação', exact: true }).click();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollHeight <= innerHeight))
      .toBe(true);
    expect(
      await page
        .locator('.arena-actions')
        .evaluate((el) => el.getBoundingClientRect().bottom <= innerHeight),
    ).toBe(true);
    expect(await summary.evaluate((el) => el.getBoundingClientRect().bottom <= innerHeight)).toBe(
      true,
    );
  }
  await expect(page.locator('.end-actions')).toHaveCount(0);
  const toolbar = page.getByRole('group', { name: 'Ações da rodada' });
  await expect(toolbar.getByRole('button')).toHaveCount(3);
  await expect(toolbar.getByRole('link', { name: 'Exportar rodada das imagens' })).toBeVisible();
  await page
    .getByRole('button', { name: 'Ver boletim da rodada das imagens', exact: true })
    .click();
  await expect(report.locator('.report-charts')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(report).not.toBeVisible();
  await expect(page.locator('.app')).toHaveClass(/recording/);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Histórico', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Rodadas das imagens' })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Rodada das imagens · 80 fotos' }).first(),
  ).toBeVisible();
});
