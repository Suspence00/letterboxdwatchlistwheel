import { test as base, expect } from '@playwright/test';

// Keep the suite offline. Individual tests register their import/poster mocks
// after this fallback, so those routes take precedence.
export const test = base.extend({
    page: async ({ page, baseURL }, use) => {
        const appOrigin = new URL(baseURL).origin;
        await page.route('**/*', route => {
            const url = new URL(route.request().url());
            if (url.origin === appOrigin) return route.continue();
            if (url.hostname === 'www.omdbapi.com') {
                return route.fulfill({ json: { Response: 'False' } });
            }
            return route.abort();
        });
        await use(page);
    }
});

export { expect };
