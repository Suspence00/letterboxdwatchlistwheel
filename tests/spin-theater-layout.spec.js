import { test, expect } from './fixtures.js';
import path from 'node:path';

const viewports = [
    { width: 1920, height: 1080 },
    { width: 1366, height: 768 },
    { width: 1280, height: 600 },
    { width: 1024, height: 600 },
    { width: 768, height: 600 },
    { width: 390, height: 844 },
    { width: 600, height: 400 },
    { width: 844, height: 390 }
];

async function expectStageToFit(page, wheelSelector) {
    await expect(page.locator('#result')).toBeInViewport({ ratio: 1 });
    await expect.poll(async () => page.evaluate(selector => {
        const stage = document.querySelector('.spin-theater__stage').getBoundingClientRect();
        const result = document.querySelector('#result').getBoundingClientRect();
        const wheel = document.querySelector(selector).getBoundingClientRect();
        return result.top >= stage.top && result.bottom <= wheel.top
            && wheel.bottom <= stage.bottom && wheel.width > 0;
    }, wheelSelector)).toBe(true);
    expect((await page.locator('#result .result__name').boundingBox()).width).toBeGreaterThan(24);
}

for (const style of ['vhs', 'classic']) {
    test(`${style} automatic knockout keeps the live ticker above the wheel`, async ({ page }) => {
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        await page.goto('/');
        await page.locator('#csv-input').setInputFiles(path.resolve('sample-watchlist.csv'));
        if (style === 'classic') {
            await page.locator('#settings-open').click();
            await page.locator('#wheel-style').selectOption(style);
            await page.locator('#settings-modal-close').click();
        }
        await page.setViewportSize({ width: 1366, height: 768 });
        await page.locator('#spin-button').click();
        await expect(page.locator('.spin-theater #result')).toHaveClass(/result--spinning/);
        const wheelSelector = style === 'vhs' ? '.vhs-scene' : '#wheel';
        await expectStageToFit(page, wheelSelector);
        await page.setViewportSize({ width: 600, height: 400 });
        await expectStageToFit(page, wheelSelector);
    });

    for (const showContenders of [false, true]) {
        test(`${style} knockout status fits Theater with contenders ${showContenders ? 'shown' : 'hidden'}`, async ({ page }) => {
            await page.emulateMedia({ reducedMotion: 'reduce' });
            await page.goto('/');
            await page.locator('#csv-input').setInputFiles(path.resolve('sample-watchlist.csv'));
            if (style === 'classic') {
                await page.locator('#settings-open').click();
                await page.locator('#wheel-style').selectOption(style);
                await page.locator('#settings-modal-close').click();
            }
            // Hold a real elimination result still while checking resizing and panel breakpoints.
            await page.evaluate(async show => {
                const { appState } = await import('/js/state.js');
                const { updateKnockoutRemainingBox, updateKnockoutResultText } = await import('/js/ui/knockout-ui.js');
                appState.preferences.hideFinalistsBox = !show;
                updateKnockoutRemainingBox(appState.movies.slice(1));
                updateKnockoutResultText('eliminated', 9, appState.movies[0]);
            }, showContenders);
            await page.locator('#wheel-theater-btn').click();
            const wheelSelector = style === 'vhs' ? '.vhs-scene' : '#wheel';
            for (const viewport of viewports) {
                await test.step(`${viewport.width} by ${viewport.height} at default zoom`, async () => {
                    await page.setViewportSize(viewport);
                    await expectStageToFit(page, wheelSelector);
                });
            }
            await page.locator('.spin-theater__exit').click();
            await expect(page.locator('.wheel-layout > .wheel-stage > #result')).toContainText('Knocked out:');
        });
    }
}
