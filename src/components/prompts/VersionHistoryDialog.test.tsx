import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import 'fake-indexeddb/auto';
import type { Prompt, PromptVersion } from '../../types';
import * as versionRepo from '../../data/versionRepository';
import { VersionHistoryDialog } from './VersionHistoryDialog';

const prompt: Prompt = {
  id: 'prompt-1',
  title: 'Current prompt',
  content: 'after\nkeep',
  folderId: 'unfiled',
  tagIds: [],
  isFavorite: false,
  copyCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  lastCopiedAt: null,
  type: 'prompt',
  targetTools: [],
  variableDefaults: {},
};

const version: PromptVersion = {
  id: 'version-1',
  promptId: prompt.id,
  sequence: 1,
  createdAt: '2026-01-01T12:00:00.000Z',
  reason: 'edit',
  snapshot: {
    title: 'Previous prompt',
    content: 'before\nkeep',
    type: 'prompt',
    targetTools: [],
    variableDefaults: {},
  },
};

describe('VersionHistoryDialog', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(versionRepo, 'listPromptVersions').mockResolvedValue([version]);
  });

  it('lists versions, renders a readable diff, and supports copy and duplicate', async () => {
    const onCopy = vi.fn().mockResolvedValue(undefined);
    const onDuplicate = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(
      <VersionHistoryDialog
        open
        onOpenChange={vi.fn()}
        prompt={prompt}
        onCopy={onCopy}
        onDuplicate={onDuplicate}
        onRestore={vi.fn()}
      />,
    );

    const dialog = screen.getByRole('dialog');
    await within(dialog).findByText('Saved versions');
    const versionList = within(dialog).getByRole('complementary', { name: 'Saved versions' });
    expect(await within(versionList).findByRole('button', { name: /version 1/i })).toBeInTheDocument();
    expect(screen.getByText('before')).toBeInTheDocument();
    expect(screen.getByText('after')).toBeInTheDocument();
    expect(screen.getByText(/removed/i)).toBeInTheDocument();
    expect(screen.getByText(/added/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Copy version 1' }));
    await waitFor(() => expect(onCopy).toHaveBeenCalledWith(prompt.id, 'before\nkeep'));

    await user.click(screen.getByRole('button', { name: 'Duplicate version 1' }));
    await waitFor(() => expect(onDuplicate).toHaveBeenCalledWith(prompt.id, version.id));
    expect(screen.getByRole('status')).toHaveTextContent(/estimated version history size/i);
  });

  it('shows a quota warning when browser storage is nearly full', async () => {
    const estimate = vi.fn().mockResolvedValue({ usage: 900, quota: 1000 });
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: { estimate },
    });

    render(
      <VersionHistoryDialog
        open
        onOpenChange={vi.fn()}
        prompt={prompt}
        onCopy={vi.fn().mockResolvedValue(undefined)}
        onDuplicate={vi.fn().mockResolvedValue(undefined)}
        onRestore={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(/nearing its quota/i);
    expect(estimate).toHaveBeenCalledOnce();
    delete (navigator as Navigator & { storage?: unknown }).storage;
  });

  it('previews and confirms a restore before invoking the restore action', async () => {
    const onRestore = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();
    const user = userEvent.setup();

    render(
      <VersionHistoryDialog
        open
        onOpenChange={onOpenChange}
        prompt={prompt}
        onCopy={vi.fn().mockResolvedValue(undefined)}
        onDuplicate={vi.fn().mockResolvedValue(undefined)}
        onRestore={onRestore}
      />,
    );

    await user.click(await screen.findByRole('button', { name: 'Restore version 1' }));
    expect(screen.getByRole('alert')).toHaveTextContent('before');
    expect(screen.getByRole('alert')).toHaveTextContent('after');
    expect(onRestore).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Confirm restore version 1' }));
    await waitFor(() => expect(onRestore).toHaveBeenCalledWith(prompt.id, version.id));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
