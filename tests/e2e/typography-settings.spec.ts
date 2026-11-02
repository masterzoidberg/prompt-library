import { expect, test, type Page } from '@playwright/test';

const cases = [
  {
    name: '375px minimum sizes',
    width: 375,
    height: 740,
    interfaceFont: 'system-sans',
    interfaceSize: 'minimum',
    promptFont: 'serif',
    promptSize: 'minimum',
    spacing: 'compact',
    expectedInterfaceSize: '13px',
    expectedPromptSize: '12px',
    expectedPromptFont: 'Georgia',
    expectedLineHeight: '15px',
  },
  {
    name: '430px maximum sizes',
    width: 430,
    height: 844,
    interfaceFont: 'serif',
    interfaceSize: 'maximum',
    promptFont: 'system-sans',
    promptSize: 'maximum',
    spacing: 'relaxed',
    expectedInterfaceSize: '20px',
    expectedPromptSize: '24px',
    expectedPromptFont: 'ui-sans-serif',
    expectedLineHeight: '42px',
  },
  {
    name: '768px monospace interface',
    width: 768,
    height: 1024,
    interfaceFont: 'monospace',
    interfaceSize: 'default',
    promptFont: 'same-as-interface',
    promptSize: 'default',
    spacing: 'normal',
    expectedInterfaceSize: '16px',
    expectedPromptSize: '14px',
    expectedPromptFont: 'ui-monospace',
    expectedLineHeight: '21px',
  },
  {
    name: 'desktop monospace prompt',
    width: 1280,
    height: 800,
    interfaceFont: 'system-sans',
    interfaceSize: 'default',
    promptFont: 'monospace',
    promptSize: 'maximum',
    spacing: 'relaxed',
    expectedInterfaceSize: '16px',
    expectedPromptSize: '24px',
    expectedPromptFont: 'ui-monospace',
    expectedLineHeight: '42px',
  },
];

async function openSettings(page: Page, width: number) {
  if (width < 1024) {
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await page.getByRole('dialog', { name: 'Navigation' }).getByRole('button', { name: 'Settings' }).click();
  } else {
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
  }
  return page.getByRole('dialog', { name: 'Settings' });
}

async function saveTypography(page: Page, viewport: (typeof cases)[number]) {
  const settings = await openSettings(page, viewport.width);
  await settings.getByLabel('Interface font', { exact: true }).selectOption(viewport.interfaceFont);
  const interfaceSize = settings.getByRole('slider', { name: 'Interface size' });
  await interfaceSize.press('Home');
  if (viewport.interfaceSize === 'maximum') {
    await interfaceSize.press('End');
  } else if (viewport.interfaceSize === 'default') {
    for (let step = 0; step < 3; step += 1) await interfaceSize.press('ArrowRight');
  }
  await settings.getByLabel('Prompt font', { exact: true }).selectOption(viewport.promptFont);
  const promptSize = settings.getByRole('slider', { name: 'Prompt size' });
  await promptSize.press('Home');
  if (viewport.promptSize === 'maximum') {
    await promptSize.press('End');
  } else if (viewport.promptSize === 'default') {
    for (let step = 0; step < 2; step += 1) await promptSize.press('ArrowRight');
  }
  await settings.getByLabel('Prompt spacing', { exact: true }).selectOption(viewport.spacing);
  await expect(settings.locator('#settings-interface-size-value')).toHaveText(viewport.expectedInterfaceSize);
  await expect(settings.locator('#settings-prompt-size-value')).toHaveText(viewport.expectedPromptSize);
  await settings.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(settings).not.toBeVisible();

  if (viewport.width < 1024) {
    await page.getByRole('dialog', { name: 'Navigation' }).getByRole('button', { name: 'Close navigation' }).click();
  }
}

