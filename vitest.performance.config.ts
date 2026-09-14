/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/performance/performance.test.ts'],
    testTimeout: 120_000,
    exclude: ['**/node_modules/**', '**/.kilo/**', 'tests/e2e/**'],
    css: false,
    esbuild: {
      jsx: 'automatic',
    },
  },
});
