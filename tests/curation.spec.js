import { test, expect } from './fixtures.js';
import path from 'node:path';

test('Compact movie controls retain accessible names and keep odds in sync', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/');
    await page.locator('#csv-input').setInputFiles(path.resolve('sample-watchlist.csv'));
    await expect(page.locator('#movie-list li')).toHaveCount(10);
    const first = page.locator('#movie-list li').first();
    const risk = first.locator('.movie-odds--risk');
    const win = first.locator('.movie-odds--win');
    await expect(first.locator('.movie-meta')).toHaveText('2015');
    await expect(risk).toHaveText('Risk 10%');
    await expect(win).toHaveText('Win 10%');
    await expect(risk).toHaveAttribute('aria-label', 'Pick risk this spin: 10%');
    await expect(first.getByRole('button', { name: 'Boost The Witch', exact: true })).toBeVisible();
    await expect(first.getByRole('link', { name: 'Open The Witch on Letterboxd' })).toBeVisible();
    await expect(first.getByLabel('Slice color for The Witch', { exact: true })).toBeVisible();

    await first.getByRole('combobox', { name: 'Knockout weight for The Witch' }).selectOption('5');
    await expect(risk).toHaveText('Risk 2.2%');
    await expect(win).toHaveText('Win 36%');
    await expect(win).toHaveAttribute('aria-label', 'Odds to be final winner: 36%');

    await page.locator('.spin-mode-card').filter({ hasText: '1 Spin Mode' }).click();
    await expect(risk).toBeHidden();
    await expect(win).toHaveText('Win 36%');
    await expect(first.getByRole('combobox', { name: 'Spin weight (more likely) for The Witch' })).toHaveValue('5');
    await first.getByRole('checkbox').uncheck();
    await expect(win).toHaveText('Win 0%');
    await expect(win).toHaveAttribute('aria-label', 'Final winner odds: 0% (not selected)');
    await page.locator('#select-all').click();
    await page.locator('#reset-weights').click();
    await page.locator('#confirm-modal-confirm').click();
    await expect(first.locator('.movie-weight__select')).toHaveValue('1');
    await expect(win).toHaveText('Win 10%');
    await page.locator('.spin-mode-card').filter({ hasText: 'Knockout Mode' }).click();
    await page.locator('#settings-open').click();
    await page.locator('.theme-picker__summary').click();
    await page.getByRole('radio', { name: 'Omni', exact: true }).click();
    await page.locator('#settings-modal-close').click();
    await page.locator('#selection-card').screenshot({ path: testInfo.outputPath('compact-curation.png'), animations: 'disabled' });
});

test('Mobile import leads to the spin action and search explains eligibility', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await expect(page.getByRole('textbox', { name: 'Letterboxd URL or username' })).toBeVisible();
    await expect(page.locator('#movie-list .empty')).toHaveText('Import from Letterboxd, upload a CSV, paste a list, or add a movie to get started.');

    const summary = page.locator('#spin-eligibility');
    const jump = page.getByRole('link', { name: 'Go to spin' });
    await expect(summary).toHaveText('0 movies eligible to spin');
    await expect(jump).toBeHidden();
    await page.locator('#csv-input').setInputFiles(path.resolve('sample-watchlist.csv'));
    await expect(summary).toHaveText('10 movies eligible to spin');
    await expect(jump).toBeInViewport({ ratio: 1 });
    await jump.click({ trial: true });

    const search = page.getByRole('searchbox', { name: 'Search your picks' });
    await expect(search).toHaveAccessibleDescription('Only selected movies that match your search can spin.');
    await search.fill('Witch');
    await expect(summary).toHaveText('1 movie eligible to spin');
    await search.fill('no matching title');
    await expect(summary).toHaveText('0 movies eligible to spin');
    await expect(page.locator('#spin-button')).toBeDisabled();
    await expect(jump).toBeHidden();
    await search.fill('');
    await expect(summary).toHaveText('10 movies eligible to spin');

    await jump.press('Enter');
    await expect(page.getByRole('heading', { name: '3. Spin the wheel' })).toBeFocused();
    const spin = page.locator('#spin-button');
    await expect(spin).toBeEnabled();
    await expect(spin).toBeInViewport({ ratio: 1 });
    const modeBounds = await page.getByRole('group', { name: 'Spin mode' }).boundingBox();
    const spinBounds = await spin.boundingBox();
    const stageBounds = await page.locator('.wheel-section').boundingBox();
    expect(spinBounds.y).toBeGreaterThan(modeBounds.y + modeBounds.height);
    expect(spinBounds.y + spinBounds.height).toBeLessThan(stageBounds.y);
    await spin.click({ trial: true });
});
