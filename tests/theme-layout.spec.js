import { test, expect } from './fixtures.js';
import path from 'node:path';

test('Theme picker supports keyboard navigation, decorations toggle, and backup sync', async ({ page }) => {
    await page.goto('/');
    await page.click('#settings-open');
    await page.locator('.theme-picker__summary').click();

    const firstCard = page.locator('.theme-card[data-theme="default"]');
    await firstCard.focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('body')).toHaveClass(/theme-fantasy/);
    await expect(page.locator('.theme-card[data-theme="fantasy"]')).toHaveAttribute('aria-checked', 'true');

    // Toggle decorations
    const decorToggle = page.locator('#decorations-toggle');
    await expect(decorToggle).toBeChecked();
    await decorToggle.uncheck();
    await expect(page.locator('body')).toHaveClass(/decorations-disabled/);
    await page.reload();
    await page.click('#settings-open');
    await expect(page.locator('#decorations-toggle')).not.toBeChecked();
    await expect(page.locator('body')).toHaveClass(/decorations-disabled/);

    // Restore backup with modern theme
    await page.click('#tab-btn-data');
    const backup = {
        version: 1,
        movies: [{
            id: 'm1',
            name: 'Alien',
            year: '1979',
            weight: 1,
            color: '#ff8600'
        }],
        preferences: { theme: 'modern', decorationsEnabled: true }
    };
    await page.fill('#backup-text', JSON.stringify(backup));
    await page.click('#backup-restore');
    await expect(page.locator('body')).toHaveClass(/theme-modern/);
    await page.click('#tab-btn-options');
    await expect(page.locator('.theme-card[data-theme="modern"]')).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('.theme-picker__current-name')).toHaveText('Modern');
    await expect(page.locator('body')).not.toHaveClass(/decorations-disabled/);
});

test('Theme browser stays compact, filters results, and persists the selected theme', async ({ page }, testInfo) => {
    await page.goto('/');
    await page.click('#settings-open');
    const summary = page.locator('.theme-picker__summary');
    const gallery = page.getByRole('radiogroup', { name: 'Visual theme' });
    await expect(gallery).not.toBeVisible();
    await expect(page.locator('#theme-select')).not.toBeVisible();
    expect((await page.locator('#theme-picker').boundingBox()).height).toBeLessThan(100);
    await page.screenshot({ animations: 'disabled', path: testInfo.outputPath('theme-picker-collapsed.png') });
    await summary.click();
    await expect(gallery.getByRole('radio')).toHaveCount(16);
    expect((await gallery.boundingBox()).height).toBeLessThanOrEqual(290);
    await page.screenshot({ animations: 'disabled', path: testInfo.outputPath('theme-picker-desktop.png') });

    await page.getByRole('button', { name: 'Seasonal', exact: true }).click();
    await expect(gallery.getByRole('radio')).toHaveCount(7);
    await page.getByRole('searchbox', { name: 'Search themes' }).fill('birthday');
    await expect(gallery.getByRole('radio')).toHaveCount(1);
    const birthday = gallery.getByRole('radio', { name: 'Birthday Party' });
    await birthday.focus();
    await page.keyboard.press('ArrowRight');
    await expect(birthday).toBeFocused();
    await expect(birthday).toBeChecked();
    await expect(page.locator('.theme-picker__current-name')).toHaveText('Birthday Party');

    const search = page.getByRole('searchbox', { name: 'Search themes' });
    await search.fill('no such theme');
    await expect(gallery.getByRole('radio')).toHaveCount(0);
    await expect(page.locator('.theme-picker__status')).toContainText('No themes found');
    await search.press('Home');
    await expect(search).toBeFocused();
    await search.fill('');
    await page.getByRole('button', { name: 'All', exact: true }).click();
    await expect(gallery.getByRole('radio')).toHaveCount(16);
    await birthday.focus();
    await page.keyboard.press('Escape');
    await expect(gallery).not.toBeVisible();
    await expect(summary).toBeFocused();
    await expect(page.locator('#settings-modal')).toBeVisible();
    await page.reload();
    await page.click('#settings-open');
    await expect(page.locator('.theme-picker__current-name')).toHaveText('Birthday Party');
    await expect(gallery).not.toBeVisible();
});

