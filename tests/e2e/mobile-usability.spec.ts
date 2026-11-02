import { expect, test, type Locator, type Page } from '@playwright/test';

async function openApp(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('searchbox', { name: 'Search prompts' })).toBeVisible();
}

async function expectNoHorizontalOverflow(page: Page, width: number) {
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth, `document fits within ${width}px viewport`).toBeLessThanOrEqual(width);
}

async function expectTouchHeight(target: Locator, name: string) {
  const height = await target.evaluate((element) => element.getBoundingClientRect().height);
  expect(height, `${name} touch target height`).toBeGreaterThanOrEqual(44);
}

async function openNavigation(page: Page) {
  await page.getByRole('button', { name: 'Open navigation' }).click();
  return page.getByRole('dialog', { name: 'Navigation' });
}

test.beforeEach(async ({ page }) => {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], {
    origin: 'http://127.0.0.1:4173',
  });
});

test('375px phone supports prompt creation, navigation, and touch actions without horizontal scrolling', async ({ page }) => {
  const width = 375;
  await page.setViewportSize({ width, height: 812 });
  await openApp(page);

  const header = page.getByRole('banner');
  const search = header.getByRole('searchbox', { name: 'Search prompts' });
  const searchWidth = await search.evaluate((element) => element.getBoundingClientRect().width);
  expect(searchWidth, 'search has useful width on a phone').toBeGreaterThanOrEqual(300);
  await expectTouchHeight(header.getByRole('button', { name: 'Open navigation' }), 'open navigation');
  await expectTouchHeight(header.getByRole('button', { name: 'New prompt', exact: true }), 'new prompt');
  await expectTouchHeight(header.getByRole('button', { name: 'Filter prompts' }), 'filter');
  await expectTouchHeight(header.getByRole('button', { name: 'Change sort order' }), 'sort');
  await expectNoHorizontalOverflow(page, width);

  const title = `Mobile prompt ${'with a deliberately long title '.repeat(5)}`;
  const content = `${'UNBROKENPROMPTTOKEN'.repeat(48)}\nReadable prose stays wrapped on a phone.`;
  await header.getByRole('button', { name: 'New prompt', exact: true }).click();
  const form = page.getByRole('dialog', { name: 'New prompt' });
  await form.getByLabel('Title', { exact: true }).fill(title);
  await form.getByLabel('Content', { exact: true }).fill(content);

  const folderName = 'Mobile review folder for responsive layout checks '.repeat(2).trim();
  const folder = form.getByRole('combobox', { name: 'Folder' });
  await folder.fill(folderName);
  await form.getByRole('option', { name: `Create "${folderName}"` }).click();

  const tagName = 'Mobile usability tag with long metadata text '.repeat(2).trim();
  const tags = form.getByRole('combobox', { name: 'Tags' });
  await tags.fill(tagName);
  await form.getByRole('option', { name: `Create "${tagName}"` }).click();
  for (const extraTag of ['Second mobile tag', 'Third mobile tag', 'Fourth mobile tag']) {
    await tags.fill(extraTag);
    await form.getByRole('option', { name: `Create "${extraTag}"` }).click();
  }
  await form.getByRole('button', { name: 'Save', exact: true }).click();

  const card = page.getByRole('article', { name: `Prompt: ${title}`, exact: true });
  await expect(card).toBeVisible();
  await expect(card.locator('pre.prompt-content')).toBeVisible();
  await expectNoHorizontalOverflow(page, width);
  const cardContent = card.locator('pre.prompt-content');
  const contentBounds = await cardContent.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(contentBounds.scrollWidth, 'unbroken prompt content wraps inside the card').toBeLessThanOrEqual(
    contentBounds.clientWidth,
  );

  const copy = card.getByRole('button', { name: 'Copy prompt' });
  await expectTouchHeight(copy, 'copy');
  await copy.click();
  await expect
    .poll(async () => (await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n'))
    .toBe(content);

  await card.getByRole('button', { name: `Open prompt: ${title}` }).click();
  const detail = page.getByRole('dialog', { name: `Prompt detail: ${title}` });
  const closeDetail = detail.getByRole('button', { name: 'Close dialog' });
  await expectTouchHeight(closeDetail, 'dialog close');
  await expect(detail.locator('pre.prompt-content')).toContainText('Readable prose stays wrapped on a phone.');
  await expectNoHorizontalOverflow(page, width);
  await closeDetail.click();

  await search.fill('Mobile prompt');
  await expect(card).toBeVisible();
  await search.fill('Readable prose stays wrapped');
  await expect(card).toBeVisible();
  await search.clear();

  await header.getByRole('button', { name: 'Filter prompts' }).click();
  await page.getByRole('menuitem', { name: 'Prompt', exact: true }).click();
  await expect(card).toBeVisible();
  await header.getByRole('button', { name: 'Change sort order' }).click();
  await page.getByRole('menuitem', { name: 'Alphabetical', exact: true }).click();

  const nav = await openNavigation(page);
  await nav.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Navigation' })).not.toBeVisible();
  await page.getByRole('dialog', { name: 'Settings' }).getByRole('button', { name: 'Cancel', exact: true }).click();

  const createNav = await openNavigation(page);
  await createNav.getByRole('button', { name: 'New bundle', exact: true }).click();
  const bundleDialog = page.getByRole('dialog', { name: 'New bundle' });
  const createBundleBounds = await bundleDialog.evaluate((element) => ({
    left: element.getBoundingClientRect().left,
    right: element.getBoundingClientRect().right,
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(createBundleBounds.left).toBeGreaterThanOrEqual(-1);
  expect(createBundleBounds.right).toBeLessThanOrEqual(width + 1);
  expect(createBundleBounds.scrollWidth).toBeLessThanOrEqual(createBundleBounds.clientWidth);
  await bundleDialog.getByLabel('Name', { exact: true }).fill('Phone bundle');
  await bundleDialog.getByLabel(`Include prompt 1: ${title}`).check();
  await bundleDialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Phone bundle', exact: true })).toBeVisible();
  await page.getByRole('dialog', { name: 'Navigation' }).getByRole('button', { name: 'Close navigation' }).click();

  const optionsNav = await openNavigation(page);
  const folderOptions = optionsNav.getByRole('button', { name: `Folder options for ${folderName}` });
  const tagOptions = optionsNav.getByRole('button', { name: `Tag options for ${tagName}` });
  const bundleOptions = optionsNav.getByRole('button', { name: 'Bundle options for Phone bundle' });
  await expect(folderOptions).toHaveCount(1);
  await expect(folderOptions).toHaveCSS('opacity', '1');
  await expect(tagOptions).toHaveCSS('opacity', '1');
  await expect(bundleOptions).toHaveCSS('opacity', '1');
  await folderOptions.click();
  await page.getByRole('menuitem', { name: 'Rename', exact: true }).click();
  const renameFolder = page.getByRole('dialog', { name: 'Rename folder' });
  await expect(renameFolder).toBeVisible();
  await expect(optionsNav).not.toBeVisible();
  await renameFolder.getByRole('button', { name: 'Close dialog' }).click();

  const tagNav = await openNavigation(page);
  await tagNav.getByRole('button', { name: `Tag options for ${tagName}` }).click();
  await page.getByRole('menuitem', { name: 'Rename', exact: true }).click();
  const renameTag = page.getByRole('dialog', { name: 'Rename tag' });
  await expect(renameTag).toBeVisible();
  await expect(tagNav).not.toBeVisible();
  await renameTag.getByRole('button', { name: 'Close dialog' }).click();

  const bundleNav = await openNavigation(page);
  await bundleNav.getByRole('button', { name: 'Bundle options for Phone bundle' }).click();
  await page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
  const editBundle = page.getByRole('dialog', { name: 'Edit bundle' });
  await expect(editBundle).toBeVisible();
  await expect(bundleNav).not.toBeVisible();
  const editBundleBounds = await editBundle.evaluate((element) => ({
    left: element.getBoundingClientRect().left,
    right: element.getBoundingClientRect().right,
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(editBundleBounds.left).toBeGreaterThanOrEqual(-1);
  expect(editBundleBounds.right).toBeLessThanOrEqual(width + 1);
  expect(editBundleBounds.scrollWidth).toBeLessThanOrEqual(editBundleBounds.clientWidth);
  await editBundle.getByRole('button', { name: 'Cancel', exact: true }).click();

  for (const destination of ['Favorites', 'Recent', 'Most Used', 'All Prompts', folderName, tagName, 'Phone bundle']) {
    const drawer = await openNavigation(page);
    await drawer.getByRole('button', { name: destination, exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Navigation' })).not.toBeVisible();
  }
});

test('430px phone keeps settings and large typography dialogs reachable with hostile text', async ({ page }) => {
  const width = 430;
  await page.setViewportSize({ width, height: 844 });
  await openApp(page);

  const drawer = await openNavigation(page);
  await drawer.getByRole('button', { name: 'Settings', exact: true }).click();
  const settings = page.getByRole('dialog', { name: 'Settings' });
  await expect(settings).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Navigation' })).not.toBeVisible();
  await settings.getByLabel('Interface font', { exact: true }).selectOption('serif');
  await settings.getByRole('slider', { name: 'Interface size' }).press('End');
  await settings.getByLabel('Prompt font', { exact: true }).selectOption('monospace');
  await settings.getByRole('slider', { name: 'Prompt size' }).press('End');
  await settings.getByLabel('Prompt spacing', { exact: true }).selectOption('relaxed');
  await expect(settings.locator('#settings-interface-size-value')).toHaveText('20px');
  await expect(settings.locator('#settings-prompt-size-value')).toHaveText('24px');
  const exportButton = settings.getByRole('button', { name: 'Export', exact: true });
  await exportButton.scrollIntoViewIfNeeded();
  await expect(exportButton).toBeVisible();
  await settings.getByRole('button', { name: 'Save', exact: true }).scrollIntoViewIfNeeded();
  await settings.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(settings).not.toBeVisible();

  const title = `Serif interface long title ${'Mobile responsive workflow '.repeat(5)}`;
  const content = `${'HOSTILEUNBROKENTEXT'.repeat(80)}\nLong content remains readable and contained.`;
  await page.getByRole('banner').getByRole('button', { name: 'New prompt', exact: true }).click();
  const form = page.getByRole('dialog', { name: 'New prompt' });
  await expect(form).toBeVisible();
  await form.getByLabel('Title', { exact: true }).fill(title);
  await form.getByLabel('Content', { exact: true }).fill(content);
  await form.getByRole('button', { name: 'Save', exact: true }).click();

  const card = page.getByRole('article', { name: `Prompt: ${title}`, exact: true });
  await expect(card).toBeVisible();
  await expect(card.locator('pre.prompt-content')).toHaveCSS('font-size', '24px');
  await card.getByRole('button', { name: `Open prompt: ${title}` }).click();
  const detail = page.getByRole('dialog', { name: `Prompt detail: ${title}` });
  await expect(detail).toBeVisible();
  await expect(detail.locator('pre.prompt-content')).toHaveCSS('font-size', '24px');
  await expectNoHorizontalOverflow(page, width);
  const dialogBounds = await detail.evaluate((element) => ({
    bottom: element.getBoundingClientRect().bottom,
    viewportHeight: window.innerHeight,
  }));
  expect(dialogBounds.bottom).toBeLessThanOrEqual(dialogBounds.viewportHeight + 1);
  await detail.getByRole('button', { name: 'Close dialog' }).click();

  for (const revision of [1, 2, 3]) {
    await card.getByRole('button', { name: 'Prompt actions' }).click();
    await page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
    const editPrompt = page.getByRole('dialog', { name: 'Edit prompt' });
    await editPrompt.getByLabel('Content', { exact: true }).fill(`${content}\nSaved revision ${revision}`);
    await editPrompt.getByRole('button', { name: 'Save', exact: true }).click();
  }

  await card.getByRole('button', { name: 'Prompt actions' }).click();
  await page.getByRole('menuitem', { name: 'Version history', exact: true }).click();
  const history = page.getByRole('dialog', { name: `Version history: ${title}` });
  const savedVersions = history.getByRole('complementary', { name: 'Saved versions' });
  await expect(savedVersions.getByRole('button', { name: /Version 1/i })).toBeVisible();
  await expect.poll(() => savedVersions.getByRole('button').count()).toBeGreaterThanOrEqual(3);
  await page.addStyleTag({
    content: ':root { --app-viewport-height: 600px !important; --app-viewport-center-y: 300px !important; }',
  });
  await expect(history).toHaveCSS('max-height', '568px');
  const historyBounds = await history.evaluate((element) => ({
    top: element.getBoundingClientRect().top,
    bottom: element.getBoundingClientRect().bottom,
  }));
  expect(historyBounds.top).toBeGreaterThanOrEqual(-1);
  expect(historyBounds.bottom).toBeLessThanOrEqual(601);
});

test('768px portrait tablet keeps bundle editing and button reordering inside the viewport', async ({ page }) => {
  const width = 768;
  await page.setViewportSize({ width, height: 1024 });
  await openApp(page);

  const titles = ['Tablet first prompt', `${'UNBROKEN'.repeat(40)} second prompt`];
  for (const title of titles) {
    await page.getByRole('banner').getByRole('button', { name: 'New prompt', exact: true }).click();
    const form = page.getByRole('dialog', { name: 'New prompt' });
    await form.getByLabel('Title', { exact: true }).fill(title);
    await form.getByLabel('Content', { exact: true }).fill(`${'long prompt content '.repeat(40)}${'X'.repeat(120)}`);
    await form.getByRole('button', { name: 'Save', exact: true }).click();
  }

  const drawer = await openNavigation(page);
  await drawer.getByRole('button', { name: 'New bundle', exact: true }).click();
  const createBundle = page.getByRole('dialog', { name: 'New bundle' });
  await createBundle.getByLabel('Name', { exact: true }).fill('Tablet bundle');
  await createBundle.getByRole('checkbox', { name: /Tablet first prompt$/ }).check();
  await createBundle.getByRole('checkbox', { name: /second prompt$/ }).check();
  await createBundle.getByRole('button', { name: 'Save', exact: true }).click();

  const nav = page.getByRole('dialog', { name: 'Navigation' });
  await nav.getByRole('button', { name: 'Tablet bundle', exact: true }).click();
  await expect(nav).not.toBeVisible();
  const bundlePanel = page.getByRole('region', { name: 'Current asset' });
  await expect(bundlePanel).toBeVisible();
  const moveUp = page.getByRole('button', { name: 'Move bundle item 2 up' });
  await expectTouchHeight(moveUp, 'bundle reorder');
  await moveUp.click();
  await expect(page.locator('ol > li').first()).toContainText(titles[1]);
  await expectNoHorizontalOverflow(page, width);

  await page.getByRole('button', { name: 'Edit bundle', exact: true }).click();
  const editBundle = page.getByRole('dialog', { name: 'Edit bundle' });
  await expect(editBundle).toBeVisible();
  await expectNoHorizontalOverflow(page, width);
  const dialogBounds = await editBundle.evaluate((element) => ({
    right: element.getBoundingClientRect().right,
    bottom: element.getBoundingClientRect().bottom,
  }));
  expect(dialogBounds.right).toBeLessThanOrEqual(width + 1);
  expect(dialogBounds.bottom).toBeLessThanOrEqual(1025);
  await expect(editBundle.getByRole('button', { name: 'Save', exact: true })).toBeVisible();
  await editBundle.getByRole('button', { name: 'Cancel', exact: true }).click();

  const settingsNav = await openNavigation(page);
  await settingsNav.getByRole('button', { name: 'Settings', exact: true }).click();
  const settings = page.getByRole('dialog', { name: 'Settings' });
  await expect(settings.getByRole('slider', { name: 'Interface size' })).toBeVisible();
  const exportButton = settings.getByRole('button', { name: 'Export', exact: true });
  await exportButton.scrollIntoViewIfNeeded();
  await expect(exportButton).toBeVisible();
  await expectNoHorizontalOverflow(page, width);
  await settings.getByRole('button', { name: 'Cancel', exact: true }).click();
});

test('desktop keeps the compact horizontal top bar and prompt workflow', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openApp(page);

  const header = page.getByRole('banner');
  await expect(page.getByRole('navigation', { name: 'Library navigation' })).toBeVisible();
  await expect(header.getByRole('button', { name: 'Open navigation' })).toBeHidden();
  const headerHeight = await header.evaluate((element) => element.getBoundingClientRect().height);
  expect(headerHeight).toBe(56);

  await header.getByRole('button', { name: 'New prompt', exact: true }).click();
  const form = page.getByRole('dialog', { name: 'New prompt' });
  await form.getByLabel('Title', { exact: true }).fill('Desktop mobile-pass smoke');
  await form.getByLabel('Content', { exact: true }).fill('Desktop remains usable.');
  await form.getByRole('button', { name: 'Save', exact: true }).click();

  const card = page.getByRole('article', { name: 'Prompt: Desktop mobile-pass smoke', exact: true });
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Copy prompt' }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('Desktop remains usable.');
  await card.getByRole('button', { name: 'Open prompt: Desktop mobile-pass smoke' }).click();
  await expect(page.getByRole('dialog', { name: 'Prompt detail: Desktop mobile-pass smoke' })).toContainText(
    'Desktop remains usable.',
  );
});
