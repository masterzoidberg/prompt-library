import { expect, test, type Page } from '@playwright/test';

const runtimeErrors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  runtimeErrors.set(page, errors);
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], {
    origin: 'http://127.0.0.1:4173',
  });
});

test.afterEach(async ({ page }, testInfo) => {
  const errors = runtimeErrors.get(page) ?? [];
  if (errors.length > 0) {
    await testInfo.attach('browser-errors', {
      body: errors.join('\n'),
      contentType: 'text/plain',
    });
  }
  expect(errors, 'browser console and page errors').toEqual([]);
});

async function openApp(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('searchbox', { name: 'Search prompts' })).toBeVisible();
}

async function createPrompt(page: Page, title: string) {
  await page.getByRole('banner').getByRole('button', { name: 'New prompt', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'New prompt' });
  await dialog.getByLabel('Title', { exact: true }).fill(title);
  await dialog.getByLabel('Content', { exact: true }).fill('Accessibility audit content');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('article', { name: `Prompt: ${title}` })).toBeVisible();
}

async function findAccessibilityIssues(page: Page) {
  return page.evaluate(() => {
    const issues: string[] = [];
    const getLabel = (element: Element) => {
      const ariaLabel = element.getAttribute('aria-label')?.trim();
      if (ariaLabel) return ariaLabel;
      const labelledBy = element.getAttribute('aria-labelledby');
      if (labelledBy) {
        const text = labelledBy
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent?.trim() ?? '')
          .join(' ')
          .trim();
        if (text) return text;
      }
      return element.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    };

    document.querySelectorAll('button').forEach((button) => {
      if (!getLabel(button)) issues.push('button without an accessible name');
    });

    document.querySelectorAll('input, textarea, select').forEach((control) => {
      const hasExplicitLabel = Boolean(
        control.getAttribute('aria-label') ||
          control.getAttribute('aria-labelledby') ||
          (control.id && document.querySelector(`label[for="${CSS.escape(control.id)}"]`)) ||
          control.closest('label'),
      );
      if (!hasExplicitLabel) issues.push(`${control.tagName.toLowerCase()} without a label`);
    });

    document.querySelectorAll('[role="dialog"]').forEach((dialog) => {
      if (dialog.getAttribute('aria-modal') !== 'true') issues.push('dialog without aria-modal');
      if (!getLabel(dialog)) issues.push('dialog without an accessible name');
    });

    if (document.querySelector('button button, button [role="button"], [role="button"] button')) {
      issues.push('nested interactive button semantics');
    }
    return issues;
  });
}

test('passes the keyboard and structural accessibility audit on desktop and at 375px', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openApp(page);
  await createPrompt(page, 'Accessibility audit prompt');

  const newPromptButton = page.getByRole('banner').getByRole('button', { name: 'New prompt', exact: true });
  await newPromptButton.click();
  const newPromptDialog = page.getByRole('dialog', { name: 'New prompt' });
  await expect(newPromptDialog.getByLabel('Title', { exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(newPromptButton).toBeFocused();

  const card = page.getByRole('article', { name: 'Prompt: Accessibility audit prompt' });
  const openButton = card.getByRole('button', { name: 'Open prompt: Accessibility audit prompt' });
  await openButton.click();
  const detailDialog = page.getByRole('dialog', { name: 'Prompt detail: Accessibility audit prompt' });
  const closeDialog = detailDialog.getByRole('button', { name: 'Close dialog' });
  await expect(closeDialog).toBeFocused();
  await detailDialog.getByRole('button').last().focus();
  await page.keyboard.press('Tab');
  await expect(closeDialog).toBeFocused();
  expect(await findAccessibilityIssues(page)).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(openButton).toBeFocused();

  await page.setViewportSize({ width: 375, height: 800 });
  await page.reload();
  await expect(page.getByRole('searchbox', { name: 'Search prompts' })).toBeVisible();

  const skipLink = page.getByRole('link', { name: 'Skip to main content' });
  await skipLink.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('main#main')).toBeFocused();

  const navigationTrigger = page.getByRole('button', { name: 'Open navigation' });
  await navigationTrigger.click();
  const drawer = page.getByRole('dialog', { name: 'Navigation' });
  const closeNavigation = drawer.getByRole('button', { name: 'Close navigation' });
  await expect(closeNavigation).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(drawer.getByRole('button', { name: 'Settings', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(closeNavigation).toBeFocused();
  expect(await findAccessibilityIssues(page)).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(navigationTrigger).toBeFocused();
});
