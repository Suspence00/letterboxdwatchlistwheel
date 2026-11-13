import { test, expect } from './fixtures.js';
import path from 'node:path';

const scenes = [
    { id: 'spooky', label: 'Spooky Halloween', art: 'spooky', winner: 'Tonight at the haunted drive-in', effect: 'projector-dust', tick: 270 },
    { id: 'forest', label: 'Forest Camp', art: 'forest', winner: 'Tonight around the campfire', effect: 'camp-embers', tick: 460 },
    { id: 'thanksgiving', label: 'Thanksgiving', art: 'thanksgiving', winner: 'The main course', effect: 'falling-leaves', tick: 315 },
    { id: 'holiday', label: 'Christmas', art: 'christmas', winner: 'Under the marquee tonight', effect: 'falling-snow', tick: 870 },
    { id: 'hanukkah', label: 'Hanukkah', art: 'hanukkah', winner: 'Tonight by candlelight', effect: 'camp-embers', tick: 690 },
    { id: 'friendslop', label: 'Gaming Friendslop', art: 'friendslop', winner: 'Extraction complete', effect: 'arcade-pixels', tick: 380 }
];

async function chooseTheme(page, name) {
    await page.getByRole('button', { name: 'Open settings' }).click();
    await page.locator('.theme-picker__summary').click();
    await page.getByRole('radio', { name, exact: true }).click();
    await page.getByRole('button', { name: 'Close settings' }).click();
}

for (const scene of scenes) {
    test(`${scene.label} carries its scene through the wheel and winner reveal`, async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 812 });
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.goto('/');
        await page.locator('#csv-input').setInputFiles(path.resolve('sample-watchlist.csv'));
        await expect(page.locator('#movie-list li')).toHaveCount(10);
        await chooseTheme(page, scene.label);

        const artwork = page.locator('.theme-scene-decorations');
        await expect(page.locator('body')).toHaveClass(new RegExp(`\\btheme-${scene.id}\\b`));
        await expect(artwork).toBeVisible();
        await expect(artwork).toHaveCSS('background-image', new RegExp(`/media/themes/${scene.art}\\.webp`));
        expect(await artwork.evaluate(async (element) => {
            const source = getComputedStyle(element).backgroundImage.match(/url\("([^"]+)"\)/)?.[1];
            const image = new Image();
            image.src = source;
            await image.decode();
            return image.naturalWidth;
        })).toBeGreaterThan(1000);
        await expect(page.locator('.vhs-hub')).toHaveCSS('background-image', /radial-gradient/);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        const tick = await page.evaluate(async () => {
            const { playTickSound } = await import('/js/audio.js');
            const original = AudioParam.prototype.setValueAtTime;
            const frequencies = [];
            AudioParam.prototype.setValueAtTime = function (value, time) {
                if (value > 1) frequencies.push(value);
                return original.call(this, value, time);
            };
            try {
                playTickSound();
                return frequencies[0];
            } finally {
                AudioParam.prototype.setValueAtTime = original;
            }
        });
        expect(tick).toBe(scene.tick);

        await page.getByRole('link', { name: 'Go to spin' }).click();
        await page.locator('.spin-mode-card').filter({ hasText: '1 Spin Mode' }).click();
        await page.locator('#spin-button').click();
        const winner = page.getByRole('dialog', { name: /The movie selected was/ });
        await expect(winner.getByText(scene.winner, { exact: true })).toBeVisible();
        const particle = page.locator('.confetti-piece').first();
        await expect(particle).toBeAttached();
        await expect(particle).toBeHidden();
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        await expect(particle).toHaveCSS('animation-name', scene.effect);
    });
}

test('Thanksgiving is seasonal and saves its palette and decoration preference', async ({ page }) => {
    await page.goto('/');
    await page.locator('#csv-input').setInputFiles(path.resolve('sample-watchlist.csv'));
    await expect(page.locator('#movie-list li')).toHaveCount(10);
    await page.getByRole('button', { name: 'Open settings' }).click();
    await page.locator('.theme-picker__summary').click();
    await page.getByRole('button', { name: 'Seasonal', exact: true }).click();
    await page.getByRole('searchbox', { name: 'Search themes' }).fill('thanksgiving');
    await page.getByRole('radio', { name: 'Thanksgiving', exact: true }).click();
    await page.locator('#decorations-toggle').uncheck();
    await page.locator('#wheel-style').selectOption('classic');
    await page.getByRole('button', { name: 'Close settings' }).click();
    await page.reload();
    await expect(page.locator('body')).toHaveClass(/\btheme-thanksgiving\b/);
    await expect(page.locator('.theme-scene-decorations')).toBeHidden();
    await expect.poll(() => page.locator('#wheel').evaluate(canvas => {
        const pixel = canvas.getContext('2d').getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data;
        return [219, 163, 87, 255].every((channel, index) => Math.abs(channel - pixel[index]) <= 3);
    })).toBe(true);
    const matchesPalette = await page.evaluate(async () => {
        const { appState } = await import('/js/state.js');
        const { thanksgivingPalette } = await import('/js/utils.js');
        return appState.movies.every((movie, index) => movie.color === thanksgivingPalette[index]);
    });
    expect(matchesPalette).toBe(true);
    await chooseTheme(page, 'Omni Dark');
    await expect(page.locator('body')).not.toHaveAttribute('data-theme-scene', '');
    await expect(page.locator('.theme-scene-decorations')).toBeHidden();
});
