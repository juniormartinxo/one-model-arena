import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

test('public experience stays read-only, navigable, responsive and honest before publication', async ({
  page,
  request,
}) => {
  const requests: string[] = [],
    errors: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'A próxima edição está em preparação.' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: /Iniciar|Ensaio|Nova rodada|Conexões/ }),
  ).toHaveCount(0);
  const tabs = page.getByRole('tablist', { name: 'Tipo de teste' });
  await tabs.getByRole('tab', { name: /Maratona de reuniões/ }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(tabs.getByRole('tab', { name: /Resiliência/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await tabs.getByRole('tab', { name: /Imagens/ }).click();
  await expect(page.locator('.pending-models>div')).toHaveCount(2);
  const method = page.getByRole('tablist', { name: 'Etapas do método' });
  await method.getByRole('tab', { name: /referência/ }).click();
  await expect(page.getByText('Resposta esperada:')).toBeVisible();
  await page.getByRole('slider', { name: 'Confiança em “sim”' }).fill('100');
  await expect(page.locator('.brier-readout output')).toHaveText('0,00');
  await page.getByRole('slider', { name: 'Confiança em “sim”' }).fill('0');
  await expect(page.locator('.brier-readout output')).toHaveText('2,00');
  await page.locator('.dataset-row').filter({ hasText: 'HateBR' }).locator('summary').click();
  await expect(page.getByRole('link', { name: 'Consultar a fonte' })).toHaveAttribute(
    'href',
    'https://github.com/franciellevargas/HateBR',
  );
  for (const width of [1920, 1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      `horizontal overflow at ${width}`,
    ).toBe(true);
  }
  await page.getByRole('button', { name: 'Abrir menu' }).click();
  await page.getByRole('navigation').getByRole('link', { name: 'Os datasets' }).click();
  await expect(page.getByRole('button', { name: 'Abrir menu' })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  expect(requests.filter((url) => new URL(url).pathname.startsWith('/api/'))).toEqual([]);
  expect(errors).toEqual([]);
  for (const path of ['/api/health', '/api/runs', '/api/bravas', '/api/series']) {
    expect((await request.post(path, { data: { mode: 'live' } })).status()).toBeGreaterThanOrEqual(
      400,
    );
  }
});

test('published results are rendered from the public artifact, including margins and evidence', async ({
  page,
}) => {
  const providerRows = ['decisions', 'clef'].map((provider, i) => ({
    provider,
    models: ['test-fixture-model'],
    score: 0.8 + 0.05 * i,
    correct: 16 + i,
    incorrect: 4 - i,
    uncertain: 0,
    unavailable: 0,
    total: 20,
    brier: 0.2,
    ece: 0.05,
    medianMs: 500,
    costUsd: 0.001,
    unknownCosts: 0,
    costPerMillion: 50,
  }));
  await page.route('**/data/edition.json', (route) =>
    route.fulfill({
      json: {
        schemaVersion: 1,
        status: 'published',
        edition: {
          id: 'fixture-only',
          title: 'Edição sintética de teste de interface',
          preparedAt: '2026-10-09T10:00:00.000Z',
          codeRevision: 'a'.repeat(40),
          rulesHash: 'b'.repeat(64),
          results: [
            {
              kind: 'imagens',
              sourceId: '11111111-1111-4111-8111-111111111111',
              executedAt: '2026-10-09T10:00:00.000Z',
              catalogHashes: ['c'.repeat(64)],
              winner: 'clef',
              reason: 'points',
              standings: providerRows,
              batteries: [
                {
                  id: 'contagem',
                  title: 'Contagem',
                  unit: 'item',
                  units: 20,
                  scores: providerRows.map((r) => ({ provider: r.provider, score: r.score })),
                },
              ],
              margins: [{ vs: 'decisions', low: -0.05, high: 0.12, within: true }],
              annulled: [],
              sampleReferences: [],
              excludedBatteries: [],
            },
          ],
        },
      },
    }),
  );
  await page.goto('/');
  await page.getByRole('tab', { name: /Imagens/ }).click();
  await expect(
    page.getByText(/Diferença dentro da margem de erro em relação a Decisions/),
  ).toBeVisible();
  await expect(page.locator('.result-score').last()).toHaveText('85%');
  await page.locator('.result-details>summary').click();
  await expect(page.getByText('Intervalos de 95% da diferença')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Baixar dados desta edição' })).toHaveAttribute(
    'href',
    '/data/edition.json',
  );
  await page.locator('.provenance>summary').click();
  await expect(page.getByText('a'.repeat(40), { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('an invalid artifact fails closed instead of showing invented results', async ({ page }) => {
  await page.route('**/data/edition.json', (route) =>
    route.fulfill({ json: { mode: 'live', private: 'not-public' } }),
  );
  await page.goto('/');
  await expect(page.getByText('Resultados indisponíveis no momento.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Baixar dados desta edição' })).toHaveCount(0);
});

test('the built artifact contains no studio entry, execution API, or server functions', () => {
  const assets = readdirSync('dist-public/assets').filter((f) => f.endsWith('.js'));
  const code = assets.map((f) => readFileSync(join('dist-public/assets', f), 'utf8')).join('\n');
  expect(
    code.match(
      /\/api\/(?:runs|series|bravas|health|images)|EventSource|startSeries\b|requestFor\b|TYPESAFE_API_KEY|CLOUDFLARE_API_TOKEN/g,
    ),
  ).toBeNull();
  expect(readdirSync('dist-public')).not.toContain('server');
  expect(JSON.parse(readFileSync('vercel.json', 'utf8')).outputDirectory).toBe('dist-public');
});
