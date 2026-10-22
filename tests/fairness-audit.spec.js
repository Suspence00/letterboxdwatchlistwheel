import { test, expect } from './fixtures.js';
import path from 'node:path';

async function openAuditSettings(page) {
    await page.locator('#settings-open').click();
    await page.locator('#tab-btn-advanced').click();
}

test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator('#csv-input').setInputFiles(path.resolve('sample-watchlist.csv'));
    await expect(page.locator('#movie-list li')).toHaveCount(10);
    await page.locator('.spin-mode-card').filter({ hasText: '1 Spin Mode' }).click();
});

test('System Audit shows weighted results and supports keyboard and pointer dismissal', async ({ page }) => {
    await page.locator('.movie-weight__select').first().selectOption('5');
    await openAuditSettings(page);
    const verifyButton = page.locator('#verify-fairness-btn');
    const report = page.getByRole('dialog', { name: 'Fairness Audit Report' });
    const closeButton = page.locator('#verify-close');

    await verifyButton.click();
    await expect(report).toBeVisible();
    await expect(page.locator('#verify-table tbody tr')).toHaveCount(10);
    const witch = report.getByRole('row').filter({ hasText: 'The Witch' });
    await expect(witch.locator('td').nth(1)).toHaveText('5.00');
    await expect(witch.locator('td').nth(2)).toHaveText('35.71%');
    await expect(page.locator('#verify-summary')).not.toBeEmpty();
    const actualTotal = await report.locator('tbody tr').evaluateAll(rows =>
        rows.reduce((total, row) => total + parseFloat(row.cells[3].textContent), 0));
    expect(actualTotal).toBeCloseTo(100, 1);

    await expect(closeButton).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(closeButton).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(closeButton).toBeFocused();

    for (const dismissal of ['close', 'backdrop', 'escape']) {
        if (dismissal === 'close') await closeButton.click();
        if (dismissal === 'backdrop') await page.locator('#verify-modal').click({ position: { x: 2, y: 2 } });
        if (dismissal === 'escape') await page.keyboard.press('Escape');
        await expect(report).toBeHidden();
        await expect(verifyButton).toBeFocused();
        await expect(page.locator('#settings-modal')).toBeVisible();
        if (dismissal !== 'escape') {
            await verifyButton.click();
            await expect(report).toBeVisible();
            await expect(page.locator('#verify-table tbody tr')).toHaveCount(10);
        }
    }
});

test('System Audit respects selection and filters, replacing previous results on rerun', async ({ page }) => {
    const midsommar = page.locator('#movie-list li').filter({ hasText: 'Midsommar' });
    await midsommar.getByRole('checkbox').uncheck();
    await openAuditSettings(page);
    await page.locator('#verify-fairness-btn').click();
    const rows = page.locator('#verify-table tbody tr');
    await expect(rows).toHaveCount(9);
    await expect(rows.filter({ hasText: 'Midsommar' })).toHaveCount(0);

    await page.locator('#verify-close').click();
    await page.locator('#settings-modal-close').click();
    await page.locator('#movie-search').fill('2019');
    await expect(page.locator('#movie-list li')).toHaveCount(2);
    await openAuditSettings(page);
    await page.locator('#verify-fairness-btn').click();
    await expect(rows).toHaveCount(1);
    await expect(rows.first().locator('td').nth(0)).toHaveText('Parasite');
    await expect(rows.first().locator('td').nth(2)).toHaveText('100.00%');
    await expect(rows.first().locator('td').nth(3)).toHaveText('100.00%');
});

test('System Audit explains an empty selection without opening a report', async ({ page }) => {
    await page.locator('#clear-selection').click();
    await openAuditSettings(page);
    const dialogPromise = page.waitForEvent('dialog');
    const clickPromise = page.locator('#verify-fairness-btn').click();
    const dialog = await dialogPromise;
    expect(dialog.type()).toBe('alert');
    expect(dialog.message()).toBe('No movies selected to audit.');
    await dialog.accept();
    await clickPromise;
    await expect(page.locator('#verify-modal')).toBeHidden();
    await expect(page.locator('#settings-modal')).toBeVisible();
});
