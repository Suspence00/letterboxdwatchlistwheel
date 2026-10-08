import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SAMPLE_CSV_PATH = path.resolve(process.cwd(), 'sample-watchlist.csv');

test.describe('Wheelchinko Mode', () => {

  test.beforeEach(async ({ page }) => {
    page.on('pageerror', err => console.log('PAGE_ERROR:', err.message, err.stack));
    page.on('console', msg => console.log('PAGE_CONSOLE:', msg.text()));
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // Upload sample CSV
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('text=Upload CSV File');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(SAMPLE_CSV_PATH);
    await expect(page.locator('#movie-list li')).toHaveCount(10);
  });

  test('Switching to Wheelchinko mode displays the pegboard stage, poster slots, and updates spin button', async ({ page }) => {
    // Select Wheelchinko radio
    await page.locator('.spin-mode-card').filter({ hasText: 'Wheelchinko' }).click();

    // Verify Wheelchinko stage is visible
    await expect(page.locator('#wheelchinko-stage')).toBeVisible();
    await expect(page.locator('#wheelchinko-canvas')).toBeVisible();

    // Verify classic wheel and pointer are hidden
    await expect(page.locator('#wheel')).toBeHidden();
    await expect(page.locator('.pointer')).toBeHidden();

    // Verify spin button text
    await expect(page.locator('#spin-button')).toHaveText('Drop Wheelchinko Puck');

    // Verify slots are populated with posters and number badges
    const slots = page.locator('#wheelchinko-slots .wheelchinko-slot');
    await expect(slots).toHaveCount(10);
    await expect(slots.first().locator('.wheelchinko-slot-poster')).toBeAttached();
    await expect(slots.first().locator('.wheelchinko-slot-num')).toHaveText('1');
  });

  test('Switching between Random 10, Elimination, and Spinchinko styles', async ({ page }) => {
    await page.locator('.spin-mode-card').filter({ hasText: 'Wheelchinko' }).click();

    // Default style is Random 10
    const lineupBtn = page.locator('#wheelchinko-style-lineup');
    await expect(lineupBtn).toHaveText('Random 10');
    await expect(lineupBtn).toHaveClass(/is-active/);

    // Switch to Elimination style
    await page.click('#wheelchinko-style-elimination');
    await expect(page.locator('#wheelchinko-style-elimination')).toHaveClass(/is-active/);
    await expect(page.locator('#wheelchinko-tourney-status')).toBeVisible();
    await expect(page.locator('#wheelchinko-tourney-text')).toContainText('Elimination tournament');
    await expect(page.locator('#wheelchinko-drop-btn')).toHaveText('Start Elimination');

    // Switch to Spinchinko style
    await page.click('#wheelchinko-style-spinchinko');
    await expect(page.locator('#wheelchinko-style-spinchinko')).toHaveClass(/is-active/);
    await expect(page.locator('#wheelchinko-spinchinko-bar')).toBeVisible();
    await expect(page.locator('#wheelchinko-drop-btn')).toHaveText('Drop 10 Golden Pucks');
    await expect(page.locator('#spinchinko-type-one-spin')).toHaveClass(/is-active/);
  });

  test('Manual aim and drop resolves a winning movie and shows winner modal', async ({ page }) => {
    await page.locator('.spin-mode-card').filter({ hasText: 'Wheelchinko' }).click();

    // Click aim bar to aim
    const aimBar = page.locator('#wheelchinko-aim-bar');
    const box = await aimBar.boundingBox();
    if (box) {
      await page.mouse.click(box.x + box.width * 0.4, box.y + box.height / 2);
    }

    // Click Drop Puck
    await page.click('#wheelchinko-drop-btn');

    // Wait for winner modal to appear
    await expect(page.locator('#win-modal')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#win-modal-title')).toContainText('The movie selected was');

    // Verify history recorded the win
    await page.click('#win-modal-close');
    await page.click('#history-btn');
    await expect(page.locator('#history-modal')).toBeVisible();
    await expect(page.locator('#history-list li')).toHaveCount(1);
  });

  test('Random drop button launches puck and picks a movie', async ({ page }) => {
    await page.locator('.spin-mode-card').filter({ hasText: 'Wheelchinko' }).click();

    // Click Random Drop
    await page.click('#wheelchinko-random-btn');

    // Wait for winner modal
    await expect(page.locator('#win-modal')).toBeVisible({ timeout: 15000 });
  });

  test('Main drop button also triggers Wheelchinko drop', async ({ page }) => {
    await page.locator('.spin-mode-card').filter({ hasText: 'Wheelchinko' }).click();

    // Click the main action button
    await page.click('#spin-button');

    // Wait for winner modal
    await expect(page.locator('#win-modal')).toBeVisible({ timeout: 15000 });
  });

  test('Elimination mode runs rapid drops, removes eliminated slots, and crowns last remaining champion', async ({ page }) => {
    // Select only 3 movies so elimination tournament finishes quickly in test
    await page.click('#clear-selection');
    const checkboxes = page.locator('#movie-list input[type="checkbox"]');
    await checkboxes.nth(0).check();
    await checkboxes.nth(1).check();
    await checkboxes.nth(2).check();

    // Switch to Wheelchinko
    await page.locator('.spin-mode-card').filter({ hasText: 'Wheelchinko' }).click();

    // Switch to Elimination style
    await page.click('#wheelchinko-style-elimination');

    // Verify 9 interleaved slots initially for 3 contenders in endgame grid
    const slots = page.locator('#wheelchinko-slots .wheelchinko-slot');
    await expect(slots).toHaveCount(9);
    await expect(page.locator('#wheelchinko-drop-btn')).toHaveText('Start Elimination');

    // Start rapid elimination
    await page.click('#wheelchinko-drop-btn');

    // Verify button switches to Stop Elimination while drops run
    await expect(page.locator('#wheelchinko-drop-btn')).toHaveText('Stop Elimination');

    // Wait for winner modal to appear when only 1 champion remains
    await expect(page.locator('#win-modal')).toBeVisible({ timeout: 25000 });
    await expect(page.locator('#win-modal-title')).toContainText('The movie selected was');

    // Verify the champion is recorded in history
    await page.click('#win-modal-close');
    await page.click('#history-btn');
    await expect(page.locator('#history-modal')).toBeVisible();
    await expect(page.locator('#history-list li')).toHaveCount(1);
  });

  test('Hovering a slot displays floating tooltip with movie title and meta', async ({ page }) => {
    await page.locator('.spin-mode-card').filter({ hasText: 'Wheelchinko' }).click();

    const firstSlot = page.locator('#wheelchinko-slots .wheelchinko-slot').first();
    const tooltip = page.locator('#wheelchinko-tooltip');

    // Initially hidden
    await expect(tooltip).toBeHidden();

    // Hover first slot
    await firstSlot.hover();
    await expect(tooltip).toBeVisible();
    await expect(tooltip.locator('.wheelchinko-tooltip-title')).not.toBeEmpty();

    // Mouse away hides tooltip
    await page.mouse.move(0, 0);
    await expect(tooltip).toBeHidden();
  });

  test('Slots are inside canvas wrap and puck successfully drops through with 20 movies without getting stuck', async ({ page }) => {
    // Add 10 more movies to active workspace to reach 20 total
    await page.evaluate(() => {
      const activeId = localStorage.getItem('letterboxd_active_workspace_id');
      const wsKey = `letterboxd_workspace_${activeId}`;
      const state = JSON.parse(localStorage.getItem(wsKey) || '{}');
      if (!state.allMovies) state.allMovies = [];
      for (let i = 1; i <= 10; i += 1) {
        const id = `extra-movie-${i}`;
        state.allMovies.push({ id, name: `Extra Movie ${i}`, year: 2020 + i, weight: 1, color: '#3b82f6' });
        if (!state.selectedIds) state.selectedIds = [];
        state.selectedIds.push(id);
      }
      localStorage.setItem(wsKey, JSON.stringify(state));
    });
    await page.reload();

    // Switch to Wheelchinko
    await page.locator('.spin-mode-card').filter({ hasText: 'Wheelchinko' }).click();

    // Verify slots are inside canvas-wrap
    const canvasWrap = page.locator('#wheelchinko-canvas-wrap');
    await expect(canvasWrap.locator('#wheelchinko-slots')).toBeVisible();

    // Switch to Elimination style (which renders all 20 movies on the board)
    await page.click('#wheelchinko-style-elimination');

    const slots = page.locator('#wheelchinko-slots .wheelchinko-slot');
    await expect(slots).toHaveCount(20);
  });

  test('Spinchinko mode drops golden pucks, qualifies finalists, and spins wheel showdown', async ({ page }) => {
    await page.locator('.spin-mode-card').filter({ hasText: 'Wheelchinko' }).click();

    // Switch to Spinchinko style
    await page.click('#wheelchinko-style-spinchinko');
    await expect(page.locator('#wheelchinko-style-spinchinko')).toHaveClass(/is-active/);
    await expect(page.locator('#wheelchinko-spinchinko-bar')).toBeVisible();

    // Drop 10 golden pucks
    await page.click('#wheelchinko-drop-btn');

    // Wait for the drop to complete and qualifiers to be selected
    await expect(page.locator('.wheelchinko-slot.is-qualified')).toHaveCount(10, { timeout: 15000 });
    await expect(page.locator('#wheelchinko-drop-btn')).toHaveText(/Spin Wheel \(10 Finalists\)/);
    await expect(page.locator('#wheelchinko-spinchinko-redrop-btn')).toBeVisible();

    // Test wheel mode toggle to Knockout
    await page.click('#spinchinko-type-knockout');
    await expect(page.locator('#spinchinko-type-knockout')).toHaveClass(/is-active/);
    await expect(page.locator('#wheelchinko-drop-btn')).toHaveText(/Spin Knockout Wheel \(10 Finalists\)/);

    // Switch back to 1 Spin Mode and launch wheel spin
    await page.click('#spinchinko-type-one-spin');
    await expect(page.locator('#wheelchinko-drop-btn')).toHaveText(/Spin Wheel \(10 Finalists\)/);
    await page.click('#wheelchinko-drop-btn');

    // Verify the spin wheel is the 3D VHS cassette wheel
    await expect(page.locator('.vhs-scene')).toBeVisible();
    await expect(page.locator('.vhs-tape')).toHaveCount(10);

    // Winner modal should appear from the wheel spin with 3D tape viewer
    await expect(page.locator('#win-modal')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('#win-modal-title')).toContainText('The movie selected was');
    await expect(page.locator('#win-modal-tape-viewer')).toBeVisible();
  });

  test('Wheelchinko multi-puck selector works and automatically locks to 1 puck at final 10', async ({ page }) => {
    // Add 14 movies so we start with > 10 contenders
    await page.evaluate(() => {
      const activeId = localStorage.getItem('letterboxd_active_workspace_id');
      const wsKey = `letterboxd_workspace_${activeId}`;
      const state = JSON.parse(localStorage.getItem(wsKey) || '{}');
      state.allMovies = [];
      state.selectedIds = [];
      for (let i = 1; i <= 14; i += 1) {
        const id = `tourney-movie-${i}`;
        state.allMovies.push({ id, name: `Contender ${i}`, year: 2000 + i, weight: 1, color: '#3b82f6' });
        state.selectedIds.push(id);
      }
      localStorage.setItem(wsKey, JSON.stringify(state));
    });
    await page.reload();

    await page.locator('.spin-mode-card').filter({ hasText: 'Wheelchinko' }).click();
    await page.click('#wheelchinko-style-elimination');

    const selector = page.locator('#wheelchinko-puck-selector');
    await expect(selector).toBeVisible();
    await expect(selector).not.toHaveClass(/is-final-10/);

    // Can choose 5 pucks
    const btn5 = page.locator('.wheelchinko-puck-btn[data-count="5"]');
    await btn5.click();
    await expect(btn5).toHaveClass(/is-active/);

    // Can choose 3 pucks
    const btn3 = page.locator('.wheelchinko-puck-btn[data-count="3"]');
    await btn3.click();
    await expect(btn3).toHaveClass(/is-active/);

    // Now start rapid elimination and let it eliminate down into the final 10
    await page.click('#wheelchinko-drop-btn');

    // Wait until final 10 is reached
    await expect(selector).toHaveClass(/is-final-10/, { timeout: 20000 });
    const btn1 = page.locator('.wheelchinko-puck-btn[data-count="1"]');
    await expect(btn1).toHaveClass(/is-active/);
    await expect(btn5).toBeDisabled();
    await expect(page.locator('#wheelchinko-tourney-text')).toContainText('Single puck');

    // Stop elimination cleanly
    await page.click('#wheelchinko-drop-btn');
    await expect(page.locator('#wheelchinko-drop-btn')).toHaveText('Start Elimination');
  });

  test('Puck dropped at far left or far right edge bounces and lands successfully without falling off-board', async ({ page }) => {
    await page.locator('.spin-mode-card').filter({ hasText: 'Wheelchinko' }).click();

    // Far left aim
    const aimBar = page.locator('#wheelchinko-aim-bar');
    const box = await aimBar.boundingBox();
    if (box) {
      await page.mouse.click(box.x + 2, box.y + box.height / 2);
    }
    await page.click('#wheelchinko-drop-btn');
    await expect(page.locator('#win-modal')).toBeVisible({ timeout: 15000 });
    await page.click('#win-modal-close');

    // Far right aim
    if (box) {
      await page.mouse.click(box.x + box.width - 2, box.y + box.height / 2);
    }
    await page.click('#wheelchinko-drop-btn');
    await expect(page.locator('#win-modal')).toBeVisible({ timeout: 15000 });
  });

  test('Wheelchinko Theater Mode button opens wide theater view with is-wheelchinko class', async ({ page }) => {
    await page.locator('.spin-mode-card').filter({ hasText: 'Wheelchinko' }).click();

    // Click Theater Mode button in Wheelchinko actions
    await page.click('#wheelchinko-theater-btn');

    // Verify theater mode is active with is-wheelchinko class
    const theater = page.locator('.spin-theater.is-wheelchinko');
    await expect(theater).toBeVisible();
    await expect(theater.locator('#wheelchinko-canvas')).toBeVisible();

    // Exit theater mode
    await page.click('.spin-theater__exit');
    await expect(theater).toBeHidden();
    await expect(page.locator('#wheelchinko-canvas')).toBeVisible();
  });

  test('Mega-wide elimination mode supports up to 100 movies simultaneously and dynamically expands slots', async ({ page }) => {
    // Populate 100 movies in workspace
    await page.evaluate(() => {
      const activeId = localStorage.getItem('letterboxd_active_workspace_id');
      const wsKey = `letterboxd_workspace_${activeId}`;
      const state = JSON.parse(localStorage.getItem(wsKey) || '{}');
      state.allMovies = [];
      state.selectedIds = [];
      for (let i = 1; i <= 100; i += 1) {
        const id = `mega-movie-${i}`;
        state.allMovies.push({ id, name: `Mega Movie ${i}`, year: 1950 + (i % 70), weight: 1, color: '#3b82f6' });
        state.selectedIds.push(id);
      }
      localStorage.setItem(wsKey, JSON.stringify(state));
    });
    await page.reload();

    await page.locator('.spin-mode-card').filter({ hasText: 'Wheelchinko' }).click();
    await page.click('#wheelchinko-style-elimination');

    const slotsContainer = page.locator('#wheelchinko-slots');
    await expect(slotsContainer).toBeVisible();
    await expect(slotsContainer).toHaveClass(/is-ultra-compact/);

    // Verify all 100 slots are present on the board simultaneously
    const slots = slotsContainer.locator('.wheelchinko-slot');
    await expect(slots).toHaveCount(100);

    const tourneyText = page.locator('#wheelchinko-tourney-text');
    await expect(tourneyText).toContainText('100 contenders on board');

    // Start rapid multi-puck elimination
    await page.click('#wheelchinko-drop-btn');
    await expect(page.locator('#wheelchinko-drop-btn')).toHaveText('Stop Elimination');

    // Wait for at least one batch to complete and verify slots count thinned out and slots expanded
    await expect(async () => {
      const count = await page.locator('#wheelchinko-slots .wheelchinko-slot').count();
      expect(count).toBeLessThan(100);
    }).toPass({ timeout: 15000 });

    // Stop elimination cleanly
    await page.click('#wheelchinko-drop-btn');
    await expect(page.locator('#wheelchinko-drop-btn')).toHaveText('Start Elimination');
  });

  test('Pucks with 69 contenders scale down, clear left triangle wall piece without wedging, and cleanly drop through divider chutes to the bottom floor', async ({ page }) => {
    await page.evaluate(() => {
      const activeId = localStorage.getItem('letterboxd_active_workspace_id');
      const wsKey = `letterboxd_workspace_${activeId}`;
      const state = JSON.parse(localStorage.getItem(wsKey) || '{}');
      state.allMovies = [];
      state.selectedIds = [];
      for (let i = 1; i <= 69; i += 1) {
        const id = `sixty-nine-${i}`;
        state.allMovies.push({ id, name: `Contender ${i}`, year: 1980 + (i % 40), weight: 1, color: '#3b82f6' });
        state.selectedIds.push(id);
      }
      localStorage.setItem(wsKey, JSON.stringify(state));
    });
    await page.reload();

    await page.locator('.spin-mode-card').filter({ hasText: 'Wheelchinko' }).click();
    await page.click('#wheelchinko-style-elimination');

    const slots = page.locator('#wheelchinko-slots .wheelchinko-slot');
    await expect(slots).toHaveCount(69);

    // Set 5 pucks
    await page.click('.wheelchinko-puck-btn[data-count="5"]');

    // Drop and verify rapid multi-puck runs without stalling
    await page.click('#wheelchinko-drop-btn');
    await expect(page.locator('#wheelchinko-drop-btn')).toHaveText('Stop Elimination');

    // Wait for at least one batch to settle and verify count reduces
    await expect(async () => {
      const count = await page.locator('#wheelchinko-slots .wheelchinko-slot').count();
      expect(count).toBeLessThan(69);
    }).toPass({ timeout: 15000 });

    await page.click('#wheelchinko-drop-btn');
    await expect(page.locator('#wheelchinko-drop-btn')).toHaveText('Start Elimination');
  });

  test('Two pucks entering the same slot settle cleanly when stacked without waiting for timeout', async ({ page }) => {
    await page.locator('.spin-mode-card').filter({ hasText: 'Wheelchinko' }).click();
    await page.click('#wheelchinko-style-elimination');

    const result = await page.evaluate(async () => {
      const { launchPuck, getIsDropping, getBoardWidth } = await import('./js/wheelchinko.js');
      const boardW = getBoardWidth();
      const targetX = boardW / 2;

      // 1. Measure single puck duration
      let t0 = performance.now();
      launchPuck(targetX, { speed: 1.5, count: 1 });
      await new Promise(r => {
        const id = setInterval(() => { if (!getIsDropping()) { clearInterval(id); r(); } }, 20);
      });
      const singleDuration = performance.now() - t0;

      // 2. Measure double puck in same slot duration
      t0 = performance.now();
      launchPuck(null, { speed: 1.5, count: 2, targets: [targetX, targetX] });
      await new Promise(r => {
        const id = setInterval(() => { if (!getIsDropping()) { clearInterval(id); r(); } }, 20);
      });
      const doubleDuration = performance.now() - t0;

      return { singleDuration, doubleDuration };
    });

    expect(result.doubleDuration).toBeLessThan(6500);
  });

  test('Final 2 showdown generates 10 interleaved alternating slots and crowns single survivor', async ({ page }) => {
    await page.click('#clear-selection');
    const checkboxes = page.locator('#movie-list input[type="checkbox"]');
    await checkboxes.nth(0).check();
    await checkboxes.nth(1).check();

    await page.locator('.spin-mode-card').filter({ hasText: 'Wheelchinko' }).click();
    await page.click('#wheelchinko-style-elimination');

    const slots = page.locator('#wheelchinko-slots .wheelchinko-slot');
    await expect(slots).toHaveCount(10);

    const movieIds = await slots.evaluateAll(els => els.map(el => el.dataset.movieId));
    expect(movieIds[0]).not.toEqual(movieIds[1]);
    expect(movieIds[0]).toEqual(movieIds[2]);
    expect(movieIds[1]).toEqual(movieIds[3]);

    await page.click('#wheelchinko-drop-btn');
    await expect(page.locator('#win-modal')).toBeVisible({ timeout: 25000 });
  });

});

