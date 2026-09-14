import type { Bundle, Folder, Prompt, Tag } from '../types';
import { ASSET_TYPE_LABELS, DEFAULT_ASSET_TYPE, TARGET_TOOL_LABELS } from '../types/prompt';

export type SearchField =
  | 'title'
  | 'tag'
  | 'type'
  | 'targetTool'
  | 'description'
  | 'notes'
  | 'folder'
  | 'bundle'
  | 'content';

export interface SearchMatch {
  field: SearchField;
  value: string;
  start: number;
  end: number;
}

export interface SearchResult {
  prompt: Prompt;
  score: number;
  matches: SearchMatch[];
}

export interface SearchIndex {
  search(query: string): SearchResult[];
}

interface SearchSource {
  field: SearchField;
  value: string;
  normalized: string;
}

interface SearchDocument {
  prompt: Prompt;
  title: SearchSource;
  metadata: SearchSource[];
  content: SearchSource;
}

const SCORE = {
  exactTitle: 500,
  prefixTitle: 400,
  titleToken: 300,
  metadata: 200,
  content: 100,
} as const;

function normalizeSearchText(value: string): string {
  return value.toLowerCase();
}

function createSource(field: SearchField, value: string | undefined): SearchSource | null {
  if (!value) return null;
  const normalized = normalizeSearchText(value);
  if (!normalized.trim()) return null;
  return { field, value, normalized };
}

function tokenise(value: string): string[] {
  return value.split(/\s+/).filter(Boolean);
}

function findOccurrences(value: string, normalizedValue: string, normalizedNeedle: string): Array<{ start: number; end: number }> {
  if (!normalizedNeedle) return [];
  const ranges: Array<{ start: number; end: number }> = [];
  let fromIndex = 0;
  while (fromIndex < normalizedValue.length) {
    const start = normalizedValue.indexOf(normalizedNeedle, fromIndex);
    if (start < 0) break;
    ranges.push({ start, end: start + normalizedNeedle.length });
    fromIndex = start + normalizedNeedle.length;
  }
  return ranges.filter(({ end }) => end <= value.length);
}

function findRanges(source: SearchSource, query: string, queryTokens: string[]): SearchMatch[] {
  const fullQueryRanges = findOccurrences(source.value, source.normalized, query);
  const ranges = fullQueryRanges.length > 0
    ? fullQueryRanges
    : queryTokens.flatMap((token) => findOccurrences(source.value, source.normalized, token));
  const uniqueRanges = new Map(ranges.map((range) => [`${range.start}:${range.end}`, range]));
  return [...uniqueRanges.values()]
    .sort((a, b) => a.start - b.start || a.end - b.end)
    .map((range) => ({ field: source.field, value: source.value, ...range }));
}

function hasTitleTokenMatch(title: SearchSource, queryTokens: string[]): boolean {
  const titleTokens = tokenise(title.normalized);
  return queryTokens.every((queryToken) => titleTokens.some((titleToken) => titleToken.startsWith(queryToken)));
}

function createDocuments(
  prompts: Prompt[],
  folderMap: Map<string, Folder>,
  tagMap: Map<string, Tag>,
  bundles: Bundle[],
): SearchDocument[] {
  const bundleNamesByPromptId = new Map<string, string[]>();
  for (const bundle of bundles) {
    for (const promptId of bundle.promptIds) {
      const names = bundleNamesByPromptId.get(promptId) ?? [];
      names.push(bundle.name);
      bundleNamesByPromptId.set(promptId, names);
    }
  }

  return prompts.map((prompt) => {
    const type = prompt.type ?? DEFAULT_ASSET_TYPE;
    const targetTools = prompt.targetTools ?? [];
    const title = createSource('title', prompt.title);
    const content = createSource('content', prompt.content);
    if (!title || !content) {
      throw new Error('Search index requires prompt title and content');
    }

    const metadata = [
      ...prompt.tagIds.flatMap((tagId) => {
        const tag = tagMap.get(tagId);
        return tag ? [createSource('tag', tag.name)] : [];
      }),
      createSource('type', ASSET_TYPE_LABELS[type]),
      createSource('type', type),
      ...targetTools.flatMap((targetTool) => [
        createSource('targetTool', TARGET_TOOL_LABELS[targetTool] ?? targetTool),
        createSource('targetTool', targetTool),
      ]),
      createSource('description', prompt.description),
      createSource('notes', prompt.notes),
      createSource('folder', folderMap.get(prompt.folderId)?.name),
      ...(bundleNamesByPromptId.get(prompt.id) ?? []).map((name) => createSource('bundle', name)),
    ].filter((source): source is SearchSource => source !== null);

    return { prompt, title, metadata, content };
  });
}

function compareStrings(a: string, b: string): number {
  const normalizedA = normalizeSearchText(a);
  const normalizedB = normalizeSearchText(b);
  if (normalizedA < normalizedB) return -1;
  if (normalizedA > normalizedB) return 1;
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function compareResults(a: SearchResult, b: SearchResult): number {
  if (a.score !== b.score) return b.score - a.score;
  if (a.prompt.updatedAt !== b.prompt.updatedAt) return b.prompt.updatedAt < a.prompt.updatedAt ? -1 : 1;
  const titleOrder = compareStrings(a.prompt.title, b.prompt.title);
  return titleOrder !== 0 ? titleOrder : compareStrings(a.prompt.id, b.prompt.id);
}

export function createSearchIndex(
  prompts: Prompt[],
  folderMap: Map<string, Folder>,
  tagMap: Map<string, Tag>,
  bundles: Bundle[] = [],
): SearchIndex {
  const documents = createDocuments(prompts, folderMap, tagMap, bundles);

  return {
    search(query: string): SearchResult[] {
      const normalizedQuery = normalizeSearchText(query.trim());
      if (!normalizedQuery) return documents.map((document) => ({ prompt: document.prompt, score: 0, matches: [] }));
      const queryTokens = tokenise(normalizedQuery);

      return documents
        .flatMap((document) => {
          const titleMatches = findRanges(document.title, normalizedQuery, queryTokens);
          const metadataMatches = document.metadata.flatMap((source) => findRanges(source, normalizedQuery, queryTokens));
          const contentMatches = findRanges(document.content, normalizedQuery, queryTokens);
          const titleContainsQuery = document.title.normalized.includes(normalizedQuery);
          const titleTokenMatch = hasTitleTokenMatch(document.title, queryTokens);
          const score = document.title.normalized === normalizedQuery
            ? SCORE.exactTitle
            : document.title.normalized.startsWith(normalizedQuery)
              ? SCORE.prefixTitle
              : titleContainsQuery || titleTokenMatch
                ? SCORE.titleToken
                : metadataMatches.length > 0
                  ? SCORE.metadata
                  : contentMatches.length > 0
                    ? SCORE.content
                    : 0;

          if (score === 0) return [];
          return [{
            prompt: document.prompt,
            score,
            matches: [...titleMatches, ...metadataMatches, ...contentMatches],
          }];
        })
        .sort(compareResults);
    },
  };
}

/**
 * Compatibility wrapper for callers that only need the current prompt list.
 * PromptList uses createSearchIndex directly so its normalized documents are
 * built once per library change.
 */
export function searchPrompts(
  prompts: Prompt[],
  query: string,
  folderMap: Map<string, Folder>,
  tagMap: Map<string, Tag>,
  bundles: Bundle[] = [],
): Prompt[] {
  if (!query.trim()) return prompts;
  return createSearchIndex(prompts, folderMap, tagMap, bundles).search(query).map((result) => result.prompt);
}
