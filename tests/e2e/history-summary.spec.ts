import { test, expect } from '@playwright/test';
import type { BravaSummary, RunSummary, SeriesSummary } from '../../shared/types';

test('shows independent awards and every cost side by side, including honest non-winning states', async ({
  page,
}) => {
  const base: RunSummary = {
    id: '00000000-0000-4000-8000-000000000001',
    mode: 'live',
    phase: 'complete',
    createdAt: '2026-10-08T21:48:33Z',
    title: 'O que entra no lançamento?',
    completedRounds: 6,
    providers: ['jev', 'decisions', 'clef'],
    winner: 'decisions',
    cheapest: 'jev',
    costs: {
      jev: { knownUsd: 0.00084, unknown: 0 },
      decisions: { knownUsd: 0.00216, unknown: 0 },
      clef: { knownUsd: 0.00432, unknown: 0 },
    },
  };
  const tied: RunSummary = {
    ...base,
    id: '00000000-0000-4000-8000-000000000002',
    title: 'Custos e veredito empatados',
    winner: 'tie',
    cheapest: 'tie',
    costs: {
      jev: { knownUsd: 0.00084, unknown: 0 },
      decisions: { knownUsd: 0.00084, unknown: 0 },
      clef: { knownUsd: 0.00084, unknown: 0 },
    },
  };
  const unknown: RunSummary = {
    ...base,
    id: '00000000-0000-4000-8000-000000000003',
    title: 'Consumo incompleto, gravado antes do Clef',
    providers: ['jev', 'decisions'],
    winner: 'inconclusive',
    cheapest: null,
    costs: { jev: { knownUsd: 0.00042, unknown: 2 }, decisions: { knownUsd: 0, unknown: 6 } },
  };
  const demo: RunSummary = {
    ...base,
    id: '00000000-0000-4000-8000-000000000004',
    mode: 'demo',
    title: 'Ensaio sem chamadas',
    winner: null,
    cheapest: null,
    costs: {
      jev: { knownUsd: 0, unknown: 0 },
      decisions: { knownUsd: 0, unknown: 0 },
      clef: { knownUsd: 0, unknown: 0 },
    },
  };
  await page.route('**/api/runs', (route) => route.fulfill({ json: [base, tied, unknown, demo] }));
  await page.route('**/api/series', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/bravas', (route) => route.fulfill({ json: [] }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Histórico', exact: true }).click();
  const rows = page.locator('.history-list article');
  const first = rows.first();
  await expect(first.locator('.history-award dd')).toHaveText('Decisions');
  await expect(first.locator('.history-award .lucide-trophy')).toHaveCount(1);
  await expect(first.locator('.history-cost-jev dd')).toContainText('0,00084');
  await expect(first.locator('.history-cost-decisions dd')).toContainText('0,00216');
  await expect(first.locator('.history-cost-clef dd')).toContainText('0,00432');
  await expect(first.locator('.history-economy dd')).toHaveText('Jev');
  await expect(first.locator('.history-economy svg')).toHaveCount(1);
  await expect(rows.nth(1).locator('.history-award dd')).toHaveText('Empate');
  await expect(rows.nth(1).locator('.history-economy dd')).toHaveText('Empate');
  await expect(rows.nth(1).locator('.lucide-trophy')).toHaveCount(0);
  await expect(rows.nth(2).locator('.history-cost-jev dd')).toContainText('≥');
  await expect(rows.nth(2).locator('.history-cost-decisions dd')).toHaveText('Desconhecido');
  await expect(rows.nth(2).locator('.history-cost-clef')).toHaveCount(0);
  await expect(rows.nth(2).locator('.history-economy dd')).toHaveText('Não comparável');
  await expect(rows.nth(2).locator('.history-economy svg')).toHaveCount(0);
  await expect(rows.nth(3).locator('.history-award dd')).toHaveText('Ensaio');
  await expect(rows.nth(3).locator('.history-economy dd')).toHaveText('Não se aplica');
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
    const cells = await first.locator('.history-summary > div').evaluateAll((elements) =>
      elements.map((e) => ({
        top: e.getBoundingClientRect().top,
        left: e.getBoundingClientRect().left,
      })),
    );
    if (width > 700) {
      expect(new Set(cells.map((c) => c.top)).size).toBe(1);
      expect(cells[0].left).toBeLessThan(cells[3].left);
    }
    const date = await first.locator('.history-description p').boundingBox();
    expect(cells[0].top).toBeGreaterThan(date!.y + date!.height);
    await page.screenshot({
      path: `.impeccable/review/history-summary-${name}.png`,
      fullPage: true,
    });
  }
});

test('shows the cheapest participant for all three rounds and explains incomplete costs', async ({
  page,
}, testInfo) => {
  const base: BravaSummary = {
    id: 'resilience-history',
    kind: 'brava',
    mode: 'live',
    phase: 'complete',
    createdAt: '2026-10-09T13:13:50Z',
    items: 298,
    winner: 'clef',
    cheapest: ['jev'],
  };
  const bravas: BravaSummary[] = [
    base,
    { ...base, id: 'visual-history', kind: 'visual', items: 80, cheapest: ['decisions'] },
    { ...base, id: 'visual-partial', kind: 'visual', items: 79, cheapest: [] },
    { ...base, id: 'visual-tie', kind: 'visual', items: 78, cheapest: ['decisions', 'clef'] },
    { ...base, id: 'visual-demo', kind: 'visual', items: 77, mode: 'demo', cheapest: [] },
    {
      ...base,
      id: 'visual-cancelled',
      kind: 'visual',
      items: 76,
      phase: 'cancelled',
      cheapest: [],
    },
  ];
  const series: SeriesSummary[] = [
    {
      id: 'marathon-history',
      mode: 'live',
      phase: 'complete',
      createdAt: base.createdAt,
      totalMeetings: 6,
      completedMeetings: 6,
      winner: 'clef',
      cheapest: ['jev'],
    },
  ];
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({
      json:
        path === '/api/bravas'
          ? bravas
          : path === '/api/series'
            ? series
            : path === '/api/health'
              ? { keys: {}, models: {}, claude: { available: false } }
              : [],
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Histórico', exact: true }).click();
  const row = (title: string) =>
    page
      .locator('.history-list article')
      .filter({ has: page.getByRole('heading', { name: title, exact: true }) });
  await expect(row('Maratona de reuniões · 6 reuniões')).toContainText('Mais barato: Jev');
  await expect(row('Resiliência · 298 testes')).toContainText('Mais barato: Jev');
  await expect(row('Rodada das imagens · 80 fotos')).toContainText('Mais barato: Decisions');
  await expect(row('Rodada das imagens · 79 fotos')).toContainText(
    'Mais barato: não comparável (custos incompletos)',
  );
  await expect(row('Rodada das imagens · 78 fotos')).toContainText(
    'Mais barato: Empate (Decisions, Clef)',
  );
  await expect(row('Rodada das imagens · 77 fotos')).not.toContainText('Mais barato:');
  await expect(row('Rodada das imagens · 76 fotos')).not.toContainText('Mais barato:');
  for (const width of [1440, 1075, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: testInfo.outputPath(`history-economy-${width}.png`),
      fullPage: true,
    });
  }
});
