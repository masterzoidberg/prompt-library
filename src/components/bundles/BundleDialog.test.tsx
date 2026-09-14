import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import type { Prompt } from '../../types';
import { BundleDialog } from './BundleDialog';

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
    content: 'Second content',
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

describe('BundleDialog', () => {
  it('submits selected prompts in stable order and preserves optional description', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(
      <BundleDialog
        open
        onOpenChange={vi.fn()}
        prompts={prompts}
        onSubmit={onSubmit}
      />,
    );

    await user.type(screen.getByLabelText('Name'), 'Daily flow');
    await user.click(screen.getByLabelText('Include prompt 2: Second prompt'));
    await user.click(screen.getByLabelText('Include prompt 1: First prompt'));
    await user.click(screen.getByRole('button', { name: 'Save', exact: true }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Daily flow',
      description: undefined,
      promptIds: ['prompt-2', 'prompt-1'],
    });
  });
});
