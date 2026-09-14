import { describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { exportLibrary, importLibrary } from '../data/importExport';
import { listBundles } from '../data/bundleRepository';
import { listFolders } from '../data/folderRepository';
import { listPrompts, updatePrompt } from '../data/promptRepository';
import { listTags } from '../data/tagRepository';
import { createSearchIndex } from '../utils/search';
import { buildLibraryFixture, SCALE_FIXTURE_SIZES } from '../test/builders/libraryBuilder';

const WARMUP_ITERATIONS = 3;
const SAMPLE_ITERATIONS = 15;

interface TimingSummary {
  operation: string;
  p50Ms: number;
  p95Ms: number;
}

interface LoadedLibrary {
  prompts: Awaited<ReturnType<typeof listPrompts>>;
  folders: Awaited<ReturnType<typeof listFolders>>;
  tags: Awaited<ReturnType<typeof listTags>>;
  bundles: Awaited<ReturnType<typeof listBundles>>;
}

async function loadLibrary(): Promise<LoadedLibrary> {
  const [prompts, folders, tags, bundles] = await Promise.all([
    listPrompts(),
    listFolders(),
    listTags(),
    listBundles(),
  ]);
  return { prompts, folders, tags, bundles };
}

function percentile(values: number[], quantile: number): number {
  const sorted = values.slice().sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * quantile) - 1);
  return sorted[index];
}

async function measure(operation: string, callback: () => unknown | Promise<unknown>): Promise<TimingSummary> {
  for (let iteration = 0; iteration < WARMUP_ITERATIONS; iteration += 1) {
    await callback();
  }

  const samples: number[] = [];
  for (let iteration = 0; iteration < SAMPLE_ITERATIONS; iteration += 1) {
    const startedAt = performance.now();
    await callback();
    samples.push(performance.now() - startedAt);
  }

  return {
    operation,
    p50Ms: Number(percentile(samples, 0.5).toFixed(3)),
    p95Ms: Number(percentile(samples, 0.95).toFixed(3)),
  };
}

describe('performance envelope', () => {
  it('records load, search, save, version, and export timings at each scale', async () => {
    const output: Array<{ size: number; timings: TimingSummary[] }> = [];

    for (const size of SCALE_FIXTURE_SIZES) {
      await importLibrary(buildLibraryFixture(size));
      const library = await loadLibrary();
      expect(library.prompts).toHaveLength(size);
      expect(library.prompts.some((prompt) => prompt.content.includes('#'))).toBe(true);

      const folderMap = new Map(library.folders.map((folder) => [folder.id, folder]));
      const tagMap = new Map(library.tags.map((tag) => [tag.id, tag]));
      const index = createSearchIndex(library.prompts, folderMap, tagMap, library.bundles);
      const target = library.prompts[0];
      if (!target) throw new Error(`Missing benchmark target for ${size} prompts`);

      let searchIteration = 0;
      let saveIteration = 0;
      let versionIteration = 0;
      const timings = [
        await measure('load', loadLibrary),
        await measure('search-index', () => createSearchIndex(library.prompts, folderMap, tagMap, library.bundles)),
        await measure('search', () => {
          const query = searchIteration++ % 2 === 0 ? 'research' : '東京';
          const results = index.search(query);
          if (results.length === 0) throw new Error(`Benchmark query returned no results: ${query}`);
        }),
        await measure('export', exportLibrary),
        await measure('save', () =>
          updatePrompt(target.id, { isFavorite: saveIteration++ % 2 === 0 }),
        ),
        await measure('versioned-save', () =>
          updatePrompt(target.id, { notes: `Benchmark version ${versionIteration++}` }),
        ),
      ];

      output.push({ size, timings });
    }

    console.log(`PERF_ENV ${JSON.stringify({ node: process.version, platform: process.platform, arch: process.arch })}`);
    for (const result of output) {
      for (const timing of result.timings) {
        console.log(`PERF_RESULT ${JSON.stringify({ size: result.size, ...timing })}`);
      }
    }

    const largestSearch = output
      .find((result) => result.size === Math.max(...SCALE_FIXTURE_SIZES))
      ?.timings.find((timing) => timing.operation === 'search');
    expect(largestSearch?.p95Ms).toBeLessThan(100);
  });
});
