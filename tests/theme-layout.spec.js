import { test, expect } from './fixtures.js';

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
    await expect(gallery.getByRole('radio')).toHaveCount(14);
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
    await expect(gallery.getByRole('radio')).toHaveCount(14);
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
