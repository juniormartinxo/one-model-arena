import { test, expect } from '@playwright/test';
test('each round and the meeting room live in their own space', async ({ page, request }) => {
  for (const run of await (await request.get('/api/runs')).json())
    if (!['complete', 'failed', 'cancelled'].includes(run.phase))
      await request.post(`/api/runs/${run.id}/cancel`);
  await page.goto('/');
  // The lobby only points to the spaces: nothing starts from it.
  await expect(page.locator('.space-card')).toHaveCount(4);
  await expect(page.getByRole('button', { name: /^(Iniciar|Ensaio)/ })).toHaveCount(0);

  await page.getByRole('button', { name: 'Rodadas', exact: true }).click();
  await expect(page).toHaveURL(/#\/maratona$/);
  const tabs = page.getByRole('navigation', { name: 'Rodadas' });
  await tabs.getByRole('link', { name: '2 · Brava' }).click();
  await expect(page).toHaveURL(/#\/brava$/);
  await expect(page.getByRole('button', { name: 'Ensaio da rodada brava' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ensaio da maratona' })).toHaveCount(0);
  await tabs.getByRole('link', { name: '3 · Imagens' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Decisions × Clef');
  await page.goBack();
  await expect(page).toHaveURL(/#\/brava$/);
  await expect(page.getByRole('button', { name: 'Ensaio da rodada brava' })).toBeVisible();

  // A meeting started in the room stays in the room; the other spaces point back to it.
  await page.getByRole('button', { name: 'Sala de reuniões', exact: true }).click();
  await page.getByRole('button', { name: 'Iniciar ensaio', exact: true }).click();
  await expect(page.getByText('ENSAIO SINTÉTICO', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: /One Model Arena/ }).click();
  await expect(page.getByText('Sala de reuniões: sessão em andamento.')).toBeVisible();
  // "Rodadas" returns to the last round visited.
  await page.getByRole('button', { name: 'Rodadas', exact: true }).click();
  await expect(page).toHaveURL(/#\/brava$/);
  await expect(page.getByRole('button', { name: 'Ensaio da rodada brava' })).toBeDisabled();
  await page.getByRole('button', { name: 'Acompanhar.' }).click();
  await expect(page).toHaveURL(/#\/sala$/);
  await expect(page.getByRole('button', { name: 'Começar primeira rodada' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Começar primeira rodada' })).toBeVisible();
  await page.getByRole('button', { name: 'Encerrar' }).click();
  await expect(page.getByRole('button', { name: 'Nova reunião' })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
