import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

test.beforeEach(async ({ page }) => {
  await page.goto('/relatorio-conclusao.html');
});

test('navega por capítulos, histórico do navegador e abas pelo teclado', async ({ page }) => {
  await expect(page.locator('[data-chapter]:visible')).toHaveAttribute('id', 'inicio');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('[data-chapter]:visible')).toHaveAttribute('id', 'modelos');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('[data-chapter]:visible')).toHaveAttribute('id', 'visao-geral');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('[data-chapter]:visible')).toHaveAttribute('id', 'reunioes');
  const tabs = page.getByRole('tablist', { name: 'Cenários de reunião' });
  await tabs.getByRole('tab').first().focus();
  await page.keyboard.press('ArrowRight');
  await expect(tabs.getByRole('tab').nth(1)).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#meeting-1')).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Capítulos do relatório' })
    .getByRole('link', { name: 'Imagens Quatro tarefas visuais' })
    .click();
  await expect(page.locator('#imagens')).toBeVisible();
  await page.goBack();
  await expect(page.locator('#reunioes')).toBeVisible();
  await expect(page.locator('#chapter-position')).toHaveText('4 de 11');
});

test('filtra casos, abre evidências e retorna do estado vazio', async ({ page }) => {
  await page.goto('/relatorio-conclusao.html#resiliencia');
  await page.getByRole('tab', { name: 'Português real', exact: true }).click();
  const panel = page.locator('#brava-portugues');
  await panel.locator('[data-case-filter]').selectOption('all');
  await expect(panel.locator('[data-case]:visible')).toHaveCount(12);
  await panel.getByRole('button', { name: 'Mostrar mais perguntas' }).click();
  await expect(panel.locator('[data-case]:visible')).toHaveCount(24);
  await panel.locator('[data-search-input]').fill('não-existe-este-caso-99999');
  await expect(panel.locator('[data-no-cases]')).toBeVisible();
  await panel.locator('[data-search-input]').fill('');
  const example = panel.locator('[data-case]:visible').first();
  await example.locator('summary').first().click();
  await expect(example.locator('.answer-key')).toBeVisible();
});

test('calcula Brier e custo e filtra as recomendações', async ({ page }) => {
  await page.goto('/relatorio-conclusao.html#metricas');
  const slider = page.locator('#brier-confidence');
  await slider.fill('0');
  await expect(page.locator('#brier-result')).toHaveText('2');
  await slider.fill('100');
  await expect(page.locator('#brier-result')).toHaveText('0');
  await page.goto('/relatorio-conclusao.html#custo-tempo');
  await page.locator('#cost-volume').selectOption('1000');
  await expect(page.locator('[data-unit-cost]').nth(6)).toHaveText('US$ 0,08');
  await expect(page.locator('#cost-caption')).toContainText('1.000 decisões');
  await page.goto('/relatorio-conclusao.html#escolha');
  await page.getByRole('button', { name: 'Decisões com imagens', exact: true }).click();
  await expect(page.locator('[data-recommendation]:visible')).toHaveCount(2);
  await page.getByRole('button', { name: 'Todas as situações' }).click();
  await expect(page.locator('[data-recommendation]:visible')).toHaveCount(8);
});

test('baixa HTML autossuficiente e funciona sem rede', async ({ page, context }, testInfo) => {
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Baixar HTML' }).click();
  const file = await download;
  const path = testInfo.outputPath('conclusao.html');
  await file.saveAs(path);
  const offline = await context.newPage();
  await context.setOffline(true);
  const errors: string[] = [];
  offline.on('pageerror', (error) => errors.push(error.message));
  const external: string[] = [];
  offline.on('request', (request) => {
    if (/^https?:/.test(request.url())) external.push(request.url());
  });
  await offline.goto(pathToFileURL(path).href);
  await expect(offline.locator('#back-arena')).toBeHidden();
  await expect(offline.locator('#inicio')).toBeVisible();
  await offline.locator('nav [href="#reunioes"]').click();
  await expect(offline.locator('#reunioes')).toBeVisible();
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test('modo apresentação e movimento reduzido preservam os controles', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() =>
    Object.defineProperty(document.documentElement, 'requestFullscreen', {
      value: () => Promise.reject(new Error('unsupported')),
    }),
  );
  await page.getByRole('button', { name: 'Apresentar', exact: true }).click();
  await expect(page.locator('body')).toHaveClass('is-presenting');
  await page.keyboard.press('Escape');
  await expect(page.locator('#present')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#present')).toHaveText('Apresentar');
  expect(
    await page.locator('.chapter.active').evaluate((el) => getComputedStyle(el).animationName),
  ).toBe('none');
});

test('mantém largura e tipografia em todos os capítulos e captura a revisão visual', async ({
  page,
}) => {
  await mkdir('.impeccable/review/conclusion', { recursive: true });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const [name, width, height] of [
    ['desktop', 1920, 1080],
    ['user-1878', 1878, 898],
    ['user-1075', 1075, 823],
    ['mobile', 390, 844],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.goto('/relatorio-conclusao.html');
    await page.evaluate(() => document.fonts.ready);
    await expect(page.getByRole('button', { name: 'Baixar HTML', exact: true })).toBeVisible();
    expect(
      await page
        .locator('.round-band p, .overview-takeaways p, .case-answers p, #brier-explanation')
        .evaluateAll((elements) =>
          elements.every((el) => getComputedStyle(el).fontSize === '15px'),
        ),
    ).toBe(true);
    const chapterIds = await page
      .locator('[data-chapter]')
      .evaluateAll((nodes) => nodes.map((el) => el.id));
    for (const id of chapterIds) {
      await page.locator(`nav [href="#${id}"]`).click();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `${name}/${id}: overflow`,
      ).toBe(true);
      if (id !== 'inicio') {
        expect(
          await page.locator(`#${id} h1`).evaluate((el) => getComputedStyle(el).fontSize),
        ).toBe('25px');
      }
    }
    await page.locator('nav [href="#visao-geral"]').click();
    await page.screenshot({
      path: resolve(`.impeccable/review/conclusion/${name}.png`),
      fullPage: true,
    });
    if (name === 'desktop') {
      for (const id of ['escolha', 'metricas']) {
        await page.locator(`nav [href="#${id}"]`).click();
        await page.screenshot({
          path: resolve(`.impeccable/review/conclusion/${id}.png`),
          fullPage: true,
        });
      }
      await page.locator('nav [href="#reunioes"]').click();
      await page.getByRole('tab', { name: 'O que entra no lançamento?' }).click();
      await page.locator('#meeting-1 .evidence-case').last().locator('summary').first().click();
      await page.evaluate(() => {
        (document.activeElement as HTMLElement)?.blur();
        window.scrollTo(0, 0);
      });
      await page.screenshot({
        path: resolve('.impeccable/review/conclusion/reunioes.png'),
        fullPage: true,
      });
    }
  }
  expect(errors).toEqual([]);
});

test('a navegação da arena oferece a conclusão', async ({ page }) => {
  await page.goto('/');
  await page
    .getByRole('navigation', { name: 'Navegação principal' })
    .getByRole('link', { name: 'Conclusão' })
    .click();
  await expect(page.locator('#inicio')).toBeVisible();
});
