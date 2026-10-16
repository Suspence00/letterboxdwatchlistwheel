import { test, expect } from './fixtures.js';
import path from 'path';

const SAMPLE_CSV_PATH = path.resolve(import.meta.dirname || process.cwd(), '../sample-watchlist.csv');

test.describe('Letterboxd Watchlist Wheel', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Board deletion confirmation stays above Settings and respects cancellation', async ({ page }) => {
    await page.click('#settings-open');
    await page.click('#tab-btn-boards');
    await page.fill('#new-board-name', 'Keep me');
    await page.locator('#create-board-form button[type="submit"]').click();
    const firstBoard = page.locator('#boards-list .board-item').filter({ hasText: 'My Watchlist' });
    const deleteButton = firstBoard.getByRole('button', { name: 'Delete', exact: true });
    await deleteButton.click();
    await page.click('#confirm-modal-cancel');
    await expect(firstBoard).toBeVisible();
    await deleteButton.click();
    await page.click('#confirm-modal-confirm');
    await expect(firstBoard).toHaveCount(0);
    await expect(page.locator('#settings-modal')).toBeVisible();
    await expect(page.locator('#workspace-select option')).toHaveCount(1);
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

  test('Bulk Add Entries via Step 1 Action Button and Auto Collapse', async ({ page }) => {
    // 1. Click Bulk Add from Step 1
    await page.click('#open-bulk-import-btn');
    const modal = page.locator('#bulk-entry-modal');
    await expect(modal).toBeVisible();

    // 2. Fill text and submit
    await page.fill('#bulk-entry-text', 'Alien\nAliens\nAlien 3');
    await page.click('#bulk-modal-submit');
    await expect(modal).not.toBeVisible();

    // 3. Verify movies added
    await expect(page.locator('#movie-list li')).toHaveCount(3);
    await expect(page.locator('#movie-list').getByText('Alien', { exact: true })).toBeVisible();

    // 4. Verify Step 1 is collapsed
    await expect(page.locator('#import-card')).toHaveClass(/card--collapsed/);
  });

  test('Sync-style pagination failure does not replace the existing board', async ({ page }) => {
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('text=Upload CSV File');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(SAMPLE_CSV_PATH);
    await expect(page.locator('#movie-list li')).toHaveCount(10);

    const rows = Array.from({ length: 100 }, (_, index) =>
      `${index + 1},"Remote Movie ${index + 1}",2025,"https://letterboxd.com/film/remote-${index + 1}/"`
    ).join('\n');

    await page.route('**/letterboxd-proxy.cwbcode.workers.dev/**', async route => {
      const requestUrl = decodeURIComponent(route.request().url());
      if (requestUrl.includes('/page/2/')) {
        await route.fulfill({ status: 500, body: 'temporary failure' });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'text/csv',
        body: `Position,Name,Year,URL\n${rows}`
      });
    });

    await page.click('#import-toggle');
    await page.fill('#letterboxd-proxy-input', 'https://letterboxd.com/user/list/paginated-list/');
    await page.click('#letterboxd-proxy-open');
    await page.click('#confirm-modal-confirm');

    await expect(page.locator('#letterboxd-proxy-status')).toContainText('No changes were made');
    await expect(page.locator('#movie-list li')).toHaveCount(10);
    await expect(page.locator('#movie-list').getByText('The Witch', { exact: true })).toBeVisible();
  });

  test('Letterboxd Watchlist multi-page import fetches all pages using 28-item page size', async ({ page }) => {
    const requestedPages = [];

    await page.route('**/letterboxd-proxy.cwbcode.workers.dev/**', async route => {
      const requestUrl = decodeURIComponent(route.request().url());
      const pageMatch = requestUrl.match(/\/page\/(\d+)\//);
      const pageNum = pageMatch ? parseInt(pageMatch[1], 10) : 1;
      requestedPages.push(pageNum);

      if (pageNum === 1) {
        const rows = Array.from({ length: 28 }, (_, index) =>
          `${index + 1},"Watchlist Movie ${index + 1}",2025,"https://letterboxd.com/film/wl-${index + 1}/"`
        ).join('\n');
        await route.fulfill({
          status: 200,
          contentType: 'text/csv',
          body: `Position,Name,Year,URL\n${rows}`
        });
      } else if (pageNum === 2) {
        const rows = Array.from({ length: 28 }, (_, index) =>
          `${index + 29},"Watchlist Movie ${index + 29}",2025,"https://letterboxd.com/film/wl-${index + 29}/"`
        ).join('\n');
        await route.fulfill({
          status: 200,
          contentType: 'text/csv',
          body: `Position,Name,Year,URL\n${rows}`
        });
      } else if (pageNum === 3) {
        // Final page with 14 movies (< 28)
        const rows = Array.from({ length: 14 }, (_, index) =>
          `${index + 57},"Watchlist Movie ${index + 57}",2025,"https://letterboxd.com/film/wl-${index + 57}/"`
        ).join('\n');
        await route.fulfill({
          status: 200,
          contentType: 'text/csv',
          body: `Position,Name,Year,URL\n${rows}`
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'text/csv',
          body: 'Position,Name,Year,URL\n'
        });
      }
    });

    await page.fill('#letterboxd-proxy-input', 'https://letterboxd.com/deejus/watchlist/');
    await page.click('#letterboxd-proxy-open');

    await expect(page.locator('#letterboxd-proxy-status')).toContainText('Imported 70 movies successfully!');
    await expect(page.locator('#movie-list li')).toHaveCount(70);
    await expect(page.locator('#movie-list').getByText('Watchlist Movie 1', { exact: true })).toBeVisible();
    await expect(page.locator('#movie-list').getByText('Watchlist Movie 70', { exact: true })).toBeVisible();

    // Verify it requested pages 1, 2, and 3, and did not request page 4 because page 3 had < 28 items
    expect(requestedPages).toEqual([1, 2, 3]);
  });

  test('Letterboxd Watchlist multi-page sync fetches all pages and syncs updates', async ({ page }) => {
    let page2Movies = 10;

    await page.route('**/letterboxd-proxy.cwbcode.workers.dev/**', async route => {
      const requestUrl = decodeURIComponent(route.request().url());
      const pageMatch = requestUrl.match(/\/page\/(\d+)\//);
      const pageNum = pageMatch ? parseInt(pageMatch[1], 10) : 1;

      if (pageNum === 1) {
        const rows = Array.from({ length: 28 }, (_, index) =>
          `${index + 1},"Sync WL Movie ${index + 1}",2025,"https://letterboxd.com/film/sync-wl-${index + 1}/"`
        ).join('\n');
        await route.fulfill({ status: 200, contentType: 'text/csv', body: `Position,Name,Year,URL\n${rows}` });
      } else if (pageNum === 2) {
        const rows = Array.from({ length: page2Movies }, (_, index) =>
          `${index + 29},"Sync WL Movie ${index + 29}",2025,"https://letterboxd.com/film/sync-wl-${index + 29}/"`
        ).join('\n');
        await route.fulfill({ status: 200, contentType: 'text/csv', body: `Position,Name,Year,URL\n${rows}` });
      } else {
        await route.fulfill({ status: 200, contentType: 'text/csv', body: 'Position,Name,Year,URL\n' });
      }
    });

    // 1. Initial import of 28 + 10 = 38 movies (page 2 has 10)
    await page.fill('#letterboxd-proxy-input', 'https://letterboxd.com/deejus/watchlist/');
    await page.click('#letterboxd-proxy-open');
    await expect(page.locator('#movie-list li')).toHaveCount(38);

    // 2. Expand import card and click sync with page 2 now having 15 movies
    page2Movies = 15;
    await page.click('#import-toggle');
    await page.click('#import-sync-btn');

    await expect(page.locator('#letterboxd-proxy-status')).toContainText('Added');
    await expect(page.locator('#movie-list li')).toHaveCount(43);
  });

  test('Board switch restores board-specific winner, controls, and integrations', async ({ page }) => {
    await page.evaluate(() => {
      const boardA = 'board-a';
      const boardB = 'board-b';
      const basePreferences = {
        hideFinalistsBox: false,
        showFinalistsFromStart: false,
        theme: 'default',
        themeColorOverrides: {}
      };
      const makeMovie = (id, name) => ({
        id,
        initialIndex: 0,
        name,
        year: '2024',
        uri: '',
        date: '',
        weight: 1,
        color: '#ff8600'
      });

      localStorage.setItem('letterboxd_workspaces_index', JSON.stringify([
        { id: boardA, name: 'Board A', created: 1, lastModified: 1, letterboxdUrl: '' },
        { id: boardB, name: 'Board B', created: 2, lastModified: 2, letterboxdUrl: '' }
      ]));
      localStorage.setItem('letterboxd_active_workspace_id', boardA);
      localStorage.setItem(`letterboxd_workspace_${boardA}`, JSON.stringify({
        allMovies: [makeMovie('movie-a', 'Movie A')],
        selectedIds: ['movie-a'],
        history: [],
        filterState: { query: '', normalizedQuery: '', showCustoms: true, sortMode: 'original' },
        preferences: basePreferences,
        winnerId: 'movie-a',
        winnerSpinMode: 'one-spin'
      }));
      localStorage.setItem(`letterboxd_workspace_${boardB}`, JSON.stringify({
        allMovies: [makeMovie('movie-b', 'Movie B')],
        selectedIds: ['movie-b'],
        history: [],
        filterState: { query: 'Movie B', normalizedQuery: 'movie b', showCustoms: false, sortMode: 'name-desc' },
        preferences: {
          ...basePreferences,
          theme: 'fantasy',
          discordWebhookUrl: 'https://discord.com/api/webhooks/example',
          radarr: { url: 'http://radarr.local:7878', apiKey: 'secret', searchOnAdd: true }
        },
        winnerId: 'movie-b',
        winnerSpinMode: 'one-spin'
      }));
    });
    await page.reload();

    await expect(page.locator('#reshow-winner-btn')).toBeEnabled();
    await page.click('#settings-open');
    await page.click('#tab-btn-boards');
    await page.selectOption('#workspace-select', 'board-b');

    await expect(page.locator('#reshow-winner-btn')).toBeEnabled();
    await expect(page.locator('body')).toHaveClass(/theme-fantasy/);
    await expect(page.locator('#theme-select')).toHaveValue('fantasy');
    await expect(page.locator('#movie-search')).toHaveValue('Movie B');
    await expect(page.locator('#filter-show-customs')).not.toBeChecked();
    await expect(page.locator('#movie-sort')).toHaveValue('name-desc');
    await expect(page.locator('#discord-webhook-url')).toHaveValue('https://discord.com/api/webhooks/example');
    await expect(page.locator('#radarr-url')).toHaveValue('http://radarr.local:7878');

    const savedWinner = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('letterboxd_workspace_board-b')).winnerId
    );
    expect(savedWinner).toBe('movie-b');
  });

  test('Full restore treats backup text as data and preserves integration settings', async ({ page }) => {
    await page.click('#settings-open');
    await page.click('#tab-btn-discord');
    await page.fill('#discord-webhook-url', 'https://discord.com/api/webhooks/preserved');
    await page.locator('#discord-webhook-url').blur();
    await page.click('#tab-btn-radarr');
    await page.fill('#radarr-url', 'http://radarr.local:7878');
    await page.locator('#radarr-url').blur();
    await page.fill('#radarr-api-key', 'preserved-key');
    await page.locator('#radarr-api-key').blur();

    const injection = '<img id="backup-injection" src="x" onerror="window.__backupXss=true">';
    const backup = {
      version: 1,
      movies: [{
        id: 'restored-movie',
        name: `Movie ${injection}`,
        year: '2025',
        uri: 'javascript:window.__backupLinkXss=true',
        weight: 2,
        color: '#ff8600',
        boosters: [{ name: injection, timestamp: Date.now(), source: 'manual' }]
      }],
      selected: ['restored-movie'],
      history: [{
        id: 'history-1',
        movieId: 'restored-movie',
        name: injection,
        year: '2025',
        timestamp: Date.now(),
        uri: 'javascript:window.__backupLinkXss=true',
        mode: 'one-spin'
      }],
      preferences: { theme: 'default' }
    };

    await page.click('#tab-btn-data');
    await page.fill('#backup-text', JSON.stringify(backup));
    await page.click('#backup-restore');

    await expect(page.locator('#backup-injection')).toHaveCount(0);
    expect(await page.evaluate(() => window.__backupXss)).toBeUndefined();
    await page.click('#tab-btn-discord');
    await expect(page.locator('#discord-webhook-url')).toHaveValue('https://discord.com/api/webhooks/preserved');
    await page.click('#tab-btn-radarr');
    await expect(page.locator('#radarr-api-key')).toHaveValue('preserved-key');
  });

  test('Import is cancelled if the active board changes while fetching', async ({ page }) => {
    let releaseResponse;
    let markRequestStarted;
    const requestStarted = new Promise(resolve => {
      markRequestStarted = resolve;
    });

    await page.route('**/letterboxd-proxy.cwbcode.workers.dev/**', async route => {
      markRequestStarted();
      await new Promise(resolve => {
        releaseResponse = resolve;
      });
      await route.fulfill({
        status: 200,
        contentType: 'text/csv',
        body: 'Position,Name,Year,URL\n1,"Delayed Movie",2025,"https://letterboxd.com/film/delayed-movie/"'
      });
    });

    await page.fill('#letterboxd-proxy-input', 'https://letterboxd.com/user/list/delayed-list/');
    await page.click('#letterboxd-proxy-open');
    await requestStarted;

    await page.click('#settings-open');
    await page.click('#tab-btn-boards');
    await page.fill('#new-board-name', 'Board B');
    await page.locator('#create-board-form button[type="submit"]').click();
    releaseResponse();

    await expect(page.locator('#letterboxd-proxy-status')).toContainText('active board changed');
    await expect(page.locator('#movie-list li.empty')).toBeVisible();
  });

});
