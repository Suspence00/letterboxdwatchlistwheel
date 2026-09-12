import { test, expect } from '@playwright/test';

test('Theme controls retain usable dimensions and settings fit a narrow screen', async ({ page }) => {
    await page.goto('/');
    await page.click('#settings-open');
    const themes = await page.locator('.theme-card').evaluateAll(cards => cards.map(card => card.dataset.theme));
    expect(themes).toHaveLength(13);
    const metrics = [];
    for (const theme of themes) {
        await page.locator(`.theme-card[data-theme="${theme}"]`).click();
        metrics.push(await page.locator('#wheel-style').evaluate(element => ({
            height: element.getBoundingClientRect().height,
            fontSize: getComputedStyle(element).fontSize
        })));
        await expect(page.locator(`.theme-card[data-theme="${theme}"]`)).toHaveAttribute('aria-checked', 'true');
    }
    expect(new Set(metrics.map(metric => metric.fontSize)).size).toBe(1);
    expect(Math.max(...metrics.map(metric => metric.height)) - Math.min(...metrics.map(metric => metric.height))).toBeLessThanOrEqual(1);
    await page.locator('.theme-card[data-theme="forest"]').click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('.theme-card[data-theme="default"]').scrollIntoViewIfNeeded();
    await expect(page.locator('.theme-card[data-theme="default"]')).toBeVisible();
    const fits = await page.locator('.theme-picker').evaluate(element => element.scrollWidth <= element.clientWidth);
    expect(fits).toBe(true);
    await page.screenshot({ path: 'test-results/theme-picker-mobile.png' });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: 'test-results/theme-picker-desktop.png' });
});

test('Theme picker supports keyboard navigation, decorations toggle, and backup sync', async ({ page }) => {
    await page.goto('/');
    await page.click('#settings-open');

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
    await expect(page.locator('body')).not.toHaveClass(/decorations-disabled/);
});

