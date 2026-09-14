import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import type { Bundle, Folder, Prompt, Tag } from '../../types';
import { PromptDetailDialog } from './PromptDetailDialog';

const prompt: Prompt = {
  id: 'prompt-1',
  title: 'Long prompt',
  content: '# Heading\n\nA complete Markdown body that should remain readable.\n\nAuthor: {{NAME}}',
  description: 'A reusable research prompt.',
  folderId: 'folder-1',
  tagIds: ['tag-1'],
  isFavorite: true,
  copyCount: 4,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  lastCopiedAt: '2026-01-03T00:00:00.000Z',
  type: 'template',
  targetTools: ['chatgpt'],
  notes: 'Keep the evidence boundary explicit.',
  variableDefaults: { NAME: 'Ada' },
};

const folder: Folder = {
  id: 'folder-1',
  name: 'Research',
  normalizedName: 'research',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const tags: Tag[] = [
  {
    id: 'tag-1',
    name: 'Evidence',
    normalizedName: 'evidence',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

const bundles: Bundle[] = [
  {
    id: 'bundle-1',
    name: 'Research flow',
    promptIds: ['prompt-1'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

describe('PromptDetailDialog', () => {
  it('shows full authored content, metadata, variables, bundle context, and explicit actions', async () => {
    const onCopy = vi.fn().mockResolvedValue(undefined);
    const onFill = vi.fn();
    const onEdit = vi.fn();
    const onHistory = vi.fn();
    const onOpenBundle = vi.fn();
    const user = userEvent.setup();

    render(
      <PromptDetailDialog
        open
        onOpenChange={vi.fn()}
        prompt={prompt}
        folder={folder}
        tags={tags}
        bundles={bundles}
        onCopy={onCopy}
        onFill={onFill}
        onEdit={onEdit}
        onHistory={onHistory}
        onOpenBundle={onOpenBundle}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Prompt detail: Long prompt' })).toBeInTheDocument();
    expect(screen.getByText(/# Heading/)).toBeInTheDocument();
    expect(screen.getByText('A reusable research prompt.')).toBeInTheDocument();
    expect(screen.getByText('Keep the evidence boundary explicit.')).toBeInTheDocument();
    expect(screen.getByText('Research')).toBeInTheDocument();
    expect(screen.getByText('#Evidence')).toBeInTheDocument();
    const variableSection = screen.getByRole('heading', { name: 'Variables' }).closest('section') as HTMLElement;
    expect(variableSection).toHaveTextContent('NAME');
    expect(variableSection).toHaveTextContent('Ada');
    expect(screen.getByText('Research flow')).toBeInTheDocument();
    expect(screen.getByText('Usage').parentElement as HTMLElement).toHaveTextContent('4 copies');

    await user.click(screen.getByRole('button', { name: 'Copy prompt' }));
    await user.click(screen.getByRole('button', { name: 'Fill variables' }));
    await user.click(screen.getByRole('button', { name: 'Edit prompt' }));
    await user.click(screen.getByRole('button', { name: 'Version history' }));
    await user.click(screen.getByRole('button', { name: 'Open bundle: Research flow' }));

    expect(onCopy).toHaveBeenCalledTimes(1);
    expect(onFill).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onHistory).toHaveBeenCalledTimes(1);
    expect(onOpenBundle).toHaveBeenCalledWith('bundle-1');
  });
});
