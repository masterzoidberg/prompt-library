import { expect, test, type Page } from '@playwright/test';

const viewports = [
  { name: '375px mobile', width: 375, height: 740 },
  { name: '430px mobile', width: 430, height: 844 },
  { name: '768px portrait', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 },
];

async function openApp(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Prompt Library' })).toBeVisible();
}

async function openEdit(page: Page, title: string) {
  const card = page.getByRole('article', { name: `Prompt: ${title}`, exact: true });
  await card.getByRole('button', { name: 'Prompt actions' }).click();
  await page.getByRole('menuitem', { name: 'Edit' }).click();
  return page.getByRole('dialog', { name: 'Edit prompt' });
}

async function expectFormLayout(page: Page, viewportName: string) {
  const dialog = page.getByRole('dialog', { name: /^(New prompt|Edit prompt)$/ });
  const close = dialog.getByRole('button', { name: 'Close dialog' });
  const save = dialog.getByRole('button', { name: 'Save', exact: true });
  const cancel = dialog.getByRole('button', { name: 'Cancel', exact: true });

  await expect(dialog, viewportName).toBeVisible();
  await expect(close, viewportName).toBeInViewport();
  await expect(save, viewportName).toBeInViewport();
  await expect(cancel, viewportName).toBeInViewport();

  const metrics = await dialog.evaluate((element) => {
    const saveButton = element.querySelector<HTMLButtonElement>('button[type="submit"]');
    const footer = saveButton?.parentElement?.parentElement;
    const documentWidth = document.documentElement.scrollWidth;
    return {
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      documentWidth,
      viewportWidth: window.innerWidth,
      footerPosition: footer ? getComputedStyle(footer).position : 'missing',
      headerPosition: getComputedStyle(element.firstElementChild as HTMLElement).position,
    };
  });

  expect(metrics.documentWidth, `${viewportName}: no horizontal page overflow`).toBeLessThanOrEqual(metrics.viewportWidth);
  expect(metrics.scrollHeight, `${viewportName}: long form scrolls`).toBeGreaterThan(metrics.clientHeight);
  expect(metrics.footerPosition, `${viewportName}: actions stay sticky`).toBe('sticky');
  expect(metrics.headerPosition, `${viewportName}: close control header stays sticky`).toBe('sticky');

  await dialog.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect(save, `${viewportName}: Save remains visible after scrolling`).toBeInViewport();
  await expect(cancel, `${viewportName}: Cancel remains visible after scrolling`).toBeInViewport();
  await expect(close, `${viewportName}: close control remains visible after scrolling`).toBeInViewport();

  const bottomMetrics = await dialog.evaluate((element) => {
    const saveButton = element.querySelector<HTMLButtonElement>('button[type="submit"]');
    const footer = saveButton?.parentElement?.parentElement;
    const notes = element.querySelector<HTMLTextAreaElement>('#prompt-notes');
    return {
      notesBottom: notes?.getBoundingClientRect().bottom ?? 0,
      footerTop: footer?.getBoundingClientRect().top ?? 0,
      dialogBottom: element.getBoundingClientRect().bottom,
      footerBottom: footer?.getBoundingClientRect().bottom ?? 0,
    };
  });
  expect(bottomMetrics.notesBottom, `${viewportName}: final field is not under the footer`).toBeLessThanOrEqual(
    bottomMetrics.footerTop + 1,
  );
  expect(bottomMetrics.footerBottom, `${viewportName}: footer fits within dialog`).toBeLessThanOrEqual(
    bottomMetrics.dialogBottom + 1,
  );

  return dialog;
}

