import { test, expect } from '@playwright/test';
test('offers the original and advanced scenarios and can run the dossier control', async ({
  page,
  request,
}) => {
  const list = await (await request.get('/api/runs')).json();
  for (const run of list)
    if (!['complete', 'failed', 'cancelled'].includes(run.phase))
      await request.post(`/api/runs/${run.id}/cancel`);
  await page.goto('/');
  await page.getByRole('button', { name: 'Sala de reuniões', exact: true }).click();
  await expect(page).toHaveURL(/#\/sala$/);
  const select = page.getByLabel('Cenário da reunião');
  await expect(select.locator('option')).toHaveCount(6);
  for (const [id, title] of [
    ['loja', 'Crise na loja online'],
    ['produto', 'O que entra no lançamento?'],
    ['fornecedor', 'Qual fornecedor contratar?'],
    ['lancamento-avancado', 'Avançado · Lançamento sob pressão'],
    ['conversas-avancadas', 'Avançado · Quem pediu o quê?'],
    ['dossie-estresse', 'Estresse · Dossiê com versões conflitantes'],
  ]) {
    await select.selectOption(id);
    await expect(page.locator('.session-scenario')).toHaveText(title);
  }
  await page.getByRole('button', { name: 'Iniciar ensaio', exact: true }).click();
  await page.getByRole('button', { name: 'Começar primeira rodada' }).click();
  for (let i = 1; i < 6; i++) {
    await page.getByRole('button', { name: 'Próxima rodada', exact: true }).click();
    await expect(page.getByText(`Rodada ${i + 1} de 6`, { exact: true })).toBeVisible();
  }
  await expect(
    page.getByRole('dialog').getByRole('heading', { name: 'Ensaio concluído' }),
  ).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Voltar à reunião' }).click();
  const url = await page.getByRole('link', { name: 'Exportar evidências' }).getAttribute('href');
  const saved = await (await request.get(url!)).json();
  expect(saved.run.scenario.id).toBe('dossie-estresse');
  expect(saved.run.rounds).toHaveLength(6);
  expect(saved.run.cliCalls).toHaveLength(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('six-round meeting, commentary, recording view, evidence export and free replay', async ({
  page,
  request,
}) => {
  const list = await (await request.get('/api/runs')).json();
  for (const run of list)
    if (!['complete', 'failed', 'cancelled'].includes(run.phase))
      await request.post(`/api/runs/${run.id}/cancel`);
  await page.goto('/#/sala');
  await page.getByRole('button', { name: 'Iniciar ensaio', exact: true }).click();
  await expect(page.getByText('ENSAIO SINTÉTICO', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Começar primeira rodada' }).click();
  await expect(page.getByRole('region', { name: 'Comentário do Opus' })).toContainText(
    'Comentário sintético:',
  );
  for (let i = 1; i < 6; i++) {
    await page.getByRole('button', { name: 'Próxima rodada', exact: true }).click();
    await expect(page.getByText(`Rodada ${i + 1} de 6`, { exact: true })).toBeVisible();
  }
  const resultModal = page.getByRole('dialog');
  await expect(resultModal.getByRole('heading', { name: 'Ensaio concluído' })).toBeVisible();
  await resultModal.getByRole('button', { name: 'Voltar à reunião' }).click();
  const jev = page.getByRole('region', { name: 'Resultados Jev' }),
    decisions = page.getByRole('region', { name: 'Resultados Decisions' }),
    clef = page.getByRole('region', { name: 'Resultados Clef' });
  await expect(jev.locator('.score strong')).toHaveText('5');
  await expect(decisions.locator('.score strong')).toHaveText('5');
  await expect(clef.locator('.score strong')).toHaveText('5');
  await page.getByRole('button', { name: 'Modo gravação' }).click();
  await expect(page.getByRole('navigation')).not.toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('navigation')).toBeVisible();
  const exportUrl = await page
    .getByRole('link', { name: 'Exportar evidências' })
    .getAttribute('href');
  const evidence = await (await request.get(exportUrl!)).json();
  expect(evidence.run.rounds).toHaveLength(6);
  expect(evidence.run.cliCalls).toHaveLength(0);
  expect(evidence.run.mode).toBe('demo');
  const originalEvents = evidence.events.length;
  await page.getByRole('button', { name: 'Histórico', exact: true }).click();
  await page.getByRole('button', { name: 'Abrir replay' }).first().click();
  await expect(page.getByText('REPLAY', { exact: true })).toBeVisible();
  await expect(jev.locator('.score strong')).toHaveText('1');
  await expect(clef.locator('.score strong')).toHaveText('1');
  await expect(page.getByRole('heading', { name: 'Ensaio concluído' })).not.toBeVisible();
  await page.getByRole('button', { name: 'Próxima rodada do replay' }).click();
  await expect(page.getByText('Rodada 2 de 6', { exact: true })).toBeVisible();
  const after = await (await request.get(exportUrl!)).json();
  expect(after.events.length).toBe(originalEvents);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(jev).toBeVisible();
  await expect(decisions).toBeVisible();
  await expect(clef).toBeVisible();
  for (const [width, height, name] of [
    [1440, 1000, 'desktop'],
    [1075, 823, 'user-1075'],
    [390, 844, 'mobile'],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.waitForFunction(() => document.fonts.status === 'loaded');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const tops = await page
      .locator('.competitor')
      .evaluateAll((items) => items.map((e) => Math.round(e.getBoundingClientRect().top)));
    expect(new Set(tops).size).toBe(width > 860 ? 1 : 3);
    // Let the answer reveal finish so the review image shows the settled state.
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `.impeccable/review/three-way-${name}.png`, fullPage: true });
  }
});
test('deletes history with confirmation, clears replay state and preserves active meetings', async ({
  page,
  request,
}) => {
  await request.delete('/api/runs');
  const first = await (
    await request.post('/api/runs', { data: { scenarioId: 'loja', mode: 'demo' } })
  ).json();
  await request.post(`/api/runs/${first.id}/cancel`);
  const second = await (
    await request.post('/api/runs', { data: { scenarioId: 'produto', mode: 'demo' } })
  ).json();
  await request.post(`/api/runs/${second.id}/cancel`);
  const active = await (
    await request.post('/api/runs', { data: { scenarioId: 'fornecedor', mode: 'demo' } })
  ).json();
  expect(active.id).toBeTruthy();
  await page.goto('/');
  await page.evaluate((id) => sessionStorage.setItem('meeting', id), first.id);
  // Connection checks must not delay or restore an older history response.
  let releaseHealth!: () => void;
  const healthGate = new Promise<void>((resolve) => {
    releaseHealth = resolve;
  });
  await page.route('**/api/health', async (route) => {
    await healthGate;
    await route.fulfill({
      json: {
        keys: { jev: false, decisions: false, clef: false },
        claude: { available: false, authenticated: false },
        models: { claude: 'fixture', jev: 'fixture', decisions: 'fixture', clef: 'fixture' },
        ready: false,
      },
    });
  });
  await page.reload();
  await page.getByRole('button', { name: 'Histórico', exact: true }).click();
  const rows = page.locator('.history-list article');
  await expect(rows).toHaveCount(3);
  await expect(
    rows.filter({ hasText: 'Retomar reunião' }).getByRole('button', { name: /Excluir reunião:/ }),
  ).toBeDisabled();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: '.impeccable/review/history-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '.impeccable/review/history-mobile.png', fullPage: true });
  const firstDelete = page.getByRole('button', {
    name: 'Excluir reunião: Crise na loja online',
    exact: true,
  });
  page.once('dialog', (d) => d.dismiss());
  await firstDelete.click();
  await expect(rows).toHaveCount(3);
  page.once('dialog', (d) => d.accept());
  await firstDelete.click();
  await expect(rows).toHaveCount(2);
  expect(await page.evaluate(() => sessionStorage.getItem('meeting'))).toBeNull();
  expect((await request.get(`/api/runs/${first.id}/export`)).status()).toBe(404);
  const healthResponse = page.waitForResponse('**/api/health');
  releaseHealth();
  await healthResponse;
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await expect(rows).toHaveCount(2);
  page.once('dialog', (d) => d.dismiss());
  await page.getByRole('button', { name: 'Limpar histórico', exact: true }).click();
  await expect(rows).toHaveCount(2);
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Limpar histórico', exact: true }).click();
  await expect(rows).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Limpar histórico', exact: true })).toBeDisabled();
  expect((await request.get(`/api/runs/${active.id}`)).status()).toBe(200);
  await request.post(`/api/runs/${active.id}/cancel`);
  await page.getByRole('button', { name: 'Atualizar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Limpar histórico', exact: true })).toBeEnabled();
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Limpar histórico', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Nada gravado ainda' })).toBeVisible();
});
