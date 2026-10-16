import { test, expect } from './fixtures.js';
import path from 'node:path';

const sample = path.resolve('sample-watchlist.csv');
const tinyPoster = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7S8AAAAASUVORK5CYII=', 'base64');

test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.route('https://www.omdbapi.com/**', route => route.fulfill({
        json: { Response: 'True', Poster: 'https://posters.test/cover.png', Runtime: '100 min', Plot: 'Test synopsis' }
    }));
    await page.route('https://posters.test/**', route => route.fulfill({ contentType: 'image/png', body: tinyPoster }));
    await page.goto('/');
    await page.locator('#csv-input').setInputFiles(sample);
});

async function oneSpin(page) {
    await page.locator('.spin-mode-card').filter({ hasText: '1 Spin Mode' }).click();
}

async function importLargeList(page, count = 1001) {
    const csv = 'Date,Name,Year,Letterboxd URI\n' + Array.from({ length: count }, (_, i) =>
        `2025-10-20,Movie ${i},2000,https://letterboxd.com/film/test-${i}/`).join('\n');
    await page.locator('#csv-input').setInputFiles({ name: 'large.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await page.locator('#confirm-modal-confirm').click();
}

test('spin focuses the wheel, matches the pointer to the winner, and restores the page', async ({ page }) => {
    await oneSpin(page);
    await page.locator('#spin-button').scrollIntoViewIfNeeded();
    const scroll = await page.evaluate(() => window.scrollY);
    const expanded = await page.locator('#selection-toggle').getAttribute('aria-expanded');
    await page.locator('#spin-button').click();
    await expect(page.locator('.spin-theater .wheel-stage')).toBeVisible();
    await expect(page.locator('main')).toHaveJSProperty('inert', true);
    await expect(page.locator('#spin-button')).toBeDisabled();
    await expect(page.locator('#win-modal')).toBeVisible();
    const landing = await page.evaluate(async () => {
        const { appState } = await import('/js/state.js');
        const winner = document.querySelector('.vhs-tapes .is-winner');
        const rotation = Number(document.querySelector('.vhs-rotor').style.transform.match(/rotateZ\((.*)rad\)/)[1]);
        const tapeAngle = parseFloat(winner.style.getPropertyValue('--tape-angle'));
        return { id: winner.dataset.movieId, history: appState.history[0].movieId, count: appState.history.length,
            offset: Math.abs(Math.sin(rotation + tapeAngle)) };
    });
    expect(landing.count).toBe(1);
    expect(landing.id).toBe(landing.history);
    // CSS serializes large angles with limited precision; allow less than a tenth of a degree.
    expect(landing.offset).toBeLessThan(0.001);
    await expect(page.locator('.spin-theater')).toHaveJSProperty('inert', true);
    await page.locator('#win-modal-close').click();
    await expect(page.locator('.spin-theater')).toHaveCount(0);
    await expect(page.locator('.wheel-layout > .wheel-stage')).toBeVisible();
    await expect(page.locator('main')).toHaveJSProperty('inert', false);
    await expect(page.locator('#spin-button')).toBeFocused();
    await expect(page.locator('#selection-toggle')).toHaveAttribute('aria-expanded', expanded);
    expect(Math.abs(await page.evaluate(() => window.scrollY) - scroll)).toBeLessThan(4);
});

test('a 1001-movie list draws unique tapes and keeps pins across redraws', async ({ page }) => {
    await importLargeList(page);
    await oneSpin(page);
    await expect(page.locator('#vhs-lineup-note')).toContainText('250 tapes from 1,001');
    const before = await page.locator('.vhs-tapes .vhs-tape').evaluateAll(tapes => tapes.map(tape => tape.dataset.movieId));
    expect(new Set(before).size).toBe(250);
    await page.locator('.vhs-tapes .vhs-tape').first().click();
    await page.locator('#vhs-pin').click();
    await page.locator('#vhs-shuffle').click();
    const after = await page.locator('.vhs-tapes .vhs-tape').evaluateAll(tapes => tapes.map(tape => tape.dataset.movieId));
    expect(after).toContain(before[0]);
    expect(after).not.toEqual(before);
    expect(new Set(after).size).toBe(250);
    const state = await page.evaluate(async () => {
        const { appState } = await import('/js/state.js');
        const { getSelectionOdds } = await import('/js/wheel.js');
        return { selected: appState.selectedIds.size, odds: [...getSelectionOdds().values()] };
    });
    expect(state.selected).toBe(1001);
    expect(state.odds).toHaveLength(250);
    expect(state.odds.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    await page.locator('#movie-search').fill('Movie 1000');
    await expect(page.locator('.vhs-tapes .vhs-tape')).toHaveCount(1);
    await expect(page.locator('#vhs-lineup-note')).toContainText('1 tape from 1 eligible');
});

test('large knockout reaches a VHS finale and records one champion', async ({ page }) => {
    await importLargeList(page, 31);
    await page.locator('#settings-open').click();
    await page.locator('#settings-vhs-capacity').selectOption('10');
    await page.locator('#settings-modal-close').click();
    await expect(page.locator('.vhs-scene')).toBeHidden();
    await page.locator('#spin-button').click();
    await expect(page.locator('.spin-theater .vhs-scene')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#win-modal')).toBeVisible({ timeout: 30000 });
    const results = await page.evaluate(async () => {
        const { appState } = await import('/js/state.js');
        return { count: appState.knockoutResults.size, selected: appState.selectedIds.size,
            champions: [...appState.knockoutResults.values()].filter(result => result.status === 'champion').length,
            history: appState.history.length };
    });
    expect(results).toEqual({ count: 31, selected: 31, champions: 1, history: 1 });
    await expect(page.locator('#result')).toContainText('Movie Knockout winner:');
    await page.locator('#win-modal-close').click();
    await expect(page.locator('.spin-theater')).toHaveCount(0);
    await expect(page.locator('#reshow-winner-btn')).toBeEnabled();
    await page.reload();
    await page.locator('#reshow-winner-btn').click();
    await expect(page.locator('#win-modal-details')).toContainText('Movie Knockout champion');
});

test('classic spin lands on the weighted choice and preserves the saved style', async ({ page }) => {
    await oneSpin(page);
    await page.locator('#settings-open').click();
    await page.locator('#wheel-style').selectOption('classic');
    await page.locator('#settings-modal-close').click();
    await page.locator('.movie-weight__select').first().selectOption('5');
    await page.evaluate(() => { Math.random = () => 0.26; });
    await page.locator('#spin-button').click();
    await expect(page.locator('#win-modal-title')).toHaveText('The movie selected was The Witch!');
    await page.locator('#win-modal-close').click();
    await expect(page.locator('.spin-theater')).toHaveCount(0);
    await page.reload();
    await page.locator('#settings-open').click();
    await expect(page.locator('#wheel-style')).toHaveValue('classic');
    await page.locator('#settings-modal-close').click();
    await expect(page.locator('#wheel')).toBeVisible();
    await expect(page.locator('.vhs-scene')).toBeHidden();
});

test('Random Boost restores all weights and adds exactly one boost', async ({ page }) => {
    await page.locator('.movie-weight__select').first().selectOption('3');
    const before = await page.evaluate(async () => (await import('/js/state.js')).appState.movies.map(movie => movie.weight));
    await page.locator('#random-boost-btn').click();
    await page.locator('#input-modal-field').fill('Test viewer');
    await page.locator('#input-modal-submit').click();
    await expect(page.locator('#win-modal')).toBeVisible();
    const after = await page.evaluate(async () => {
        const { appState } = await import('/js/state.js');
        return { weights: appState.movies.map(movie => movie.weight), history: appState.history.length,
            boosters: appState.movies.flatMap(movie => movie.boosters || []) };
    });
    expect(after.weights.reduce((a, b) => a + b, 0) - before.reduce((a, b) => a + b, 0)).toBe(1);
    expect(after.history).toBe(1);
    expect(after.boosters).toHaveLength(1);
    expect(after.boosters[0].name).toBe('Test viewer');
});

test('mobile winner dialog with poster fits within viewport and has reachable close button', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await oneSpin(page);
    await page.locator('#spin-button').click();
    await expect(page.locator('#win-modal')).toBeVisible();
    await expect(page.locator('#win-modal-close')).toBeVisible();
    const closeBounds = await page.locator('#win-modal-close').boundingBox();
    expect(closeBounds.y).toBeGreaterThanOrEqual(0);
    expect(closeBounds.y + closeBounds.height).toBeLessThanOrEqual(844);
    expect(closeBounds.x).toBeGreaterThanOrEqual(0);
    expect(closeBounds.x + closeBounds.width).toBeLessThanOrEqual(390);
    const contentBounds = await page.locator('#win-modal .win-modal__content').boundingBox();
    expect(contentBounds.height).toBeLessThanOrEqual(844);
    await page.locator('#win-modal-close').click();
    await expect(page.locator('#win-modal')).toBeHidden();
});