test('creates and edits prompts with reachable actions at common viewport widths', async ({ page }) => {
  await openApp(page);

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.locator('header').getByRole('button', { name: 'New prompt' }).click();
    const createDialog = page.getByRole('dialog', { name: 'New prompt' });
    await expectFormLayout(page, viewport.name);

    const title =
      viewport.width === 430
        ? `Responsive prompt ${viewport.width} ${'with an intentionally long title '.repeat(2)}`
        : `Responsive prompt ${viewport.width}`;
    await createDialog.getByLabel('Title', { exact: true }).fill(title);
    const longContent = `${'Write a useful response with clear steps.\n'.repeat(28)}Hello {{NAME}}`;
    await createDialog.getByLabel('Content', { exact: true }).fill(longContent);

    if (viewport.width === 375) {
      const folder = createDialog.getByRole('combobox', { name: 'Folder' });
      await folder.fill('A long folder name for mobile');
      const createFolder = createDialog.getByRole('option', {
        name: 'Create "A long folder name for mobile"',
      });
      await expect(createFolder).toBeVisible();
      await createFolder.click();

      const tags = createDialog.getByRole('combobox', { name: 'Tags' });
      await tags.fill('A long tag name that wraps on a phone');
      const createLongTag = createDialog.getByRole('option', {
        name: 'Create "A long tag name that wraps on a phone"',
      });
      await expect(createLongTag).toBeVisible();
      await createLongTag.click();
      await tags.fill('second tag');
      await createDialog.getByRole('option', { name: 'Create "second tag"' }).click();
    }

    if (viewport.width === 430) {
      await createDialog.getByLabel('Description').fill('A prompt with a long editor and metadata.');
    }

    if (viewport.width === 768) {
      await createDialog.getByLabel('Default for NAME').fill('Ada');
    }

    await createDialog.getByLabel('Notes').fill(`Notes at ${viewport.width}px`);
    await createDialog.getByRole('button', { name: 'Save', exact: true }).click();
    const card = page.getByRole('article', { name: `Prompt: ${title}`, exact: true });
    await expect(card).toBeVisible();

    const editDialog = await openEdit(page, title);
    await expectFormLayout(page, `${viewport.name} edit`);
    await editDialog.getByLabel('Content', { exact: true }).fill(`Edited at ${viewport.width}px`);
    await editDialog.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(card).toContainText(`Edited at ${viewport.width}px`);
  }
});

test('confirms dirty close attempts and lets the user keep editing or discard', async ({ page }) => {
  await openApp(page);
  await page.locator('header').getByRole('button', { name: 'New prompt' }).click();
  const dialog = page.getByRole('dialog', { name: 'New prompt' });
  await dialog.getByLabel('Title', { exact: true }).fill('Unsaved prompt');
  await dialog.getByLabel('Content', { exact: true }).fill('Unsaved content');

  await page.keyboard.press('Escape');
  const confirmation = page.getByRole('dialog', { name: 'Discard unsaved changes?' });
  await expect(confirmation).toBeVisible();
  await expect(confirmation).toContainText('Your changes to this prompt have not been saved.');
  await expect(confirmation.getByRole('button', { name: 'Keep editing' })).toBeFocused();
  await confirmation.getByRole('button', { name: 'Keep editing' }).click();
  await expect(dialog.getByLabel('Title', { exact: true })).toHaveValue('Unsaved prompt');
  await expect(dialog.locator(':focus')).toHaveCount(1);

  await dialog.getByRole('button', { name: 'Close dialog' }).click();
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole('button', { name: 'Discard', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('article', { name: 'Prompt: Unsaved prompt', exact: true })).not.toBeVisible();
});

test('unchanged edits close directly, modified edits confirm outside dismissal and save cleanly', async ({ page }) => {
  await openApp(page);
  await page.locator('header').getByRole('button', { name: 'New prompt' }).click();
  const createDialog = page.getByRole('dialog', { name: 'New prompt' });
  await createDialog.getByLabel('Title', { exact: true }).fill('Edit confirmation prompt');
  await createDialog.getByLabel('Content', { exact: true }).fill('Original content');
  await createDialog.getByRole('button', { name: 'Save', exact: true }).click();

  let editDialog = await openEdit(page, 'Edit confirmation prompt');
  await editDialog.getByRole('button', { name: 'Close dialog' }).click();
  await expect(editDialog).not.toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Discard unsaved changes?' })).not.toBeVisible();

  editDialog = await openEdit(page, 'Edit confirmation prompt');
  await editDialog.getByLabel('Content', { exact: true }).fill('Updated content');
  await page.mouse.click(2, 2);

  const confirmation = page.getByRole('dialog', { name: 'Discard unsaved changes?' });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole('button', { name: 'Keep editing' }).click();
  await expect(editDialog.getByLabel('Content', { exact: true })).toHaveValue('Updated content');
  await expect(editDialog.locator(':focus')).toHaveCount(1);
  await editDialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(editDialog).not.toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Discard unsaved changes?' })).not.toBeVisible();
  await expect(page.getByRole('article', { name: 'Prompt: Edit confirmation prompt', exact: true })).toContainText(
    'Updated content',
  );
});
