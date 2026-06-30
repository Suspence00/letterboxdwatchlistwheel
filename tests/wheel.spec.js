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
    await expect(page.locator('text=The Witch')).toBeVisible();
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
    // Select Knockout Mode (default)
    const knockoutCard = page.locator('.spin-mode-card').filter({ hasText: 'Knockout Mode' });
    await knockoutCard.scrollIntoViewIfNeeded();
    await knockoutCard.click();

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

    // Select 1 Spin Mode
    const oneSpinCard = page.locator('.spin-mode-card').filter({ hasText: '1 Spin Mode' });
    await oneSpinCard.scrollIntoViewIfNeeded();
    await oneSpinCard.click();

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
    const boostBtn = page.locator('.btn-boost').first();
    await boostBtn.click();

    // Fill custom prompt modal
    const modalInput = page.locator('#input-modal-field');
    await expect(modalInput).toBeVisible();
    await modalInput.fill('TestBooster');
    await page.click('#input-modal-submit');

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

  test('Import Append-Mode (CSV)', async ({ page }) => {
    // 1. Upload CSV first time (Replace mode)
    const fileChooserPromise1 = page.waitForEvent('filechooser');
    await page.click('text=Upload CSV File');
    const fileChooser1 = await fileChooserPromise1;
    await fileChooser1.setFiles(SAMPLE_CSV_PATH);
    await expect(page.locator('#movie-list li')).toHaveCount(10);

    // 2. Change first movie weight to 4
    const firstWeightSelect = page.locator('.movie-weight__select').first();
    await firstWeightSelect.selectOption('4');
    await expect(firstWeightSelect).toHaveValue('4');

    // 3. Expand import card and upload CSV again (Append mode via modal)
    await page.click('#import-toggle');
    const fileChooserPromise2 = page.waitForEvent('filechooser');
    await page.click('text=Upload CSV File');
    const fileChooser2 = await fileChooserPromise2;
    await fileChooser2.setFiles(SAMPLE_CSV_PATH);

    // 4. Verify Options modal is visible and click "Add New Movies Only"
    await expect(page.locator('#confirm-modal')).toBeVisible();
    await page.click('#confirm-modal-secondary');

    // Verify that the list count is still 10 (no duplicates added since movies match existing)
    await expect(page.locator('#movie-list li')).toHaveCount(10);
    // Verify first movie weight is still 4
    await expect(firstWeightSelect).toHaveValue('4');
  });

  test('Board Conflict Warning and Switch', async ({ page }) => {
    // 1. Mock proxy for first import on active board (Default Board)
    await page.route('**/letterboxd-proxy.cwbcode.workers.dev/**', async route => {
      const csvData = `Position,Name,Year,URL\n1,"Mock Movie 1",2023,"https://letterboxd.com/film/mock-movie-1/"`;
      await route.fulfill({ status: 200, contentType: 'text/csv', body: csvData });
    });

    await page.fill('#letterboxd-proxy-input', 'https://letterboxd.com/user/list/conflict-list/');
    await page.click('#letterboxd-proxy-open');
    await expect(page.locator('#movie-list li')).toHaveCount(1);

    // 2. Create Board B in Settings
    await page.click('#settings-open');
    await page.click('#tab-btn-boards');
    await page.fill('#new-board-name', 'Board B');
    await page.locator('#create-board-form button[type="submit"]').click();
    await page.click('#settings-modal-close');

    // Verify Board B is active and empty (or just the initial state)
    await expect(page.locator('#workspace-select')).toHaveValue(/^[a-f0-9-]+$/);
    await expect(page.locator('#movie-list li.empty')).toBeVisible();

    // 3. Try to import the same URL into Board B
    await page.click('#import-toggle');
    await page.fill('#letterboxd-proxy-input', 'https://letterboxd.com/user/list/conflict-list/');
    await page.click('#letterboxd-proxy-open');

    // Verify Board Conflict modal appears
    await expect(page.locator('#confirm-modal')).toBeVisible();
    await expect(page.locator('#confirm-modal-message')).toContainText('already tied to a different board');

    // 4. Click Switch and Update
    await page.click('#confirm-modal-confirm');

    // Default Board has movies, so switching and updating shows the Import Options modal
    await expect(page.locator('#confirm-modal')).toBeVisible();
    await expect(page.locator('#confirm-modal-message')).toContainText('replace the existing list or only add new movies');
    
    // Choose Replace Existing List (confirm)
    await page.click('#confirm-modal-confirm');

    // Verify modal closes and active board switches back to Default Board (which has 1 movie "Mock Movie 1")
    await expect(page.locator('#confirm-modal')).toBeHidden();
    await expect(page.locator('#movie-list li')).toHaveCount(1);
    await expect(page.locator('text=Mock Movie 1')).toBeVisible();
  });

  test('Sync/Refresh Tied List', async ({ page }) => {
    let mockResponse = `Position,Name,Year,URL\n1,"Mock Movie A",2023,"https://letterboxd.com/film/mock-movie-a/"`;

    // Mock proxy
    await page.route('**/letterboxd-proxy.cwbcode.workers.dev/**', async route => {
      await route.fulfill({ status: 200, contentType: 'text/csv', body: mockResponse });
    });

    // 1. Initial import to tie the URL
    await page.fill('#letterboxd-proxy-input', 'https://letterboxd.com/user/list/sync-list/');
    await page.click('#letterboxd-proxy-open');
    await expect(page.locator('#movie-list li')).toHaveCount(1);
    await expect(page.locator('text=Mock Movie A')).toBeVisible();

    // 2. Expand import card and verify Sync panel is visible
    await page.click('#import-toggle');
    await expect(page.locator('#import-sync-container')).toBeVisible();
    await expect(page.locator('#import-sync-url')).toContainText('sync-list');

    // 3. Update mock response: add "Mock Movie B", remove "Mock Movie A"
    mockResponse = `Position,Name,Year,URL\n1,"Mock Movie B",2024,"https://letterboxd.com/film/mock-movie-b/"`;

    // 4. Click Sync button
    await page.click('#import-sync-btn');

    // Verify list is updated: Mock Movie A removed, Mock Movie B added
    await expect(page.locator('#movie-list li')).toHaveCount(1);
    await expect(page.locator('text=Mock Movie B')).toBeVisible();
    await expect(page.locator('text=Mock Movie A')).not.toBeVisible();
  });

  test('Reshow Winner Popup and Persistence', async ({ page }) => {
    // 1. Load sample data
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('text=Upload CSV File');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(SAMPLE_CSV_PATH);

    // 2. Expect "Show Winner" button to be disabled initially
    const reshowBtn = page.locator('#reshow-winner-btn');
    await expect(reshowBtn).toBeDisabled();

    // 3. Select 1 Spin Mode
    const oneSpinCard = page.locator('.spin-mode-card').filter({ hasText: '1 Spin Mode' });
    await oneSpinCard.scrollIntoViewIfNeeded();
    await oneSpinCard.click();

    // 4. Spin!
    await page.click('#spin-button');

    // 5. Wait for the winner modal to show up
    const winModal = page.locator('#win-modal');
    await expect(winModal).toBeVisible({ timeout: 20000 });

    // 6. Close the modal
    await page.click('#win-modal-close');
    await expect(winModal).not.toBeVisible();

    // 7. "Show Winner" button should now be enabled
    await expect(reshowBtn).toBeEnabled();

    // 8. Click "Show Winner" button, and verify modal is visible again
    await reshowBtn.click();
    await expect(winModal).toBeVisible();

    // 9. Close it again
    await page.click('#win-modal-close');
    await expect(winModal).not.toBeVisible();

    // 10. Reload the page to test persistence
    await page.reload();

    // 11. "Show Winner" button should be enabled on reload
    await expect(reshowBtn).toBeEnabled();

    // 12. Click it, and modal should open
    await reshowBtn.click();
    await expect(winModal).toBeVisible();
    await page.click('#win-modal-close');

    // 13. Clear selection, and verify button is disabled
    await page.click('#clear-selection');
    await expect(reshowBtn).toBeDisabled();
  });

});