test('Theme gallery fits a narrow screen and all themes remain reachable', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.click('#settings-open');
    await page.locator('.theme-picker__summary').click();
    const gallery = page.getByRole('radiogroup', { name: 'Visual theme' });
    const bounds = await gallery.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(375);
    expect(bounds.height).toBeLessThanOrEqual(290);
    expect(await gallery.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.screenshot({ animations: 'disabled', path: testInfo.outputPath('theme-picker-mobile.png') });
    for (const card of await gallery.getByRole('radio').all()) {
        await card.click();
        await expect(card).toBeChecked();
        await expect(page.locator('.theme-picker__current-name')).toHaveText(await card.getAttribute('aria-label'));
        expect(await gallery.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    }
});

for (const theme of [
    { id: 'omni', name: 'Omni', palette: 'omniPalette', background: 'rgb(250, 249, 245)', center: [250, 249, 245, 255] },
    { id: 'omni-dark', name: 'Omni Dark', palette: 'omniDarkPalette', background: 'rgb(24, 28, 25)', center: [24, 28, 25, 255] }
]) {
    test(`${theme.name} persists its palette and restores Classic colors without replacing Modern`, async ({ page }) => {
        const themeClass = new RegExp(`(?:^|\\s)theme-${theme.id}(?:\\s|$)`);
        await page.goto('/');
        await page.locator('#csv-input').setInputFiles(path.resolve('sample-watchlist.csv'));
        await expect(page.locator('#movie-list li')).toHaveCount(10);
        await page.locator('.movie-color__input').first().fill('#123456');
        const originalColors = await page.evaluate(async () =>
            (await import('/js/state.js')).appState.movies.map(movie => movie.color));
        await page.click('#settings-open');
        await page.locator('#wheel-style').selectOption('classic');
        await page.locator('.theme-picker__summary').click();
        await page.getByRole('button', { name: 'Everyday', exact: true }).click();
        await page.getByRole('radio', { name: theme.name, exact: true }).click();
        await expect(page.locator('body')).toHaveClass(themeClass);
        await expect(page.locator('body')).toHaveCSS('background-color', theme.background);
        await page.reload();
        await expect(page.locator('body')).toHaveClass(themeClass);
        await expect(page.locator('#movie-list li')).toHaveCount(10);
        await expect(page.locator('#wheel')).toBeVisible();
        const colors = await page.evaluate(async paletteName => {
            const { appState } = await import('/js/state.js');
            const palette = (await import('/js/utils.js'))[paletteName];
            return appState.movies.map(movie => movie.color).every((color, index) => color === palette[index % palette.length]);
        }, theme.palette);
        expect(colors).toBe(true);
        await expect.poll(() => page.locator('#wheel').evaluate(canvas =>
            Array.from(canvas.getContext('2d').getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data)
        )).toEqual(theme.center);
        await page.click('#settings-open');
        await expect(page.locator('.theme-picker__current-name')).toHaveText(theme.name);
        await page.locator('.theme-picker__summary').click();
        await page.getByRole('radio', { name: 'Modern', exact: true }).click();
        await expect(page.locator('body')).toHaveClass(/(?:^|\s)theme-modern(?:\s|$)/);
        await expect(page.locator('body')).not.toHaveClass(themeClass);
        await page.getByRole('radio', { name: 'Classic', exact: true }).click();
        expect(await page.evaluate(async () =>
            (await import('/js/state.js')).appState.movies.map(movie => movie.color))).toEqual(originalColors);
    });
}

for (const width of [1440, 1100, 768, 375]) {
    test(`Studio layout keeps the list and wheel usable at ${width}px`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto('/');
        await page.locator('#csv-input').setInputFiles(path.resolve('sample-watchlist.csv'));
        await expect(page.locator('#movie-list li')).toHaveCount(10);
        await page.click('#settings-open');
        await page.locator('#wheel-style').selectOption('classic');
        await page.locator('.theme-picker__summary').click();
        await page.getByRole('radio', { name: 'Omni', exact: true }).click();
        await page.click('#settings-modal-close');
        const selection = await page.locator('#selection-card').boundingBox();
        const spin = await page.locator('#spin-card').boundingBox();
        if (width >= 1100) {
            expect(Math.abs(selection.y - spin.y)).toBeLessThan(2);
            expect(selection.x + selection.width).toBeLessThan(spin.x);
        } else {
            expect(selection.y + selection.height).toBeLessThan(spin.y);
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        const wheel = await page.locator('#wheel').boundingBox();
        expect(wheel.x).toBeGreaterThanOrEqual(spin.x);
        expect(wheel.x + wheel.width).toBeLessThanOrEqual(spin.x + spin.width);
        await page.locator('#movie-search').fill('Witch');
        await expect(page.locator('#movie-list li')).toHaveCount(1);
        await page.locator('#movie-search').fill('');
        await expect(page.locator('#movie-list li')).toHaveCount(10);
        expect((await page.locator('.movie-summary').first().boundingBox()).width).toBeGreaterThan(150);
        await page.locator('#wheel-fm-minimize').click();
        await page.locator('#wheel-fm-minimize').click();
        await page.locator('#movie-search').blur();
        await page.screenshot({ fullPage: true, animations: 'disabled', path: testInfo.outputPath(`omni-${width}.png`) });
        await page.locator('.spin-mode-card').filter({ hasText: '1 Spin Mode' }).click();
        await expect(page.locator('#spin-button')).toBeEnabled();
    });
}
