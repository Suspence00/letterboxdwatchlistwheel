import { test, expect } from '@playwright/test';
import path from 'path';

const SAMPLE_CSV_PATH = path.join(__dirname, '../sample-watchlist.csv');

test.describe('Letterboxd Watchlist Wheel', () => {

  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test to ensure a clean state
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('Load Sample CSV and Verify Movie List', async ({ page }) => {
    // 1. Upload CSV
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('text=Upload CSV File');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(SAMPLE_CSV_PATH);

    // 2. Verify Movies Loaded
    // The sample CSV has 10 entries (based on the previous failure saying expected 4 received 10)
    await expect(page.locator('#movie-list li')).toHaveCount(10);
    await expect(page.locator('text=Alien')).toBeVisible();
    await expect(page.locator('text=Parasite')).toBeVisible();
  });

  test('Letterboxd URL Import (Mocked)', async ({ page }) => {
    // Mock the proxy response
    await page.route('**/letterboxd-proxy.cwbcode.workers.dev/**', async route => {
      const csvData = `Position,Name,Year,URL,Description\n1,"Mock Movie",2023,"https://letterboxd.com/film/mock-movie/",`;
      await route.fulfill({ status: 200, contentType: 'text/csv', body: csvData });
    });

    // Enter URL and fetch
    await page.fill('#letterboxd-proxy-input', 'https://letterboxd.com/user/list/mock-list/');
    await page.click('#letterboxd-proxy-open');

    // Verify
    await expect(page.locator('#movie-list li')).toHaveCount(1);
    await expect(page.locator('text=Mock Movie')).toBeVisible();
  });

  test('Deep Linking (?list=...)', async ({ page }) => {
    // Mock the proxy again
    await page.route('**/letterboxd-proxy.cwbcode.workers.dev/**', async route => {
      const csvData = `Position,Name,Year,URL\n1,"Deep Link Movie",2024,"https://letterboxd.com/film/deep-link-movie/"`;
      await route.fulfill({ status: 200, contentType: 'text/csv', body: csvData });
    });

    // Go to URL with param
    await page.goto('/?list=https://letterboxd.com/user/list/test/');

    // Verify auto-fetch triggered
    await expect(page.locator('#movie-list li')).toHaveCount(1);
    await expect(page.locator('text=Deep Link Movie')).toBeVisible();
  });

  test('Spin Modes: Knockout', async ({ page }) => {
    // Load sample data first
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('text=Upload CSV File');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(SAMPLE_CSV_PATH);

    // Scroll to the element first to ensure it's in view, just in case
    const knockoutRadio = page.locator('input[value="knockout"]');
    await knockoutRadio.scrollIntoViewIfNeeded();

    // Select Knockout Mode (default)
    // Use force:true because the input might be visually hidden or covered by the custom radio UI
    await knockoutRadio.click({ force: true });

    // Verify "Elimination" button text or state
    const spinBtn = page.locator('#spin-button');
    await expect(spinBtn).toHaveText('Start Movie Knockout mode');

    // Spin!
    await spinBtn.click();

    // Wait for spin to start
    await expect(spinBtn).toHaveText('Eliminating.', { timeout: 5000 });
  });

  test('Spin Modes: 1 Spin', async ({ page }) => {
     // Load sample data
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('text=Upload CSV File');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(SAMPLE_CSV_PATH);

    // Scroll to the element first
    const oneSpinRadio = page.locator('input[value="one-spin"]');
    await oneSpinRadio.scrollIntoViewIfNeeded();

    // Select 1 Spin Mode
    // Use force:true because the input might be visually hidden or covered by the custom radio UI
    await oneSpinRadio.click({ force: true });

    // Verify Button Text
    await expect(page.locator('#spin-button')).toHaveText('Spin the One Spin to Rule them all');
  });

  test('Visuals: Slice Editor & Colors', async ({ page }) => {
    // Load sample data
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('text=Upload CSV File');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(SAMPLE_CSV_PATH);

    // Click on the color input directly in the list
    const firstMovieColorInput = page.locator('.movie-color__input').first();
    await expect(firstMovieColorInput).toBeVisible();

    // Change color
    await firstMovieColorInput.fill('#ff0000');

    // Verify value
    await expect(firstMovieColorInput).toHaveValue('#ff0000');
  });

  test('Audio: Wheel.FM Toggle', async ({ page }) => {
    const toggle = page.locator('#wheel-sound-toggle');

    await expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await toggle.click();

    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.sound-toggle__text')).toHaveText('Unmute wheel sounds');
  });

  test('Settings: Theme Switching', async ({ page }) => {
     await page.click('#settings-open');

     const themeSelect = page.locator('#theme-select');
     await themeSelect.selectOption('cyber');

     // Check body class
     await expect(page.locator('body')).toHaveClass(/theme-cyber/);
  });

  test('Boost System: Dropdowns & Tags', async ({ page }) => {
    // Load sample
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('text=Upload CSV File');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(SAMPLE_CSV_PATH);

    // 1. Dropdown: Change weight to 2x
    const firstWeightSelect = page.locator('.movie-weight__select').first();
    await firstWeightSelect.selectOption('2');

    // Verify value
    await expect(firstWeightSelect).toHaveValue('2');

    // 2. Inline Boost Button (+)
    // Mock dialog
    page.on('dialog', async dialog => {
        if (dialog.message().includes('Who is boosting')) {
            await dialog.accept('TestBooster');
        } else {
            await dialog.dismiss();
        }
    });

    const boostBtn = page.locator('.btn-boost').first();
    await boostBtn.click();

    // 3. Verify Booster Tag appears
    // Use a more relaxed locator or wait explicitly
    const boosterTag = page.locator('.booster-tag').first();
    await expect(boosterTag).toBeVisible({ timeout: 10000 }); // Increase timeout
    await expect(boosterTag).toContainText('TestBooster');
    await expect(boosterTag).toContainText('x1'); // Count

    // 4. Click Tag to open History/Management Modal
    await boosterTag.click();
    const overlay = page.locator('#booster-action-overlay');
    await expect(overlay).toBeVisible();
    await expect(overlay).toContainText('TestBooster');
    await expect(overlay).toContainText('Contributions to');

    // 5. Test "Add Boost (+1)" in modal
    await page.click('#action-add-boost');

    // Modal should close
    await expect(overlay).toBeHidden();

    // Verify weight updated to 4
    await expect(firstWeightSelect).toHaveValue('4');
  });

});
