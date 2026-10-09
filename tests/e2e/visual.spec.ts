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
  await expect(report.getByText('Acertos').first()).toBeVisible();
  await expect(report.getByText('Mudou de resposta quando só a forma mudou')).toHaveCount(0);
  await report.getByRole('button', { name: 'Ver detalhes' }).click();
  await expect(page.getByRole('region', { name: 'Boletim da rodada das imagens' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Histórico', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Rodadas das imagens' })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Rodada das imagens · 80 fotos' }).first(),
  ).toBeVisible();
});
