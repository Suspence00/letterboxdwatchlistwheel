import { test, expect } from '@playwright/test';
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
    await page.getByText('1 Spin Mode', { exact: true }).click();
}

async function importLargeList(page, count = 1001) {
    const csv = 'Date,Name,Year,Letterboxd URI\n' + Array.from({ length: count }, (_, i) =>
        `2025-10-20,Movie ${i},2000,https://letterboxd.com/film/test-${i}/`).join('\n');
    await page.locator('#csv-input').setInputFiles({ name: 'large.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await page.locator('#confirm-modal-confirm').click();
}

test('sample movies have textured 3D sleeves and accessible inspection', async ({ page }) => {
    await expect(page.locator('.vhs-tapes .vhs-tape')).toHaveCount(10);
    await expect(page.locator('.vhs-tapes .vhs-poster')).toHaveCount(10);
    await page.getByRole('button', { name: 'Inspect The Witch (2015)', exact: true }).click();
    await expect(page.locator('.vhs-inspector__title')).toHaveText('The Witch');
    await expect(page.locator('.vhs-inspector__detail')).toContainText('10.0% elimination risk');
    await page.locator('#vhs-edit').click();
    await expect(page.locator('#slice-editor-name')).toHaveText('The Witch');
});

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

test('a 1001-movie list draws ten unique tapes and keeps pins across redraws', async ({ page }) => {
    await importLargeList(page);
    await oneSpin(page);
    await expect(page.locator('#vhs-lineup-note')).toContainText('10 tapes from 1,001');
    const before = await page.locator('.vhs-tapes .vhs-tape').evaluateAll(tapes => tapes.map(tape => tape.dataset.movieId));
    expect(new Set(before).size).toBe(10);
    await page.locator('.vhs-tapes .vhs-tape').first().click();
    await page.locator('#vhs-pin').click();
    await page.locator('#vhs-shuffle').click();
    const after = await page.locator('.vhs-tapes .vhs-tape').evaluateAll(tapes => tapes.map(tape => tape.dataset.movieId));
    expect(after).toContain(before[0]);
    expect(after).not.toEqual(before);
    expect(new Set(after).size).toBe(10);
    const state = await page.evaluate(async () => {
        const { appState } = await import('/js/state.js');
        const { getSelectionOdds } = await import('/js/wheel.js');
        return { selected: appState.selectedIds.size, odds: [...getSelectionOdds().values()] };
    });
    expect(state.selected).toBe(1001);
    expect(state.odds).toHaveLength(10);
    expect(state.odds.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    await page.locator('#movie-search').fill('Movie 1000');
    await expect(page.locator('.vhs-tapes .vhs-tape')).toHaveCount(1);
    await expect(page.locator('#vhs-lineup-note')).toContainText('1 tape from 1 eligible');
});

test('large knockout reaches a VHS finale and records one champion', async ({ page }) => {
    test.setTimeout(45000);
    await importLargeList(page);
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
    expect(results).toEqual({ count: 1001, selected: 1001, champions: 1, history: 1 });
    await expect(page.locator('#result')).toContainText('Movie Knockout winner:');
    await page.locator('#win-modal-close').click();
    await expect(page.locator('.spin-theater')).toHaveCount(0);
    await expect(page.locator('#reshow-winner-btn')).toBeEnabled();
    await page.reload();
    await page.locator('#reshow-winner-btn').click();
    await expect(page.locator('#win-modal-details')).toContainText('Movie Knockout champion');
});

test('winner shows a static VHS cover clear of the movie details', async ({ page }) => {
    await oneSpin(page);
    await page.locator('#spin-button').click();
    const viewer = page.locator('#win-modal-tape-viewer .tape-viewer');
    await expect(viewer).toBeVisible();
    await expect(viewer.locator('.tape-viewer__poster')).toBeVisible();
    const poster = viewer.locator('.tape-viewer__poster');
    await expect(poster).toHaveCSS('object-fit', 'contain');
    const posterFits = await poster.evaluate(image => {
        const cover = image.parentElement;
        return image.offsetLeft === 0 && image.offsetTop === 0
            && image.offsetWidth <= cover.clientWidth
            && image.offsetHeight <= cover.clientHeight - 18;
    });
    expect(posterFits).toBe(true);
    await expect(viewer.locator('button')).toHaveCount(0);
    await expect(viewer).toHaveCSS('animation-name', 'none');
    const cover = await viewer.boundingBox();
    const details = await page.locator('.win-modal__meta').boundingBox();
    expect(cover.height).toBeLessThan(250);
    expect(cover.y + cover.height).toBeLessThanOrEqual(details.y);
    await page.locator('#win-modal-close').click();
    await expect(viewer).toHaveCount(0);
    await page.locator('#reshow-winner-btn').click();
    await expect(viewer).toBeVisible();
});

test('Returns wall handles quoted IDs and treats imported movie names as text', async ({ page }) => {
    await page.locator('#wheel-theater-btn').click();
    const name = '<img src=x onerror="window.unexpectedMovieMarkup = true">';
    await page.evaluate(async name => {
        const { addTapeToEliminationStack } = await import('/js/spin-theater.js');
        const movie = { id: 'quoted-"-movie', name, year: '2024' };
        addTapeToEliminationStack(movie, 1);
        addTapeToEliminationStack(movie, 1);
    }, name);
    await expect(page.locator('.vhs-stack-tape')).toHaveCount(1);
    await expect(page.locator('.vhs-stack-tape__fallback strong')).toHaveText(name);
    await expect(page.locator('.vhs-stack-tape__fallback img')).toHaveCount(0);
    expect(await page.evaluate(() => window.unexpectedMovieMarkup)).toBeUndefined();
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

test('Escape exits focus while a single spin stays locked until its reveal', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await oneSpin(page);
    await page.clock.install();
    await page.locator('#spin-button').click();
    await page.keyboard.press('Escape');
    await expect(page.locator('.spin-theater')).toHaveCount(0);
    await expect(page.locator('#spin-button')).toBeDisabled();
    await page.clock.runFor(18000);
    await expect(page.locator('#win-modal')).toBeVisible();
    const history = await page.evaluate(async () => (await import('/js/state.js')).appState.history.length);
    expect(history).toBe(1);
});

test('small screens fit the focused stage and missing posters keep readable labels', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.route('https://www.omdbapi.com/**', route => route.fulfill({ json: { Response: 'False' } }));
    await page.reload();
    await oneSpin(page);
    await expect(page.locator('.vhs-fallback strong').first()).toBeVisible();
    await page.locator('#spin-button').click();
    const bounds = await page.locator('.spin-theater .wheel-stage').boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
    expect(bounds.y + bounds.height).toBeLessThan(844);
    await expect(page.locator('#win-modal')).toBeVisible();
    await page.locator('#win-modal-close').click();
    await expect(page.locator('.spin-theater')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
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

test('supports selectable tape capacities up to 100 tapes and persists setting', async ({ page }) => {
    await importLargeList(page);
    await oneSpin(page);
    await page.locator('#settings-open').click();
    await page.locator('#settings-vhs-capacity').selectOption('50');
    await page.locator('#settings-modal-close').click();
    await expect(page.locator('.vhs-tapes .vhs-tape')).toHaveCount(50);
    await expect(page.locator('#vhs-lineup-note')).toContainText('50 tapes from 1,001');

    await page.locator('#settings-open').click();
    await page.locator('#settings-vhs-capacity').selectOption('100');
    await page.locator('#settings-modal-close').click();
    await expect(page.locator('.vhs-tapes .vhs-tape')).toHaveCount(100);
    await expect(page.locator('#vhs-lineup-note')).toContainText('100 tapes from 1,001');

    await page.reload();
    await oneSpin(page);
    await page.locator('#settings-open').click();
    await expect(page.locator('#settings-vhs-capacity')).toHaveValue('100');
    await page.locator('#settings-modal-close').click();
    await expect(page.locator('.vhs-tapes .vhs-tape')).toHaveCount(100);
});

test('theater mode remains completely stable with zero scrollbars or layout shift during spin', async ({ page }) => {
    await oneSpin(page);
    await page.locator('#spin-button').click();
    await expect(page.locator('.spin-theater')).toBeVisible();
    for (let frame = 0; frame < 5; frame += 1) {
        const scrollInfo = await page.evaluate(() => {
            const theater = document.querySelector('.spin-theater');
            if (!theater) return null;
            return {
                scrollTop: theater.scrollTop,
                hasOverflow: theater.scrollHeight > theater.clientHeight
            };
        });
        expect(scrollInfo.scrollTop).toBe(0);
        expect(scrollInfo.hasOverflow).toBe(false);
        await page.waitForTimeout(60);
    }
});

test('knockout elimination animation marks tape and reduces pool', async ({ page }) => {
    await expect(page.locator('.vhs-tapes .vhs-tape')).toHaveCount(10);
    await page.locator('#spin-button').click();
    await expect(page.locator('.spin-theater')).toBeVisible();
    await expect(page.locator('.spin-theater')).toHaveClass(/has-stack/);
    await expect(page.locator('#spin-theater-stack')).toBeVisible();
    await expect(page.locator('.vhs-tapes .vhs-tape')).toHaveCount(9, { timeout: 10000 });
    await expect(page.locator('.spin-theater__hint')).toContainText('9 tapes remaining');
    await expect(page.locator('#spin-theater-stack-count')).toHaveText('1');
    const wallTape = page.locator('#spin-theater-stack-list .vhs-stack-tape');
    await expect(wallTape).toHaveCount(1);
    await expect(wallTape.locator('.vhs-stack-tape__stamp')).toHaveText('ELIMINATED');
    await expect(wallTape.locator('.vhs-stack-tape__rental')).toContainText('VHS');
});

test('can enter and return to theater mode via theater toggle button', async ({ page }) => {
    const theaterBtn = page.locator('#wheel-theater-btn');
    await expect(theaterBtn).toBeVisible();
    await expect(theaterBtn).toContainText('Theater Mode');

    // Enter theater mode manually
    await theaterBtn.click();
    await expect(page.locator('.spin-theater')).toBeVisible();

    // Exit focus
    await page.locator('.spin-theater__exit').click();
    await expect(page.locator('.spin-theater')).toBeHidden();
    await expect(theaterBtn).toBeVisible();

    // Start spin in knockout mode, exit during game, check button state
    await page.locator('#spin-button').click();
    await expect(page.locator('.spin-theater')).toBeVisible();
    await page.locator('.spin-theater__exit').click();
    await expect(page.locator('.spin-theater')).toBeHidden();
    await expect(theaterBtn).toContainText('Return to Theater Mode');
    await expect(theaterBtn).toHaveClass(/is-active/);

    // Re-enter theater mode and verify it re-opens
    await theaterBtn.click();
    await expect(page.locator('.spin-theater')).toBeVisible();
    await expect(page.locator('#spin-theater-stack')).toBeVisible();
});

test('knockout elimination works smoothly with reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(page.locator('.vhs-tapes .vhs-tape')).toHaveCount(10);
    await page.locator('#spin-button').click();
    await expect(page.locator('.spin-theater')).toBeVisible();
    await expect(page.locator('#spin-theater-stack-count')).toHaveText('1', { timeout: 5000 });
    await expect(page.locator('#spin-theater-stack-list .vhs-stack-tape')).toHaveCount(1);
    await expect(page.locator('.spin-theater .vhs-flight-proxy')).toHaveCount(0);
});

test('vhs pointer flapper remains completely static and sits on top of wheel tapes', async ({ page }) => {
    const flapper = page.locator('.vhs-flapper');
    await expect(flapper).toBeVisible();
    const styleInfo = await flapper.evaluate(el => ({
        zIndex: window.getComputedStyle(el).zIndex,
        hasElevation: window.getComputedStyle(el).transform !== 'none'
    }));
    expect(styleInfo.zIndex).toBe('100');
    expect(styleInfo.hasElevation).toBe(true);

    await oneSpin(page);
    await page.locator('#spin-button').click();
    const animationCount = await flapper.evaluate(el => el.getAnimations().length);
    expect(animationCount).toBe(0);
});

test('can toggle bottom tape labels via settings checkbox', async ({ page }) => {
    // Initially rental labels are visible on tapes
    const firstRental = page.locator('.vhs-tapes .vhs-rental').first();
    await expect(firstRental).toBeVisible();

    // Open settings and verify checkbox is checked
    await page.click('#settings-open');
    const settingsCheckbox = page.locator('#settings-vhs-labels');
    await expect(settingsCheckbox).toBeVisible();
    await expect(settingsCheckbox).toBeChecked();

    // Toggle to hide labels
    await settingsCheckbox.uncheck();
    await expect(page.locator('body')).toHaveClass(/hide-tape-labels/);
    await expect(firstRental).toBeHidden();

    // Toggle back via settings checkbox
    await settingsCheckbox.check();
    await expect(page.locator('body')).not.toHaveClass(/hide-tape-labels/);
    await expect(firstRental).toBeVisible();

    // Uncheck and close modal
    await settingsCheckbox.uncheck();
    await page.click('#settings-modal-close');
    await expect(firstRental).toBeHidden();

    // Check persistence across reload
    await page.reload();
    await expect(page.locator('body')).toHaveClass(/hide-tape-labels/);
    await page.click('#settings-open');
    await expect(settingsCheckbox).not.toBeChecked();
    await page.click('#settings-modal-close');
});

