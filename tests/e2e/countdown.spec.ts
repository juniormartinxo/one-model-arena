import { test, expect, type Page } from '@playwright/test';
import { scenarios } from '../../server/scenarios';
import { demoResult } from '../../server/demo';
import { buildCatalog } from '../../server/brava/catalog';
import { buildVisualCatalog } from '../../server/visual/catalog';
import { providers } from '../../shared/types';
import type { BravaView, Run, Series, SeriesSnapshot } from '../../shared/types';

const now = new Date('2026-10-09T12:00:00Z');
const iso = now.toISOString();
const tariff = { date: '2026-10-09' };

async function deadline(page: Page, seconds: number) {
  return page.evaluate((s) => new Date(Date.now() + s * 1000).toISOString(), seconds);
}

// Only browser fixtures: no requests to a provider and no changes to stored executions.
async function show(page: Page, kind: 'series' | 'brava', snapshot: SeriesSnapshot | BravaView) {
  const id = 'series' in snapshot ? snapshot.series.id : snapshot.id;
  await page.clock.install({ time: now });
  await page.clock.pauseAt(now);
  await page.addInitScript(
    ({ kind, id }) => {
      sessionStorage.setItem(kind, id);
      const streams = new Set<FixtureSource>();
      class FixtureSource {
        onopen: (() => void) | null = null;
        onmessage: ((event: { data: string }) => void) | null = null;
        constructor() {
          streams.add(this);
          queueMicrotask(() => this.onopen?.());
        }
        close() {
          streams.delete(this);
        }
      }
      Object.assign(window, {
        EventSource: FixtureSource,
        emitSnapshot(value: unknown) {
          for (const stream of streams) stream.onmessage?.({ data: JSON.stringify(value) });
        },
      });
    },
    { kind, id },
  );
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({
      json: path.endsWith(`/${id}`)
        ? snapshot
        : path === '/api/scenarios'
          ? scenarios
          : path === '/api/health'
            ? { keys: {}, models: {}, claude: { available: false, authenticated: false } }
            : [],
    });
  });
  const space =
    kind === 'series'
      ? 'maratona'
      : (snapshot as BravaView).kind === 'visual'
        ? 'imagens'
        : 'brava';
  await page.goto(`/#/${space}`);
  await expect(page.locator('.session-bar, .brava-live').first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole('button', { name: 'Modo gravação', exact: true }).click();
  await expect(page.locator('.app')).toHaveClass(/recording/);
}

async function send(page: Page, snapshot: SeriesSnapshot | BravaView) {
  await page.evaluate((value) => {
    (window as unknown as { emitSnapshot: (value: unknown) => void }).emitSnapshot(value);
  }, snapshot);
  await page.clock.runFor(100);
}

async function centered(page: Page) {
  const timer = page.getByRole('timer');
  await expect(timer).toHaveCount(1);
  await expect
    .poll(() =>
      timer.locator('.countdown-number').evaluate((el) => {
        const box = el.getBoundingClientRect();
        return Math.max(
          Math.abs(box.x + box.width / 2 - innerWidth / 2),
          Math.abs(box.y + box.height / 2 - innerHeight / 2),
        );
      }),
    )
    .toBeLessThanOrEqual(6);
}

function meetingFixture(): SeriesSnapshot {
  const run: Run = {
    id: 'countdown-run',
    seriesId: 'countdown-series',
    mode: 'demo',
    phase: 'ready',
    createdAt: iso,
    updatedAt: iso,
    scenario: structuredClone(scenarios[0]),
    scenarioHash: 'fixture',
    providers,
    autoplay: true,
    rounds: [],
    cliCalls: [],
    tariff,
    nextAdvanceAt: new Date(now.getTime() + 5000).toISOString(),
  };
  // Enough content to expose phase-driven scroll and browser scroll anchoring on desktop too.
  run.scenario.rounds[0].facts = 'Contexto sintético para conferir a posição da página. '.repeat(
    100,
  );
  const series: Series = {
    id: run.seriesId!,
    mode: 'demo',
    phase: 'running',
    createdAt: iso,
    updatedAt: iso,
    providers,
    scenarioIds: scenarios.map((s) => s.id),
    runIds: [run.id],
    cliCalls: [],
    tariff,
  };
  return { series, run };
}

