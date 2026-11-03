import { expect, test, type Page } from '@playwright/test';

const basePath = '/prompt-library/';

test.use({ viewport: { width: 375, height: 812 } });

test('serves the installable app shell and IndexedDB library offline from the Pages subpath', async ({ page, context }) => {
  await page.goto(basePath);
  await expect(page.getByRole('heading', { name: 'Prompt Library' })).toBeVisible();

  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(manifestHref).toBeTruthy();
  const manifestUrl = new URL(manifestHref!, page.url());
  expect(manifestUrl.pathname).toBe(`${basePath}manifest.webmanifest`);

  const manifestResponse = await page.request.get(manifestUrl.href);
  expect(manifestResponse.status()).toBe(200);
  const manifest = await manifestResponse.json();
  expect(manifest).toMatchObject({
    name: 'Prompt Library',
    short_name: 'Prompt Library',
    display: 'standalone',
    theme_color: '#863bff',
  });
  expect(new URL(manifest.start_url, manifestUrl).pathname).toBe(basePath);
  expect(new URL(manifest.scope, manifestUrl).pathname).toBe(basePath);

  expect(manifest.icons).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ sizes: '192x192', type: 'image/png' }),
      expect.objectContaining({ sizes: '512x512', type: 'image/png' }),
      expect.objectContaining({ sizes: '512x512', type: 'image/png', purpose: 'maskable' }),
    ]),
  );

  for (const icon of manifest.icons as Array<{ src: string; sizes: string }>) {
    const iconUrl = new URL(icon.src, manifestUrl);
    expect(iconUrl.pathname).toMatch(/^\/prompt-library\//);
    const iconResponse = await page.request.get(iconUrl.href);
    expect(iconResponse.status(), icon.src).toBe(200);
    expect(iconResponse.headers()['content-type']).toContain('image/png');
    const expectedSize = Number(icon.sizes.split('x')[0]);
    const dimensions = await page.evaluate(async (src) => {
      const image = new Image();
      image.src = src;
      await image.decode();
      return { width: image.naturalWidth, height: image.naturalHeight };
    }, iconUrl.href);
    expect(dimensions).toEqual({ width: expectedSize, height: expectedSize });
  }

  const appleTouchIconHref = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
  expect(appleTouchIconHref).toBeTruthy();
  const appleTouchIconUrl = new URL(appleTouchIconHref!, page.url());
  expect(appleTouchIconUrl.pathname).toBe(`${basePath}apple-touch-icon.png`);
  expect((await page.request.get(appleTouchIconUrl.href)).status()).toBe(200);

  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));

  const worker = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return {
      scope: registration.scope,
      scriptURL: registration.active?.scriptURL,
    };
  });
  expect(new URL(worker.scope).pathname).toBe(basePath);
  expect(new URL(worker.scriptURL!).pathname).toBe(`${basePath}sw.js`);
  expect((await page.request.get(worker.scriptURL!)).status()).toBe(200);

  const precachedPaths = await page.evaluate(async () => {
    const paths: string[] = [];
    for (const cacheName of await caches.keys()) {
      const cache = await caches.open(cacheName);
      paths.push(...(await cache.keys()).map((request) => new URL(request.url).pathname));
    }
    return paths;
  });
  expect(precachedPaths.length).toBeGreaterThan(0);
  expect(precachedPaths.every((pathname) => pathname.startsWith(basePath))).toBe(true);
  expect(precachedPaths).toContain(`${basePath}manifest.webmanifest`);
  expect(precachedPaths.some((pathname) => pathname.endsWith('.js') && pathname.startsWith(`${basePath}assets/`))).toBe(true);
  expect(precachedPaths.some((pathname) => pathname.endsWith('.css') && pathname.startsWith(`${basePath}assets/`))).toBe(true);

  const staticResources = await page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .map((entry) => new URL(entry.name))
      .filter((url) => url.origin === window.location.origin && /\.(js|css)$/.test(url.pathname))
      .map((url) => url.pathname),
  );
  expect(staticResources.some((pathname) => pathname.startsWith(`${basePath}assets/`))).toBe(true);

  const onlineTitle = 'Offline shell retained prompt';
  await createPrompt(page, onlineTitle, 'This prompt stays in IndexedDB.');
  await expect(page.getByRole('article', { name: `Prompt: ${onlineTitle}`, exact: true })).toBeVisible();

  const cachedPromptCopy = await page.evaluate(async (needle) => {
    const found: string[] = [];
    for (const cacheName of await caches.keys()) {
      const cache = await caches.open(cacheName);
      for (const request of await cache.keys()) {
        const response = await cache.match(request);
        if ((await response?.clone().text())?.includes(needle)) found.push(request.url);
      }
    }
    return found;
  }, onlineTitle);
  expect(cachedPromptCopy).toEqual([]);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Prompt Library' })).toBeVisible();
  await expect(page.getByRole('article', { name: `Prompt: ${onlineTitle}`, exact: true })).toBeVisible();

  const offlineTitle = 'Prompt created without network';
  await createPrompt(page, offlineTitle, 'IndexedDB writes still work offline.');
  await expect(page.getByRole('article', { name: `Prompt: ${offlineTitle}`, exact: true })).toBeVisible();
  expect(await page.evaluate(() => navigator.onLine)).toBe(false);
});

async function createPrompt(page: Page, title: string, content: string) {
  await page.getByRole('banner').getByRole('button', { name: 'New prompt', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'New prompt' });
  await dialog.getByLabel('Title', { exact: true }).fill(title);
  await dialog.getByLabel('Content', { exact: true }).fill(content);
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('article', { name: `Prompt: ${title}`, exact: true })).toBeVisible();
}
