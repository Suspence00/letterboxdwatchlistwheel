import { test, expect } from './fixtures.js';

test('Promo playback can pause, seek, replay, and respects reduced motion', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/promo.html');

    const play = page.getByRole('button', { name: 'Play promo' });
    const seek = page.getByRole('slider', { name: 'Playback position' });
    await expect(play).toBeVisible();
    await expect(seek).toHaveValue('28');

    await play.click();
    await expect(page.getByRole('button', { name: 'Pause promo' })).toBeVisible();
    await expect.poll(async () => Number(await seek.inputValue())).toBeGreaterThan(28);
    await page.getByRole('button', { name: 'Pause promo' }).click();

    await seek.evaluate(element => {
        element.value = '8';
        element.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await expect(seek).toHaveValue('8');
    await expect(page.locator('#promo-time')).toHaveText('00:08 / 00:30');
    await page.getByRole('button', { name: 'Replay' }).click();
    await expect(page.getByRole('button', { name: 'Pause promo' })).toBeVisible();
    await expect.poll(async () => Number(await seek.inputValue())).toBeLessThan(3);

    await page.getByRole('button', { name: 'Pause promo' }).click();
    await seek.press('End');
    await play.click();
    await expect.poll(async () => Number(await seek.inputValue())).toBeLessThan(3);
    await expect(page.getByRole('link', { name: /Download film/ })).toHaveAttribute('download', '');
    expect(errors).toEqual([]);
});

test('Promo autoplays silently and keeps decoded soundtrack in sync with controls', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/promo.html');

    const audio = page.locator('#promo-audio');
    const seek = page.getByRole('slider', { name: 'Playback position' });
    const sound = page.getByRole('button', { name: 'Sound off' });
    await expect(page.getByRole('button', { name: 'Pause promo' })).toBeVisible();
    await expect.poll(async () => Number(await seek.inputValue())).toBeGreaterThan(0);
    await expect(sound).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(() => audio.evaluate(element => element.paused)).toBe(true);
    await expect.poll(() => audio.evaluate(element => element.readyState)).toBeGreaterThanOrEqual(1);
    const duration = await audio.evaluate(element => element.duration);
    expect(duration).toBeGreaterThan(29.9);
    expect(duration).toBeLessThan(30.1);

    await sound.click();
    await expect(page.getByRole('button', { name: 'Sound on' })).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => audio.evaluate(element => element.paused)).toBe(false);
    await expect.poll(() => audio.evaluate(element => element.currentTime)).toBeGreaterThan(0);

    await page.getByRole('button', { name: 'Pause promo' }).click();
    await expect.poll(() => audio.evaluate(element => element.paused)).toBe(true);
    await seek.evaluate(element => {
        element.value = '8';
        element.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await expect.poll(() => audio.evaluate(element => element.currentTime)).toBe(8);
    await expect.poll(() => audio.evaluate(element => element.paused)).toBe(true);

    await page.getByRole('button', { name: 'Play promo' }).click();
    await expect.poll(() => audio.evaluate(element => element.paused)).toBe(false);
    await expect.poll(() => audio.evaluate(element => element.currentTime)).toBeGreaterThan(8);
    await page.getByRole('button', { name: 'Sound on' }).click();
    await expect(sound).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(() => audio.evaluate(element => element.paused)).toBe(true);

    await page.setViewportSize({ width: 375, height: 812 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
});

test('Chapter transitions avoid large bright or orange flashes', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/promo.html');
    const samples = await page.evaluate(async () => {
        const { CHAPTERS, DURATION, renderFrame } = await import('/js/promo/film.js');
        const { loadAssets } = await import('/js/promo/assets.js');
        await loadAssets();
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 180;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        const samples = [];
        for (const boundary of [...CHAPTERS.map(chapter => chapter.start), DURATION]) {
            for (const offset of [-0.2, -0.1, 0, 0.05, 0.1, 0.15, 0.2]) {
                const time = boundary + offset;
                if (time < 0 || time > DURATION) continue;
                renderFrame(canvas, time);
                const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
                let orange = 0;
                let bright = 0;
                for (let index = 0; index < pixels.length; index += 4) {
                    const [red, green, blue] = pixels.subarray(index, index + 3);
                    if (red > 170 && green > 70 && red > green * 1.3 && blue < green * 0.86) orange++;
                    if (red * 0.2126 + green * 0.7152 + blue * 0.0722 > 200) bright++;
                }
                samples.push({ time, orange: orange / (pixels.length / 4), bright: bright / (pixels.length / 4) });
            }
        }
        return samples;
    });
    // These broad coverage limits catch full-frame transition flashes while
    // allowing ordinary title lettering, poster art, and small accent details.
    for (const sample of samples) {
        expect(sample.orange, `Orange flash coverage at ${sample.time}s`).toBeLessThan(0.3);
        expect(sample.bright, `Bright flash coverage at ${sample.time}s`).toBeLessThan(0.5);
    }
});