for (const viewport of [
  { width: 1920, height: 1080 },
  { width: 390, height: 844 },
]) {
  test(`countdown follows each round without moving the page at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const snapshot = meetingFixture();
    const run = snapshot.run!;
    await show(page, 'series', snapshot);
    await expect(page.getByRole('timer')).toHaveText('5');
    await centered(page);
    const motion = await page.locator('.countdown-number').evaluate((el) => {
      const animation = el.getAnimations()[0];
      animation.pause();
      return [100, 800].map((time) => {
        animation.currentTime = time;
        const style = getComputedStyle(el);
        return { scale: new DOMMatrixReadOnly(style.transform).a, opacity: Number(style.opacity) };
      });
    });
    expect(motion[1].scale).toBeGreaterThan(motion[0].scale);
    expect(motion[1].opacity).toBeLessThan(motion[0].opacity);
    await page.clock.runFor(1000);
    await expect(page.getByRole('timer')).toHaveText('4');
    await page.clock.runFor(4000);
    await expect(page.getByRole('timer')).toHaveCount(0);

    await page.evaluate(() => scrollTo(0, 200));
    const frame = () =>
      page.locator('main').evaluate((el) => {
        const { x, width } = el.getBoundingClientRect();
        return { x, width, scrollY };
      });
    const initial = await frame();
    expect(initial.scrollY).toBe(200);
    run.rounds = [{ roundId: run.scenario.rounds[0].id, results: {} }];
    delete run.nextAdvanceAt;
    run.phase = 'evaluating';
    await send(page, snapshot);
    expect(await frame()).toEqual(initial);
    for (const p of providers)
      run.rounds[0].results[p] = demoResult(p, run, run.scenario.rounds[0], 0);
    run.phase = 'commenting';
    await send(page, snapshot);
    expect(await frame()).toEqual(initial);
    run.phase = 'ready';
    run.rounds[0].feedback = { winner: 'tie', text: 'Comentário sintético. '.repeat(100) };
    run.nextAdvanceAt = await deadline(page, 5);
    await send(page, snapshot);
    await expect(page.getByRole('timer', { name: /Próxima rodada/ })).toHaveText('5');
    expect(await frame()).toEqual(initial);
    await centered(page);
    // Capture the readable part of the pulse at the same instant on both viewports.
    await page.locator('.countdown-number').evaluate((el) => {
      const animation = el.getAnimations()[0];
      animation.pause();
      animation.currentTime = 350;
    });
    await page.screenshot({ path: `.impeccable/review/countdown-${viewport.width}.png` });

    // A new pause starts from the current clock, even after a long idle interval.
    await page.clock.runFor(60000);
    run.nextAdvanceAt = await deadline(page, 5);
    await send(page, snapshot);
    await expect(page.getByRole('timer')).toHaveText('5');
    run.phase = 'cancelled';
    snapshot.series.phase = 'cancelled';
    await send(page, snapshot);
    await expect(page.getByRole('timer')).toHaveCount(0);
    expect(await frame()).toEqual(initial);
  });
}

test('keeps only the footer countdown in the result dialog and resumes the overlay when closed', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const snapshot = meetingFixture();
  await show(page, 'series', snapshot);
  snapshot.run!.phase = 'complete';
  snapshot.run!.verdict = { winner: 'tie', summary: 'Resultado sintético.', passes: [] };
  snapshot.series.nextStartAt = await deadline(page, 8);
  await send(page, snapshot);
  await expect(page.getByRole('timer')).toHaveText('8');
  await page.getByRole('button', { name: 'Ver resultado', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('.verdict-next')).toHaveText('Próxima reunião em 8 s');
  await expect(page.locator('.countdown-overlay')).toHaveCount(0);
  await page.clock.runFor(1000);
  await expect(dialog.locator('.verdict-next')).toHaveText('Próxima reunião em 7 s');
  await expect(page.locator('.countdown-overlay')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Voltar à reunião' }).click();
  await expect(page.getByRole('timer')).toHaveText('7');
  await centered(page);
  expect(
    await page.locator('.countdown-number').evaluate((el) => getComputedStyle(el).animationName),
  ).toBe('none');
  await page.clock.runFor(7000);
  await expect(page.getByRole('timer')).toHaveCount(0);
});

for (const kind of ['brava', 'visual'] as const) {
  test(`uses the same countdown for ${kind} start, next battery and report, and hides it away from the round`, async ({
    page,
  }) => {
    const catalog =
      kind === 'visual' ? buildVisualCatalog('/nonexistent') : buildCatalog('/nonexistent');
    const brava: BravaView = {
      id: `countdown-${kind}`,
      kind,
      mode: 'demo',
      phase: 'preparing',
      createdAt: iso,
      updatedAt: iso,
      providers: kind === 'visual' ? ['decisions', 'clef'] : providers,
      catalogHash: catalog.hash,
      batteries: catalog.batteries,
      items: catalog.items,
      results: {},
      currentBattery: 0,
      comments: {},
      cliCalls: [],
      tariff,
      nextAt: new Date(now.getTime() + 5000).toISOString(),
    };
    await show(page, 'brava', brava);
    await expect(page.getByRole('timer', { name: /Começa/ })).toHaveText('5');
    await centered(page);
    await page.clock.runFor(5000);
    await expect(page.getByRole('timer')).toHaveCount(0);
    brava.phase = 'pause';
    brava.nextAt = await deadline(page, 5);
    await send(page, brava);
    await expect(page.getByRole('timer', { name: /Próxima bateria/ })).toHaveText('5');
    brava.currentBattery = brava.batteries.length - 1;
    await send(page, brava);
    await expect(page.getByRole('timer', { name: /Boletim/ })).toHaveText('5');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Histórico', exact: true }).click();
    await expect(page.getByRole('timer')).toHaveCount(0);
  });
}
