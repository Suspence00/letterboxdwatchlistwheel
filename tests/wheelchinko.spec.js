import { test, expect } from './fixtures.js';
import path from 'node:path';

const SAMPLE_CSV_PATH = path.resolve(process.cwd(), 'sample-watchlist.csv');

test.describe('Wheelchinko Mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.locator('#csv-input').setInputFiles(SAMPLE_CSV_PATH);
    await expect(page.locator('#movie-list li')).toHaveCount(10);
  });

  test('Switching boards cancels active drops in every Wheelchinko style', async ({ page }) => {
    await page.clock.install();
    await page.locator('.spin-mode-card').filter({ hasText: 'Wheelchinko' }).click();
    const boards = await page.evaluate(async () => {
      const state = await import('/js/state.js');
      const first = state.appState.activeWorkspaceId;
      const second = state.createWorkspace('Other board');
      state.switchWorkspace(second);
      state.appState.movies = [0, 1, 2].map(i => ({ id: `other-${i}`, name: `Other ${i}`, weight: 1, color: '#ff8600' }));
      state.appState.selectedIds = new Set(state.appState.movies.map(m => m.id));
      state.saveState();
      state.switchWorkspace(first);
      return { first, second };
    });
    for (const style of ['lineup', 'elimination', 'spinchinko']) {
      const dropping = await page.evaluate(async ({ boards, style }) => {
        const state = await import('/js/state.js');
        const ui = await import('/js/ui/wheelchinko-ui.js');
        const physics = await import('/js/wheelchinko.js');
        state.switchWorkspace(boards.first);
        ui.setWheelchinkoStyle(style);
        ui.triggerDrop();
        const started = physics.getIsDropping();
        state.switchWorkspace(boards.second);
        return { started, stillDropping: physics.getIsDropping(), rapid: ui.getIsRapidEliminating() };
      }, { boards, style });
      expect(dropping).toEqual({ started: true, stillDropping: false, rapid: false });
      await page.clock.fastForward(10000);
      await expect(page.locator('#win-modal')).toBeHidden();
      await expect(page.locator('#wheelchinko-drop-btn')).toBeEnabled();
      expect(await page.evaluate(async () => (await import('/js/state.js')).appState.history.length)).toBe(0);
      await page.locator('#wheelchinko-style-lineup').click();
      await page.locator('#wheelchinko-drop-btn').click();
      await page.clock.fastForward(8000);
      await expect(page.locator('#win-modal')).toBeVisible({ timeout: 15000 });
      await page.locator('#win-modal-close').click();
      await page.evaluate(async () => {
        const state = await import('/js/state.js');
        state.appState.history = [];
        state.saveState();
      });
    }
  });

  test('Stage rendering, style switching, tooltip hover, theater mode, and aimed/edge drops', async ({ page }) => {
    await page.locator('.spin-mode-card').filter({ hasText: 'Wheelchinko' }).click();

    await expect(page.locator('#wheelchinko-stage')).toBeVisible();
    await expect(page.locator('#wheelchinko-canvas')).toBeVisible();
    await expect(page.locator('#wheel')).toBeHidden();
    await expect(page.locator('#spin-button')).toHaveText('Drop Wheelchinko Puck');

    const slots = page.locator('#wheelchinko-slots .wheelchinko-slot');
    await expect(slots).toHaveCount(10);
    await expect(slots.first().locator('.wheelchinko-slot-num')).toHaveText('1');

    // Hover tooltip
    const tooltip = page.locator('#wheelchinko-tooltip');
    await expect(tooltip).toBeHidden();
    await slots.first().hover();
    await expect(tooltip).toBeVisible();
    await expect(tooltip.locator('.wheelchinko-tooltip-title')).not.toBeEmpty();
    await page.mouse.move(0, 0);
    await expect(tooltip).toBeHidden();

    // Theater mode
    await page.click('#wheelchinko-theater-btn');
    const theater = page.locator('.spin-theater.is-wheelchinko');
    await expect(theater).toBeVisible();
    await page.click('.spin-theater__exit');
    await expect(theater).toBeHidden();

    // Style switching
    await page.click('#wheelchinko-style-elimination');
    await expect(page.locator('#wheelchinko-tourney-status')).toBeVisible();
    await expect(page.locator('#wheelchinko-drop-btn')).toHaveText('Start Elimination');

    await page.click('#wheelchinko-style-spinchinko');
    await expect(page.locator('#wheelchinko-spinchinko-bar')).toBeVisible();
    await expect(page.locator('#wheelchinko-drop-btn')).toHaveText('Drop 10 Golden Pucks');

    await page.click('#wheelchinko-style-lineup');
    await expect(page.locator('#wheelchinko-style-lineup')).toHaveClass(/is-active/);

    // Far-left edge aim and drop
    const aimBar = page.locator('#wheelchinko-aim-bar');
    const box = await aimBar.boundingBox();
    if (box) await page.mouse.click(box.x + 2, box.y + box.height / 2);
    await page.click('#wheelchinko-drop-btn');
    await expect(page.locator('#win-modal')).toBeVisible({ timeout: 15000 });
    await page.click('#win-modal-close');
    await expect(page.locator('#history-list li')).toHaveCount(0); // modal closed, check via history button
    await page.click('#history-btn');
    await expect(page.locator('#history-list li')).toHaveCount(1);
  });

  test('Elimination Battle Royale scales up to 100 contenders, locks to 1 puck at Final 10, and crowns Final 2 survivor', async ({ page }) => {
    // 1. Verify 100-contender mega-wide layout & multi-puck elimination batch
    await page.evaluate(() => {
      const activeId = localStorage.getItem('letterboxd_active_workspace_id');
      const wsKey = `letterboxd_workspace_${activeId}`;
      const state = JSON.parse(localStorage.getItem(wsKey) || '{}');
      state.allMovies = [];
      state.selectedIds = [];
      for (let i = 1; i <= 100; i += 1) {
        const id = `mega-${i}`;
        state.allMovies.push({ id, name: `Contender ${i}`, year: 1980 + (i % 40), weight: 1, color: '#3b82f6' });
        state.selectedIds.push(id);
      }
      localStorage.setItem(wsKey, JSON.stringify(state));
    });
    await page.reload();

    await page.locator('.spin-mode-card').filter({ hasText: 'Wheelchinko' }).click();
    await page.click('#wheelchinko-style-elimination');

    const slotsContainer = page.locator('#wheelchinko-slots');
    await expect(slotsContainer).toHaveClass(/is-ultra-compact/);
    await expect(slotsContainer.locator('.wheelchinko-slot')).toHaveCount(100);
    await expect(page.locator('#wheelchinko-tourney-text')).toContainText('100 contenders on board');

    await page.click('.wheelchinko-puck-btn[data-count="5"]');
    await page.click('#wheelchinko-drop-btn');
    await expect(page.locator('#wheelchinko-drop-btn')).toHaveText('Stop Elimination');

    await expect(async () => {
      expect(await slotsContainer.locator('.wheelchinko-slot').count()).toBeLessThan(100);
    }).toPass({ timeout: 15000 });

    await page.click('#wheelchinko-drop-btn');
    await expect(page.locator('#wheelchinko-drop-btn')).toHaveText('Start Elimination');

    // Stop prevents the next batch; let in-flight pucks finish before editing contenders.
    await expect.poll(() => page.evaluate(async () =>
      (await import('/js/wheelchinko.js')).getIsDropping()
    )).toBe(false);

    // 2. Narrow to 2 movies to verify Final 10 single-puck lock, 10 interleaved slots, and champion resolution
    await page.click('#clear-selection');
    const checkboxes = page.locator('#movie-list input[type="checkbox"]');
    await checkboxes.nth(0).check();
    await checkboxes.nth(1).check();

    await expect(page.locator('#wheelchinko-puck-selector')).toHaveClass(/is-final-10/);
    await expect(page.locator('.wheelchinko-puck-btn[data-count="5"]')).toBeDisabled();
    await expect(slotsContainer.locator('.wheelchinko-slot')).toHaveCount(10);

    const movieIds = await slotsContainer.locator('.wheelchinko-slot').evaluateAll(els => els.map(el => el.dataset.movieId));
    expect(movieIds[0]).not.toEqual(movieIds[1]);
    expect(movieIds[0]).toEqual(movieIds[2]);

    await page.click('#wheelchinko-drop-btn');
    await expect(page.locator('#win-modal')).toBeVisible({ timeout: 25000 });
  });

  test('Spinchinko drops golden pucks, qualifies finalists, and spins 3D VHS wheel showdown', async ({ page }) => {
    await page.locator('.spin-mode-card').filter({ hasText: 'Wheelchinko' }).click();
    await page.click('#wheelchinko-style-spinchinko');

    await page.click('#wheelchinko-drop-btn');
    await expect(page.locator('.wheelchinko-slot.is-qualified')).toHaveCount(10, { timeout: 15000 });
    await expect(page.locator('#wheelchinko-drop-btn')).toHaveText(/Spin Knockout Wheel \(10 Finalists\)/);

    await page.click('#spinchinko-type-one-spin');
    await expect(page.locator('#wheelchinko-drop-btn')).toHaveText(/Spin Wheel \(10 Finalists\)/);
    await page.click('#wheelchinko-drop-btn');

    await expect(page.locator('.vhs-scene')).toBeVisible();
    await expect(page.locator('.vhs-tape')).toHaveCount(10);
    await expect(page.locator('#win-modal')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('#win-modal-tape-viewer')).toBeVisible();
  });

  test('Stacked pucks settle without timeout, HTML titles are escaped, slots auto-refresh, and boards isolate state', async ({ page }) => {
    await expect(page.locator('#workspace-select option')).toHaveCount(1);

    await page.click('#clear-selection');
    const checkboxes = page.locator('#movie-list input[type="checkbox"]');
    await checkboxes.nth(0).check();
    await checkboxes.nth(1).check();

    await page.locator('.spin-mode-card').filter({ hasText: 'Wheelchinko' }).click();
    await expect(page.locator('#wheelchinko-slots .wheelchinko-slot')).toHaveCount(2);

    // Add a custom movie with an XSS payload in its title
    const xssTitle = '<img src=x onerror="window.__xssTriggered=true">';
    await page.click('#open-custom-modal');
    await page.fill('#custom-entry-name', xssTitle);
    await page.click('#custom-entry-form button[type="submit"]');

    await expect(page.locator('#wheelchinko-slots .wheelchinko-slot')).toHaveCount(3);
    await page.locator('#wheelchinko-slots .wheelchinko-slot').last().hover();
    await expect(page.locator('#wheelchinko-tooltip .wheelchinko-tooltip-title')).toHaveText(xssTitle);
    expect(await page.evaluate(() => Boolean(window.__xssTriggered))).toBe(false);

    await page.click('#wheelchinko-style-elimination');

    // Stacked puck physics check + board state isolation
    const check = await page.evaluate(async () => {
      const { launchPuck, getIsDropping, getBoardWidth } = await import('./js/wheelchinko.js');
      const targetX = getBoardWidth() / 2;
      const t0 = performance.now();
      launchPuck(null, { speed: 1.5, count: 2, targets: [targetX, targetX] });
      await new Promise(r => {
        const id = setInterval(() => { if (!getIsDropping()) { clearInterval(id); r(); } }, 20);
      });
      const doubleDuration = performance.now() - t0;

      const { appState, addToHistory, saveState, createWorkspace, switchWorkspace } = await import('./js/state.js');
      const firstBoardId = appState.activeWorkspaceId;
      appState.preferences.boosterColors = { Alice: '#123456' };
      addToHistory(appState.movies[0], 'wheelchinko');
      saveState();

      const secondBoardId = createWorkspace('Second Board');
      switchWorkspace(secondBoardId);
      const secondBoardHistoryLen = appState.history.length;
      const secondBoardWinnerId = appState.winnerId;

      switchWorkspace(firstBoardId);
      return {
        doubleDuration,
        secondBoardHistoryLen,
        secondBoardWinnerId,
        restoredBoosterColor: appState.preferences.boosterColors?.Alice,
        firstBoardHistoryLen: appState.history.length
      };
    });

    expect(check.doubleDuration).toBeLessThan(6500);
    expect(check.secondBoardHistoryLen).toBe(0);
    expect(check.secondBoardWinnerId).toBeNull();
    expect(check.restoredBoosterColor).toBe('#123456');
    expect(check.firstBoardHistoryLen).toBe(1);
  });
});
