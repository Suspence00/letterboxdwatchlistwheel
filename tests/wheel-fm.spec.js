import { test, expect } from './fixtures.js';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

for (const viewport of [{ width: 1440, height: 900 }, { width: 375, height: 812 }]) {
    test(`Wheel.FM stays docked without blocking wheel controls at ${viewport.width}px`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await page.goto('/');
        await page.locator('#csv-input').setInputFiles(path.resolve('sample-watchlist.csv'));
        await expect(page.locator('#movie-list li')).toHaveCount(10);

        const player = page.getByRole('region', { name: 'Wheel.FM' });
        const options = player.locator('summary');
        const channel = player.getByRole('combobox', { name: 'Channel' });
        await expect(player.getByRole('button', { name: 'Play Wheel.FM' })).toBeEnabled();
        await expect(channel).toBeHidden();

        const wheelchinko = page.locator('.spin-mode-card').filter({ hasText: 'Wheelchinko' });
        await wheelchinko.click();
        await expect(page.getByRole('button', { name: 'Drop Puck', exact: true })).toBeVisible();
        await expect.poll(async () => {
            const { x, y, width, height } = await player.boundingBox();
            return [x, width, y + height];
        }).toEqual([0, viewport.width, viewport.height]);

        await expect(options).toHaveAccessibleName('Wheel.FM options');
        await options.press('Enter');
        await expect(channel).toBeVisible();
        await page.keyboard.press('Tab');
        await expect(channel).toBeFocused();
        await page.keyboard.press('Escape');
        await expect(channel).toBeHidden();
        await expect(options).toBeFocused();

        await options.click();
        await page.locator('#spin-heading').click();
        await expect(channel).toBeHidden();
        const promo = page.getByRole('link', { name: 'Watch the promo' });
        await promo.scrollIntoViewIfNeeded();
        await promo.click({ trial: true });
    });
}

test('Wheel.FM options control the same player as the bottom bar', async ({ page }) => {
    // The test server serves whole files, but seeking ahead requires a byte-range response.
    const seekableTrack = 'MidwestEmoChristmas.mp3';
    const bytes = await readFile(path.resolve('wheel-fm', seekableTrack));
    await page.route(`**/wheel-fm/${seekableTrack}`, async route => {
        const range = /^bytes=(\d+)-(\d*)$/.exec(route.request().headers().range || '');
        const headers = { 'accept-ranges': 'bytes', 'content-type': 'audio/mpeg' };
        if (!range) {
            await route.fulfill({ headers, body: bytes });
            return;
        }
        const start = Number(range[1]);
        const end = range[2] ? Math.min(Number(range[2]), bytes.length - 1) : bytes.length - 1;
        await route.fulfill({
            status: 206,
            headers: { ...headers, 'content-range': `bytes ${start}-${end}/${bytes.length}` },
            body: bytes.subarray(start, end + 1)
        });
    });
    await page.goto('/');
    const player = page.getByRole('region', { name: 'Wheel.FM' });
    const play = player.getByRole('button', { name: 'Play Wheel.FM' });
    const pause = player.getByRole('button', { name: 'Pause Wheel.FM' });
    const title = player.locator('#wheel-fm-track-title');
    const audio = player.locator('audio');
    await expect(title).toHaveText('A Spin Through Mumbai');
    await play.click();
    await expect(pause).toBeVisible();
    await player.getByRole('button', { name: 'Skip to next track' }).click();
    await expect(title).toHaveText('Ethereal Spokes');
    await player.getByRole('button', { name: 'Play previous track' }).click();
    await expect(title).toHaveText('A Spin Through Mumbai');

    const options = player.locator('summary');
    await options.press('Space');
    await player.getByRole('combobox', { name: 'Channel' }).selectOption('A Very Cozy Wheelmas');
    await expect(title).toHaveText('Oy Vey, Praise the Wheel');
    await expect(play).toBeVisible();
    await player.getByRole('combobox', { name: 'Track' }).selectOption('1');
    await expect(title).toHaveText('Never Met A Wheel Like You');

    const volume = player.getByRole('slider', { name: 'Volume' });
    await volume.press('ArrowLeft');
    await expect(volume).toHaveValue('79');
    await expect.poll(() => audio.evaluate(media => media.volume)).toBe(0.79);
    const seek = player.getByRole('slider', { name: 'Wheel.FM progress' });
    await expect(seek).toBeEnabled();
    const seekBounds = await seek.boundingBox();
    await seek.click({ position: { x: seekBounds.width / 2, y: seekBounds.height / 2 } });
    await expect.poll(() => audio.evaluate(media => media.currentTime / media.duration)).toBeGreaterThanOrEqual(0.49);

    await options.click();
    await expect(volume).toBeHidden();
    await pause.click();
    await expect(play).toBeVisible();
});