test('typography settings persist and authored content stays readable at common viewport sizes', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Prompt Library' })).toBeVisible();

  const defaults = await openSettings(page, 1280);
  await expect(defaults.getByLabel('Interface font', { exact: true })).toHaveValue('system-sans');
  await expect(defaults.locator('#settings-interface-size-value')).toHaveText('16px');
  await expect(defaults.getByLabel('Prompt font', { exact: true })).toHaveValue('monospace');
  await expect(defaults.locator('#settings-prompt-size-value')).toHaveText('14px');
  await expect(defaults.getByLabel('Prompt spacing', { exact: true })).toHaveValue('normal');
  await defaults.getByRole('button', { name: 'Cancel', exact: true }).click();

  for (const viewport of cases) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await saveTypography(page, viewport);

    const rootStyles = await page.evaluate(() => ({
      interfaceFamily: getComputedStyle(document.body).fontFamily,
      interfaceSize: getComputedStyle(document.body).fontSize,
      promptFamily: getComputedStyle(document.documentElement).getPropertyValue('--prompt-font-family'),
      pageWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }));
    expect(rootStyles.interfaceFamily, viewport.name).toContain(
      viewport.interfaceFont === 'serif' ? 'Georgia' : viewport.interfaceFont === 'monospace' ? 'ui-monospace' : 'ui-sans-serif',
    );
    expect(rootStyles.interfaceSize, viewport.name).toBe(viewport.expectedInterfaceSize);
    expect(rootStyles.promptFamily, viewport.name).toContain(viewport.expectedPromptFont);
    expect(rootStyles.pageWidth, `${viewport.name}: no horizontal overflow`).toBeLessThanOrEqual(rootStyles.viewportWidth);

    const title = `Typography ${viewport.width}${viewport.width === 430 ? ` ${'long title '.repeat(4)}` : ''}`;
    await page.locator('header').getByRole('button', { name: 'New prompt' }).click();
    const form = page.getByRole('dialog', { name: 'New prompt' });
    const content = form.getByLabel('Content', { exact: true });
    const editorStyles = await content.evaluate((element) => {
      const style = getComputedStyle(element);
      return { fontFamily: style.fontFamily, fontSize: style.fontSize, lineHeight: style.lineHeight };
    });
    expect(editorStyles.fontFamily, `${viewport.name}: editor font`).toContain(viewport.expectedPromptFont);
    expect(editorStyles.fontSize, `${viewport.name}: editor size`).toBe(viewport.expectedPromptSize);
    expect(editorStyles.lineHeight, `${viewport.name}: editor spacing`).toBe(viewport.expectedLineHeight);

    await form.getByLabel('Title', { exact: true }).fill(title);
    await content.fill(`Read each step carefully. ${'UNBROKENPROMPTTEXT'.repeat(24)}\nHello {{NAME}}`);
    const longTag = 'Typography accessibility review notes with an unusually long category name';
    if (viewport.width === 430) {
      const tags = form.getByRole('combobox', { name: 'Tags' });
      await tags.fill(longTag);
      await form.getByRole('option', { name: `Create "${longTag}"` }).click();
    }
    await form.getByRole('button', { name: 'Save', exact: true }).click();

    const card = page.getByRole('article', { name: `Prompt: ${title}`, exact: true });
    await expect(card).toBeVisible();
    if (viewport.width === 430) {
      const tag = card.getByText(`#${longTag}`, { exact: true });
      await expect(tag).toBeVisible();
      const tagBounds = await tag.evaluate((element) => {
        const chip = element.closest('span.rounded');
        const cardElement = element.closest('article');
        return {
          chipRight: chip?.getBoundingClientRect().right ?? Number.POSITIVE_INFINITY,
          cardRight: cardElement?.getBoundingClientRect().right ?? 0,
        };
      });
      expect(tagBounds.chipRight, 'long tag chip remains inside its card').toBeLessThanOrEqual(tagBounds.cardRight);
    }
    const cardContent = card.locator('pre.prompt-content');
    await expect(cardContent).toBeVisible();
    const cardStyles = await cardContent.evaluate((element) => {
      const style = getComputedStyle(element);
      return { fontFamily: style.fontFamily, fontSize: style.fontSize, lineHeight: style.lineHeight };
    });
    expect(cardStyles.fontFamily, `${viewport.name}: card content font`).toContain(viewport.expectedPromptFont);
    expect(cardStyles.fontSize, `${viewport.name}: card content size`).toBe(viewport.expectedPromptSize);
    expect(cardStyles.lineHeight, `${viewport.name}: card content spacing`).toBe(viewport.expectedLineHeight);

    await card.getByRole('button', { name: `Open prompt: ${title}` }).click();
    const detail = page.getByRole('dialog', { name: `Prompt detail: ${title}` });
    const detailContent = detail.locator('pre.prompt-content');
    await expect(detailContent).toBeVisible();
    await expect(detailContent).toHaveCSS('font-size', viewport.expectedPromptSize);
    await expect(detailContent).toHaveCSS('line-height', viewport.expectedLineHeight);
    await expect(page.locator('html')).toHaveJSProperty('scrollWidth', viewport.width);
    await detail.getByRole('button', { name: 'Close dialog' }).click();
  }

  await page.setViewportSize({ width: 1280, height: 800 });
  const settings = await openSettings(page, 1280);
  await settings.getByRole('button', { name: 'Reset typography' }).click();
  await expect(settings.getByLabel('Interface font', { exact: true })).toHaveValue('system-sans');
  await expect(settings.locator('#settings-interface-size-value')).toHaveText('16px');
  await expect(settings.getByLabel('Prompt font', { exact: true })).toHaveValue('monospace');
  await expect(settings.locator('#settings-prompt-size-value')).toHaveText('14px');
  await settings.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(settings).not.toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Prompt Library' })).toBeVisible();
  await expect(page.locator('body')).toHaveCSS('font-size', '16px');
  const reopened = await openSettings(page, 1280);
  await expect(reopened.getByLabel('Interface font', { exact: true })).toHaveValue('system-sans');
  await expect(reopened.getByLabel('Prompt font', { exact: true })).toHaveValue('monospace');
  await expect(reopened.locator('#settings-prompt-size-value')).toHaveText('24px');
});
