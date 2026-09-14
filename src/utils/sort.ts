import type { Prompt } from '../types/prompt';
import type { SortKey } from '../types/settings';

export function sortPrompts(prompts: Prompt[], sort: SortKey): Prompt[] {
  const copy = [...prompts];
  switch (sort) {
    case 'recently-updated':
      copy.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      break;
    case 'recently-created':
      copy.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      break;
    case 'alphabetical':
      copy.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case 'most-copied':
      copy.sort((a, b) => b.copyCount - a.copyCount);
      break;
  }
  return copy;
}