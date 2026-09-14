import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import type { Bundle, Prompt } from '../../types';
import { BundlePanel } from './BundlePanel';

const prompts: Prompt[] = [
  {
    id: 'prompt-1',
    title: 'First prompt',
    content: 'First content',
    folderId: 'unfiled',
    tagIds: [],
    isFavorite: false,
    copyCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    lastCopiedAt: null,
    type: 'prompt',
    targetTools: [],
    variableDefaults: {},
  },
  {
    id: 'prompt-2',
    title: 'Second prompt',
    content: 'Hello {{NAME}}',
    folderId: 'unfiled',
    tagIds: [],
    isFavorite: false,
    copyCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    lastCopiedAt: null,
    type: 'prompt',
    targetTools: [],
    variableDefaults: {},
  },
];

const bundle: Bundle = {
  id: 'bundle-1',
  name: 'Daily flow',
  description: 'Ordered work',
  promptIds: ['prompt-1', 'prompt-2'],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('BundlePanel', () => {
  it('selects the next item and delegates open, copy, fill, and reorder actions', async () => {
    const onOpenPrompt = vi.fn();
    const onCopyPrompt = vi.fn().mockResolvedValue(undefined);
    const onFillPrompt = vi.fn();
    const onReorder = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(
      <BundlePanel
        bundle={bundle}
        prompts={prompts}
        onOpenPrompt={onOpenPrompt}
        onCopyPrompt={onCopyPrompt}
        onFillPrompt={onFillPrompt}
        onReorder={onReorder}
        onEdit={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Daily flow' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'First prompt' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next asset' }));
    expect(screen.getByRole('heading', { name: 'Second prompt' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Open current asset' }));
    expect(onOpenPrompt).toHaveBeenCalledWith('prompt-2');
    await user.click(screen.getByRole('button', { name: 'Copy current asset' }));
    expect(onCopyPrompt).toHaveBeenCalledWith('prompt-2');
    await user.click(screen.getByRole('button', { name: 'Fill current asset' }));
    expect(onFillPrompt).toHaveBeenCalledWith('prompt-2');

    await user.click(screen.getByRole('button', { name: 'Select bundle item 1: First prompt' }));
    await user.click(screen.getByRole('button', { name: 'Move bundle item 1 down' }));
    expect(onReorder).toHaveBeenCalledWith(['prompt-2', 'prompt-1']);
  });

  it('clearly reports unavailable and empty membership states', () => {
    const { rerender } = render(
      <BundlePanel
        bundle={{ ...bundle, promptIds: ['missing-prompt'] }}
        prompts={prompts}
        onOpenPrompt={vi.fn()}
        onCopyPrompt={vi.fn().mockResolvedValue(undefined)}
        onFillPrompt={vi.fn()}
        onReorder={vi.fn().mockResolvedValue(undefined)}
        onEdit={vi.fn()}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('1 unavailable bundle item');

    rerender(
      <BundlePanel
        bundle={{ ...bundle, promptIds: [] }}
        prompts={prompts}
        onOpenPrompt={vi.fn()}
        onCopyPrompt={vi.fn().mockResolvedValue(undefined)}
        onFillPrompt={vi.fn()}
        onReorder={vi.fn().mockResolvedValue(undefined)}
        onEdit={vi.fn()}
      />,
    );

    expect(screen.getByText('This bundle is empty.')).toBeInTheDocument();
  });
});
