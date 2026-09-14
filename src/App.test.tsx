import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import App from './App';
import { DEFAULT_SETTINGS } from './types/settings';
import { ensureSeeded } from './data/db';
import { runMigrations } from './data/migrations';
import * as promptRepo from './data/promptRepository';
import * as folderRepo from './data/folderRepository';
import * as tagRepo from './data/tagRepository';
import * as bundleRepo from './data/bundleRepository';
import * as settingsRepo from './data/settingsRepository';

vi.mock('./data/db', () => ({
  ensureSeeded: vi.fn(),
}));
vi.mock('./data/migrations', () => ({
  runMigrations: vi.fn(),
}));
vi.mock('./data/promptRepository', () => ({
  listPrompts: vi.fn(),
}));
vi.mock('./data/folderRepository', () => ({
  listFolders: vi.fn(),
}));
vi.mock('./data/tagRepository', () => ({
  listTags: vi.fn(),
}));
vi.mock('./data/bundleRepository', () => ({
  listBundles: vi.fn(),
}));
vi.mock('./data/settingsRepository', () => ({
  getSettings: vi.fn(),
}));

describe('App startup recovery', () => {
  it('blocks the empty state after seed failure and reaches the app after retry', async () => {
    Object.assign(window, {
      matchMedia: vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    });
    vi.mocked(ensureSeeded).mockRejectedValueOnce(new Error('database unavailable'));
    vi.mocked(ensureSeeded).mockResolvedValue(undefined);
    vi.mocked(runMigrations).mockResolvedValue(undefined);
    vi.mocked(promptRepo.listPrompts).mockResolvedValue([]);
    vi.mocked(folderRepo.listFolders).mockResolvedValue([]);
    vi.mocked(tagRepo.listTags).mockResolvedValue([]);
    vi.mocked(bundleRepo.listBundles).mockResolvedValue([]);
    vi.mocked(settingsRepo.getSettings).mockResolvedValue(DEFAULT_SETTINGS);

    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Library unavailable' })).toBeInTheDocument();
    expect(screen.queryByText('No prompts yet')).not.toBeInTheDocument();
    expect(screen.getByText(/backup|recovery/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(screen.getByText('No prompts yet')).toBeInTheDocument());
  });

  it('blocks the empty state after migration failure and recovers on retry', async () => {
    Object.assign(window, {
      matchMedia: vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    });
    vi.mocked(ensureSeeded).mockResolvedValue(undefined);
    vi.mocked(runMigrations).mockRejectedValueOnce(new Error('migration failed'));
    vi.mocked(runMigrations).mockResolvedValue(undefined);
    vi.mocked(promptRepo.listPrompts).mockResolvedValue([]);
    vi.mocked(folderRepo.listFolders).mockResolvedValue([]);
    vi.mocked(tagRepo.listTags).mockResolvedValue([]);
    vi.mocked(bundleRepo.listBundles).mockResolvedValue([]);
    vi.mocked(settingsRepo.getSettings).mockResolvedValue(DEFAULT_SETTINGS);

    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Library unavailable' })).toBeInTheDocument();
    expect(screen.getByText(/backup|recovery/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(screen.getByText('No prompts yet')).toBeInTheDocument());
  });
});
