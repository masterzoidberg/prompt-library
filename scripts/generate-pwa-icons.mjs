import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = resolve(projectRoot, 'public');
const favicon = await readFile(resolve(publicDir, 'favicon.svg'));
const faviconDataUrl = `data:image/svg+xml;base64,${favicon.toString('base64')}`;
const background = '#f5f0ff';
const icons = [
  { filename: 'pwa-192.png', size: 192, logoScale: 0.7 },
  { filename: 'pwa-512.png', size: 512, logoScale: 0.7 },
  { filename: 'pwa-maskable-512.png', size: 512, logoScale: 0.52 },
  { filename: 'apple-touch-icon.png', size: 180, logoScale: 0.72 },
];

const browser = await chromium.launch({ headless: true });

try {
  for (const icon of icons) {
    const logoWidth = Math.round(icon.size * icon.logoScale);
    const logoHeight = Math.round((logoWidth * 46) / 48);
    const x = Math.round((icon.size - logoWidth) / 2);
    const y = Math.round((icon.size - logoHeight) / 2);
    const page = await browser.newPage({ viewport: { width: icon.size, height: icon.size } });

    await page.setContent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="${icon.size}" height="${icon.size}" viewBox="0 0 ${icon.size} ${icon.size}">
        <rect width="${icon.size}" height="${icon.size}" fill="${background}" />
        <image href="${faviconDataUrl}" x="${x}" y="${y}" width="${logoWidth}" height="${logoHeight}" />
      </svg>
    `);
    await page.locator('svg').screenshot({ path: resolve(publicDir, icon.filename) });
    await page.close();
  }
} finally {
  await browser.close();
}
