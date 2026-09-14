import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { AppStateProvider } from '../../hooks/AppStateProvider';
import { LibraryDataContext } from '../../hooks/libraryDataContext';
import { SYSTEM_FOLDER_ID, SYSTEM_FOLDER_NAME } from '../../config/constants';
import type { Bundle, Folder, Prompt } from '../../types';
import { Sidebar } from './Sidebar';

const folders: Folder[] = [
  {
    id: 'folder-z',
    name: 'Zulu',
    normalizedName: 'zulu',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: SYSTEM_FOLDER_ID,
    name: SYSTEM_FOLDER_NAME,
    normalizedName: 'unfiled',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'folder-a',
    name: 'Alpha',
    normalizedName: 'alpha',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
];

const prompt: Prompt = {
  id: 'prompt-a',
  title: 'Prompt',
  content: 'Content',
  folderId: 'folder-a',
  tagIds: [],
  isFavorite: false,
  copyCount: 0,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  lastCopiedAt: null,
};

const bundle: Bundle = {
  id: 'bundle-a',
  name: 'Daily flow',
  promptIds: [prompt.id],
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

describe('Sidebar browse state', () => {
  it('shows prompt counts and does not mutate the shared folder array while sorting', () => {
    const reload = vi.fn().mockResolvedValue(undefined);
    render(
      <AppStateProvider>
        <LibraryDataContext.Provider
          value={{ prompts: [prompt], bundles: [bundle], folders, tags: [], loaded: true, error: null, reload }}
        >
          <Sidebar />
        </LibraryDataContext.Provider>
      </AppStateProvider>,
    );

    expect(screen.getByLabelText('1 prompt')).toBeInTheDocument();
    expect(screen.getAllByLabelText('0 prompts')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Daily flow' })).toBeInTheDocument();
    expect(folders.map((folder) => folder.name)).toEqual(['Zulu', SYSTEM_FOLDER_NAME, 'Alpha']);
  });
});
