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
