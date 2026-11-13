import { test, expect } from './fixtures.js';

test('Settings contains keyboard focus and navigates the tabs with arrows, Home, and End', async ({ page }) => {
    await page.goto('/');
    const settings = page.getByRole('button', { name: 'Open settings' });
    const dialog = page.getByRole('dialog', { name: 'Settings', exact: true });
    const close = dialog.getByRole('button', { name: 'Close settings' });
    await settings.press('Enter');
    await expect(dialog).toBeVisible();
    await expect(close).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(dialog.getByLabel('Hide Final Contenders box')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(close).toBeFocused();
    await page.keyboard.press('Tab');

    const options = dialog.getByRole('tab', { name: 'Options' });
    const data = dialog.getByRole('tab', { name: 'Data' });
    const advanced = dialog.getByRole('tab', { name: 'Advanced' });
    await expect(options).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(data).toBeFocused();
    await expect(data).toHaveAttribute('aria-selected', 'true');
    await expect(dialog.getByRole('tabpanel', { name: 'Data' })).toBeVisible();
    await expect(options).toHaveAttribute('tabindex', '-1');
    await page.keyboard.press('End');
    await expect(advanced).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(options).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(advanced).toBeFocused();
    await page.keyboard.press('Home');
    await expect(options).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(dialog.locator('.theme-picker__summary')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(settings).toBeFocused();
});

test('Manage wheels restores focus after closing a nested rename dialog and Settings', async ({ page }) => {
    await page.goto('/');
    const manage = page.getByRole('button', { name: 'Manage wheels' });
    await manage.press('Enter');
    const settings = page.getByRole('dialog', { name: 'Settings', exact: true });
    await expect(settings.getByRole('tab', { name: 'Saved wheels' })).toHaveAttribute('aria-selected', 'true');
    await expect(settings.getByRole('searchbox', { name: 'Search saved wheels' })).toBeFocused();

    const rename = settings.getByRole('button', { name: 'Rename', exact: true });
    await rename.press('Enter');
    const prompt = page.getByRole('dialog', { name: 'Rename wheel' });
    await expect(prompt.getByRole('textbox', { name: 'Wheel name' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(prompt).toBeHidden();
    await expect(rename).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(settings).toBeHidden();
    await expect(manage).toBeFocused();
});
