import { expect, test, type Page } from '@playwright/test';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const runtimeErrors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  runtimeErrors.set(page, errors);
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`));

  // Playwright creates a fresh browser context per test, isolating IndexedDB state.
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
  await expect(page.getByRole('heading', { name: 'Prompt Library' })).toBeVisible();
}

function promptCard(page: Page, title: string) {
  return page.getByRole('article', { name: `Prompt: ${title}`, exact: true });
}

async function createPrompt(page: Page, title: string, content: string) {
  await page.locator('header').getByRole('button', { name: 'New prompt' }).click();
  const dialog = page.getByRole('dialog', { name: 'New prompt' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Title', { exact: true }).fill(title);
  await dialog.getByLabel('Content', { exact: true }).fill(content);
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(promptCard(page, title)).toBeVisible();
}

async function openPromptActions(page: Page, title: string) {
  const card = promptCard(page, title);
  await card.getByRole('button', { name: 'Prompt actions' }).click();
  return card;
}

test('opens the library, creates, edits, and copies a prompt', async ({ page }) => {
  await openApp(page);
  await createPrompt(page, 'E2E prompt', 'Line one\n**Markdown** content');

  const createdCard = promptCard(page, 'E2E prompt');
  await createdCard.getByRole('button', { name: 'Open prompt: E2E prompt' }).click();
  const detailDialog = page.getByRole('dialog', { name: 'Prompt detail: E2E prompt' });
  await expect(detailDialog.getByText(/Line one/)).toBeVisible();
  await detailDialog.getByRole('button', { name: 'Edit prompt' }).click();
  const editDialog = page.getByRole('dialog', { name: 'Edit prompt' });
  await editDialog.getByLabel('Title', { exact: true }).fill('Edited E2E prompt');
  await editDialog.getByLabel('Content', { exact: true }).fill('Edited content');
  await editDialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(promptCard(page, 'Edited E2E prompt')).toBeVisible();

  await promptCard(page, 'Edited E2E prompt')
    .getByRole('button', { name: 'Copy prompt', exact: true })
    .click();
  await expect(page.getByText('Copied to clipboard').last()).toBeVisible();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('Edited content');
});

test('opens and uses the command palette from the keyboard', async ({ page }) => {
  await openApp(page);
  await createPrompt(page, 'Palette E2E prompt', 'Hello {{NAME}}');

  const mainSearch = page.getByRole('searchbox', { name: 'Search prompts' });
  await mainSearch.focus();
  await page.keyboard.press('Control+Shift+P');
  const palette = page.getByRole('dialog', { name: 'Command palette' });
  const search = palette.getByRole('searchbox', { name: 'Command palette search' });
  await expect(search).toBeFocused();
  await search.fill('Palette E2E prompt');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');

  await expect(page.getByRole('dialog', { name: 'Prompt detail: Palette E2E prompt' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+Shift+P');

  const reopenedPalette = page.getByRole('dialog', { name: 'Command palette' });
  const reopenedSearch = reopenedPalette.getByRole('searchbox', { name: 'Command palette search' });
  await expect(reopenedSearch).toBeFocused();
  await reopenedSearch.fill('Palette E2E prompt');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  const fillButton = reopenedPalette.getByRole('button', { name: 'Fill variables: Palette E2E prompt' });
  await expect(fillButton).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page.getByRole('dialog', { name: 'Fill variables: Palette E2E prompt' })).toBeVisible();
});

test('supports documented prompt shortcuts and protects editable text', async ({ page }) => {
  await openApp(page);
  await createPrompt(page, 'Keyboard E2E prompt', 'Keyboard content');

  await page.keyboard.press('Control+N');
  const newDialog = page.getByRole('dialog', { name: 'New prompt' });
  await expect(newDialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(newDialog).not.toBeVisible();

  const card = promptCard(page, 'Keyboard E2E prompt');
  await card.focus();
  await page.keyboard.press('Enter');
  const detailDialog = page.getByRole('dialog', { name: 'Prompt detail: Keyboard E2E prompt' });
  await expect(detailDialog).toBeVisible();
  await page.keyboard.press('Escape');

  await card.focus();
  await page.keyboard.press('e');
  const editDialog = page.getByRole('dialog', { name: 'Edit prompt' });
  const editContent = editDialog.getByLabel('Content', { exact: true });
  await editContent.fill('Updated keyboard content');
  await editContent.focus();
  await page.keyboard.press('/');
  await expect(editContent).toBeFocused();
  await page.keyboard.press('Control+Enter');
  await expect(promptCard(page, 'Keyboard E2E prompt')).toContainText('Updated keyboard content/');

  const updatedCard = promptCard(page, 'Keyboard E2E prompt');
  await updatedCard.focus();
  await page.keyboard.press('c');
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('Updated keyboard content/');

  await updatedCard.focus();
  await page.keyboard.press('d');
  await expect(promptCard(page, 'Copy of Keyboard E2E prompt')).toBeVisible();

  await updatedCard.focus();
  await page.keyboard.press('f');
  await page.getByRole('button', { name: 'Favorites', exact: true }).click();
  await expect(promptCard(page, 'Keyboard E2E prompt')).toBeVisible();
});

test('compares, copies, duplicates, and reversibly restores prompt history', async ({ page }) => {
  await openApp(page);
  await createPrompt(page, 'History prompt', 'Original line\nKeep this line');

  await openPromptActions(page, 'History prompt');
  await page.getByRole('menuitem', { name: 'Edit' }).click();
  const editDialog = page.getByRole('dialog', { name: 'Edit prompt' });
  await editDialog.getByLabel('Title', { exact: true }).fill('Edited history prompt');
  await editDialog.getByLabel('Content', { exact: true }).fill('Updated line\nKeep this line');
  await editDialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(promptCard(page, 'Edited history prompt')).toBeVisible();

  await openPromptActions(page, 'Edited history prompt');
  await page.getByRole('menuitem', { name: 'Version history' }).click();
  const historyDialog = page.getByRole('dialog', { name: 'Version history: Edited history prompt' });
  await expect(historyDialog).toBeVisible();
  const savedVersions = historyDialog.getByRole('complementary', { name: 'Saved versions' });
  await expect(savedVersions.getByRole('button', { name: /Version 1/i })).toBeVisible();
  await expect(historyDialog.getByRole('button', { name: 'Close dialog' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(savedVersions.getByRole('button', { name: /Version 1/i })).toBeFocused();
  await expect(historyDialog.getByText('Original line')).toBeVisible();
  await expect(historyDialog.getByText('Updated line')).toBeVisible();
  await expect(historyDialog.getByText(/− Removed/)).toBeVisible();
  await expect(historyDialog.getByText(/\+ Added/)).toBeVisible();

  await historyDialog.getByRole('button', { name: 'Copy version 1' }).click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toMatch(/Original line\r?\nKeep this line/);

  await historyDialog.getByRole('button', { name: 'Duplicate version 1' }).click();
  await expect(page.getByText('Duplicated “Copy of History prompt”')).toBeVisible();

  await historyDialog.getByRole('button', { name: 'Restore version 1' }).click();
  const restorePreview = historyDialog.getByRole('alert');
  await expect(restorePreview).toContainText('Updated line');
  await expect(restorePreview).toContainText('Original line');
  await expect(restorePreview).toContainText('The current authored fields will be saved as a new reversible restore version.');
  await restorePreview.getByRole('button', { name: 'Confirm restore version 1' }).click();

  await expect(promptCard(page, 'History prompt')).toBeVisible();
  await expect(promptCard(page, 'History prompt')).toContainText('Original line');
  await expect(promptCard(page, 'Edited history prompt')).not.toBeVisible();

  await openPromptActions(page, 'History prompt');
  await page.getByRole('menuitem', { name: 'Version history' }).click();
  const restoredHistoryDialog = page.getByRole('dialog', { name: 'Version history: History prompt' });
  const restoredSavedVersions = restoredHistoryDialog.getByRole('complementary', { name: 'Saved versions' });
  await expect(restoredSavedVersions.getByRole('button', { name: /Version 2/i })).toBeVisible();
  await restoredSavedVersions.getByRole('button', { name: /Version 2/i }).click();
  await restoredHistoryDialog.getByRole('button', { name: 'Restore version 2' }).click();
  await expect(restoredHistoryDialog.getByRole('alert')).toContainText('Edited history prompt');
  await restoredHistoryDialog.getByRole('alert').getByRole('button', { name: 'Confirm restore version 2' }).click();

  await expect(promptCard(page, 'Edited history prompt')).toBeVisible();
  await expect(promptCard(page, 'Edited history prompt')).toContainText('Updated line');
  await expect(promptCard(page, 'History prompt')).not.toBeVisible();
});

test('edits metadata and filters by type and target tool', async ({ page }) => {
  await openApp(page);
  await createPrompt(page, 'Template E2E prompt', 'Template content');
  await createPrompt(page, 'Coding E2E prompt', 'Coding content');

  await openPromptActions(page, 'Template E2E prompt');
  await page.getByRole('menuitem', { name: 'Edit' }).click();
  const templateDialog = page.getByRole('dialog', { name: 'Edit prompt' });
  await templateDialog.locator('#prompt-type').selectOption('template');
  await templateDialog.getByLabel('ChatGPT', { exact: true }).check();
  await templateDialog.getByLabel('Codex', { exact: true }).check();
  await templateDialog.getByLabel('Notes').fill('Use this for reusable drafts.');
  await templateDialog.getByRole('button', { name: 'Save', exact: true }).click();

  const templateCard = promptCard(page, 'Template E2E prompt');
  await expect(templateCard.getByText('Type: Template')).toBeVisible();
  await expect(templateCard.getByText('Target: ChatGPT')).toBeVisible();
  await expect(templateCard.getByText('Target: Codex')).toBeVisible();
  await expect(templateCard.getByText('Use this for reusable drafts.')).toBeVisible();

  await openPromptActions(page, 'Coding E2E prompt');
  await page.getByRole('menuitem', { name: 'Edit' }).click();
  const codingDialog = page.getByRole('dialog', { name: 'Edit prompt' });
  await codingDialog.locator('#prompt-type').selectOption('coding-task');
  await codingDialog.getByLabel('Codex', { exact: true }).check();
  await codingDialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(promptCard(page, 'Coding E2E prompt').getByText('Target: Codex')).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Prompt Library' })).toBeVisible();
  await page.locator('header').getByRole('button', { name: 'Filter prompts' }).click();
  await page.getByRole('menuitem', { name: 'Template', exact: true }).click();
  await expect(promptCard(page, 'Template E2E prompt')).toBeVisible();
  await expect(promptCard(page, 'Coding E2E prompt')).not.toBeVisible();

  await page.locator('header').getByRole('button', { name: 'Filter prompts' }).click();
  await page.getByRole('menuitem', { name: 'Codex', exact: true }).click();
  await expect(promptCard(page, 'Template E2E prompt')).toBeVisible();
  await expect(promptCard(page, 'Coding E2E prompt')).toBeVisible();
});

test('creates and uses an ordered bundle', async ({ page }) => {
  await openApp(page);
  await createPrompt(page, 'Bundle first prompt', 'First bundle content');
  await createPrompt(page, 'Bundle second prompt', 'Hello {{NAME}}');

  await page.getByRole('button', { name: 'New bundle', exact: true }).click();
  const bundleDialog = page.getByRole('dialog', { name: 'New bundle' });
  await bundleDialog.getByLabel('Name', { exact: true }).fill('Daily flow');
  await bundleDialog.getByLabel(/Include prompt \d+: Bundle first prompt/).check();
  await bundleDialog.getByLabel(/Include prompt \d+: Bundle second prompt/).check();
  await bundleDialog.getByRole('button', { name: 'Save', exact: true }).click();

  await page.getByRole('button', { name: 'Daily flow', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Daily flow' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Bundle first prompt' })).toBeVisible();

  await page.getByRole('button', { name: 'Edit bundle' }).click();
  const editBundleDialog = page.getByRole('dialog', { name: 'Edit bundle' });
  await editBundleDialog.getByLabel(/Description/).fill('Use these prompts in order.');
  await editBundleDialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Use these prompts in order.')).toBeVisible();

  await page.getByRole('button', { name: 'Next asset' }).click();
  await expect(page.getByRole('heading', { name: 'Bundle second prompt' })).toBeVisible();

  await page.getByRole('button', { name: 'Open current asset' }).click();
  const currentDetailDialog = page.getByRole('dialog', { name: 'Prompt detail: Bundle second prompt' });
  await expect(currentDetailDialog).toBeVisible();
  await currentDetailDialog.getByRole('button', { name: 'Edit prompt' }).click();
  await page.getByRole('dialog', { name: 'Edit prompt' }).getByRole('button', { name: 'Cancel' }).click();

  await page.getByRole('button', { name: 'Copy current asset' }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toMatch(/Hello \{\{NAME\}\}/);

  await page.getByRole('button', { name: 'Fill current asset' }).click();
  const fillDialog = page.getByRole('dialog', { name: 'Fill variables: Bundle second prompt' });
  await fillDialog.getByLabel('Value for NAME', { exact: true }).fill('Ada');
  await expect(fillDialog.locator('pre')).toHaveText('Hello Ada');
  await fillDialog.getByRole('button', { name: 'Copy rendered', exact: true }).click();
  await expect(page.getByText('Copied rendered prompt').last()).toBeVisible();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toMatch(/Hello Ada/);

  await page.getByRole('button', { name: 'Select bundle item 2: Bundle second prompt' }).click();
  const moveSecondUp = page.getByRole('button', { name: 'Move bundle item 2 up' });
  await moveSecondUp.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('ol > li').first()).toContainText('Bundle second prompt');
  await expect(page.locator('ol > li').nth(1)).toContainText('Bundle first prompt');

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Prompt Library' })).toBeVisible();
  await page.getByRole('button', { name: 'Daily flow', exact: true }).click();
  await expect(page.locator('ol > li').first()).toContainText('Bundle second prompt');
  await expect(page.locator('ol > li').nth(1)).toContainText('Bundle first prompt');
});

test('fills and copies rendered variables without changing the master prompt', async ({ page }) => {
  await openApp(page);
  await createPrompt(page, 'Variable E2E prompt', 'Hello {{NAME}}\nRole: {{ROLE}}');

  await openPromptActions(page, 'Variable E2E prompt');
  await page.getByRole('menuitem', { name: 'Edit' }).click();
  const editDialog = page.getByRole('dialog', { name: 'Edit prompt' });
  await editDialog.getByLabel('Default for NAME', { exact: true }).fill('Ada');
  await editDialog.getByLabel('Default for ROLE', { exact: true }).fill('writer');
  await editDialog.getByRole('button', { name: 'Save', exact: true }).click();

  await openPromptActions(page, 'Variable E2E prompt');
  await page.getByRole('menuitem', { name: 'Fill variables' }).click();
  const fillDialog = page.getByRole('dialog', { name: /Fill variables: Variable E2E prompt/ });
  await expect(fillDialog.getByLabel('Value for NAME', { exact: true })).toHaveValue('Ada');
  await expect(fillDialog.getByLabel('Value for ROLE', { exact: true })).toHaveValue('writer');

  await fillDialog.getByLabel('Value for NAME', { exact: true }).fill('Grace');
  await fillDialog.getByLabel('Value for ROLE', { exact: true }).fill('line one\nline two');
  await expect(fillDialog.locator('pre')).toHaveText('Hello Grace\nRole: line one\nline two');
  await fillDialog.getByRole('button', { name: 'Copy rendered', exact: true }).click();
  await expect(page.getByText('Copied rendered prompt').last()).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toMatch(/Hello Grace\r?\nRole: line one\r?\nline two/);

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Prompt Library' })).toBeVisible();
  await openPromptActions(page, 'Variable E2E prompt');
  await page.getByRole('menuitem', { name: 'Edit' }).click();
  const reloadedEditDialog = page.getByRole('dialog', { name: 'Edit prompt' });
  await expect(reloadedEditDialog.getByLabel('Content', { exact: true })).toHaveValue(
    'Hello {{NAME}}\nRole: {{ROLE}}',
  );
  await expect(reloadedEditDialog.getByLabel('Default for NAME', { exact: true })).toHaveValue('Ada');
  await expect(reloadedEditDialog.getByLabel('Default for ROLE', { exact: true })).toHaveValue('writer');
});

test('sorts prompts and persists settings across reload', async ({ page }) => {
  await openApp(page);
  await createPrompt(page, 'Zulu prompt', 'z');
  await createPrompt(page, 'Alpha prompt', 'a');

  const sortTrigger = page.locator('header').getByRole('button', { name: 'Change sort order' });
  await sortTrigger.click();
  await page.getByRole('menuitem', { name: 'Alphabetical' }).click();
  await expect.poll(() => page.locator('article h3').allTextContents()).toEqual([
    'Alpha prompt',
    'Zulu prompt',
  ]);

  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const settingsDialog = page.getByRole('dialog', { name: 'Settings' });
  await settingsDialog.locator('#settings-theme').selectOption('dark');
  await settingsDialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Prompt Library' })).toBeVisible();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Settings' }).locator('#settings-theme')).toHaveValue('dark');
});

test('browses dedicated recent and most-used views', async ({ page }) => {
  await openApp(page);
  await createPrompt(page, 'Unused prompt', 'unused content');
  await createPrompt(page, 'Used prompt', 'used content');

  await promptCard(page, 'Used prompt').getByRole('button', { name: 'Copy prompt' }).click();
  await expect(page.getByText('Copied to clipboard')).toBeVisible();

  await page.getByRole('button', { name: 'Recent', exact: true }).click();
  await expect(promptCard(page, 'Unused prompt')).toBeVisible();
  await expect(promptCard(page, 'Used prompt')).toBeVisible();

  await page.getByRole('button', { name: 'Most Used', exact: true }).click();
  await expect(promptCard(page, 'Used prompt')).toBeVisible();
  await expect(promptCard(page, 'Unused prompt')).not.toBeVisible();
});

test('deletes a prompt through the confirmation dialog', async ({ page }) => {
  await openApp(page);
  await createPrompt(page, 'Delete me', 'content');

  await openPromptActions(page, 'Delete me');
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  const dialog = page.getByRole('dialog', { name: 'Delete prompt?' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(promptCard(page, 'Delete me')).not.toBeVisible();
});

test('deletes immediately when confirmation is disabled', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const settingsDialog = page.getByRole('dialog', { name: 'Settings' });
  await settingsDialog.getByLabel('Confirm before deleting', { exact: true }).uncheck();
  await settingsDialog.getByRole('button', { name: 'Save', exact: true }).click();

  await createPrompt(page, 'Delete without prompt', 'content');
  await openPromptActions(page, 'Delete without prompt');
  await page.getByRole('menuitem', { name: 'Delete' }).click();

  await expect(promptCard(page, 'Delete without prompt')).not.toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Delete prompt?' })).not.toBeVisible();
});

test('exports and restores a backup file in a fresh browser profile', async ({ page, browser }) => {
  await openApp(page);
  await createPrompt(page, 'Backup prompt', 'backup content');

  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const settingsDialog = page.getByRole('dialog', { name: 'Settings' });
  const downloadPromise = page.waitForEvent('download');
  await settingsDialog.getByRole('button', { name: 'Export', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^prompt-library-backup-\d{4}-\d{2}-\d{2}\.json$/);
  const backupPath = join(tmpdir(), `prompt-library-recovery-${process.pid}-${Date.now()}.json`);
  await download.saveAs(backupPath);

  const recoveryContext = await browser.newContext();
  const recoveryErrors: string[] = [];
  const recoveryPage = await recoveryContext.newPage();
  recoveryPage.on('console', (message) => {
    if (message.type() === 'error') recoveryErrors.push(`console: ${message.text()}`);
  });
  recoveryPage.on('pageerror', (error) => recoveryErrors.push(`page: ${error.message}`));

  try {
    await recoveryContext.grantPermissions(['clipboard-read', 'clipboard-write'], {
      origin: 'http://127.0.0.1:4173',
    });
    await openApp(recoveryPage);
    await recoveryPage.getByRole('button', { name: 'Settings', exact: true }).click();
    const importDialog = recoveryPage.getByRole('dialog', { name: 'Settings' });
    await importDialog.locator('input[type="file"]').setInputFiles(backupPath);
    const restoreDialog = recoveryPage.getByRole('dialog', { name: 'Restore library' });
    await expect(restoreDialog).toBeVisible();
    await expect(restoreDialog).toContainText('1 prompt');
    await expect(restoreDialog).toContainText('1 folder');
    await expect(restoreDialog.getByRole('button', { name: 'Restore library', exact: true })).toBeDisabled();
    await restoreDialog.getByRole('checkbox', { name: /pre-restore backup/i }).check();
    await restoreDialog.getByRole('button', { name: 'Restore library', exact: true }).click();
    await expect(recoveryPage.getByText('Library restored')).toBeVisible();
    await importDialog.getByRole('button', { name: 'Close dialog' }).click();
    await expect(promptCard(recoveryPage, 'Backup prompt')).toBeVisible();
    expect(recoveryErrors, 'fresh-profile browser errors').toEqual([]);
  } finally {
    await recoveryContext.close();
    rmSync(backupPath, { force: true });
  }
});

test('restores a legacy v1 backup in a fresh browser profile', async ({ browser }) => {
  const recoveryContext = await browser.newContext();
  const recoveryErrors: string[] = [];
  const recoveryPage = await recoveryContext.newPage();
  recoveryPage.on('console', (message) => {
    if (message.type() === 'error') recoveryErrors.push(`console: ${message.text()}`);
  });
  recoveryPage.on('pageerror', (error) => recoveryErrors.push(`page: ${error.message}`));

  try {
    await recoveryContext.grantPermissions(['clipboard-read', 'clipboard-write'], {
      origin: 'http://127.0.0.1:4173',
    });
    await openApp(recoveryPage);
    await recoveryPage.getByRole('button', { name: 'Settings', exact: true }).click();
    const importDialog = recoveryPage.getByRole('dialog', { name: 'Settings' });
    await importDialog
      .locator('input[type="file"]')
      .setInputFiles(join(process.cwd(), 'src/test/fixtures/library-v1.json'));
    const restoreDialog = recoveryPage.getByRole('dialog', { name: 'Restore library' });
    await expect(restoreDialog).toContainText('4 prompts');
    await expect(restoreDialog).toContainText('3 folders');
    await expect(restoreDialog).toContainText('7 tags');
    await restoreDialog.getByRole('checkbox', { name: /pre-restore backup/i }).check();
    await restoreDialog.getByRole('button', { name: 'Restore library', exact: true }).click();
    await expect(recoveryPage.getByText('Library restored')).toBeVisible();
    await importDialog.getByRole('button', { name: 'Close dialog' }).click();
    await expect(promptCard(recoveryPage, 'Daily stand-up summary')).toBeVisible();
    expect(recoveryErrors, 'legacy-profile browser errors').toEqual([]);
  } finally {
    await recoveryContext.close();
  }
});
