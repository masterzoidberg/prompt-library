import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import 'fake-indexeddb/auto';
import { PromptCard } from './PromptCard';
import type { Prompt, Folder, Tag } from '../../types';
import type { SearchMatch } from '../../utils/search';

const folder: Folder = {
  id: 'f1',
  name: 'Writing',
  normalizedName: 'writing',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

const tags: Tag[] = [
  { id: 't1', name: 'code', normalizedName: 'code', createdAt: '', updatedAt: '' },
];

const prompt: Prompt = {
  id: 'p1',
  title: 'Hello',
  content: 'line1\nline2',
  description: 'desc',
  folderId: 'f1',
  tagIds: ['t1'],
  isFavorite: false,
  copyCount: 0,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  lastCopiedAt: null,
  type: 'template',
  targetTools: ['chatgpt', 'codex'],
  notes: 'Use this for a first draft.',
  variableDefaults: {},
};

describe('PromptCard', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('renders title and preview', () => {
    render(
      <PromptCard
        prompt={prompt}
        folder={folder}
        tags={tags}
        onCopy={vi.fn()}
        onEdit={vi.fn()}
        onDuplicate={vi.fn()}
        onDelete={vi.fn()}
        onMove={vi.fn()}
        onToggleFavorite={vi.fn()}
      />,
    );
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText(/line1/)).toBeInTheDocument();
    expect(screen.getByText('Type: Template')).toBeInTheDocument();
    expect(screen.getByText('Target: ChatGPT')).toBeInTheDocument();
    expect(screen.getByText('Target: Codex')).toBeInTheDocument();
    expect(screen.getByText(/Use this for a first draft\./)).toBeInTheDocument();
  });

  it('opens the read-first detail view through an explicit action', () => {
    const onOpen = vi.fn();
    render(
      <PromptCard
        prompt={prompt}
        folder={folder}
        tags={tags}
        onOpen={onOpen}
        onCopy={vi.fn()}
        onEdit={vi.fn()}
        onDuplicate={vi.fn()}
        onDelete={vi.fn()}
        onMove={vi.fn()}
        onToggleFavorite={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open prompt: Hello' }));
    expect(onOpen).toHaveBeenCalledWith('p1');
    expect(screen.getByRole('article', { name: 'Prompt: Hello' })).toBeInTheDocument();
  });

  it('keeps the card as a non-button article with independent controls', () => {
    render(
      <PromptCard
        prompt={prompt}
        folder={folder}
        tags={tags}
        onCopy={vi.fn()}
        onEdit={vi.fn()}
        onDuplicate={vi.fn()}
        onDelete={vi.fn()}
        onMove={vi.fn()}
        onToggleFavorite={vi.fn()}
      />,
    );

    const card = screen.getByRole('article', { name: 'Prompt: Hello' });
    expect(card.tagName).toBe('ARTICLE');
    expect(card).not.toHaveAttribute('role', 'button');
    expect(card.querySelector('button button, button [role="button"], [role="button"] button')).toBeNull();
  });

  it('does not copy when an inner button is clicked (stopPropagation)', () => {
    const onCopy = vi.fn();
    render(
      <PromptCard
        prompt={prompt}
        folder={folder}
        tags={tags}
        onCopy={onCopy}
        onEdit={vi.fn()}
        onDuplicate={vi.fn()}
        onDelete={vi.fn()}
        onMove={vi.fn()}
        onToggleFavorite={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /add to favorites/i }));
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
    expect(onCopy).not.toHaveBeenCalled();
  });

  it('does not treat the article as a copy action', async () => {
    const onCopy = vi.fn().mockResolvedValue(undefined);
    render(
      <PromptCard
        prompt={prompt}
        folder={folder}
        tags={tags}
        onCopy={onCopy}
        onEdit={vi.fn()}
        onDuplicate={vi.fn()}
        onDelete={vi.fn()}
        onMove={vi.fn()}
        onToggleFavorite={vi.fn()}
      />,
    );
    fireEvent.keyDown(screen.getByRole('article', { name: 'Prompt: Hello' }), { key: 'Enter' });

    await waitFor(() => expect(onCopy).not.toHaveBeenCalled());
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
  });

  it('supports focused-card shortcuts for open, copy, favorite, edit, and duplicate', async () => {
    const onOpen = vi.fn();
    const onCopy = vi.fn().mockResolvedValue(undefined);
    const onEdit = vi.fn();
    const onDuplicate = vi.fn();
    const onToggleFavorite = vi.fn();
    render(
      <PromptCard
        prompt={prompt}
        folder={folder}
        tags={tags}
        onOpen={onOpen}
        onCopy={onCopy}
        onEdit={onEdit}
        onDuplicate={onDuplicate}
        onDelete={vi.fn()}
        onMove={vi.fn()}
        onToggleFavorite={onToggleFavorite}
      />,
    );

    const card = screen.getByRole('article', { name: 'Prompt: Hello' });
    card.focus();
    fireEvent.keyDown(card, { key: 'Enter' });
    fireEvent.keyDown(card, { key: 'c' });
    fireEvent.keyDown(card, { key: 'f' });
    fireEvent.keyDown(card, { key: 'e' });
    fireEvent.keyDown(card, { key: 'd' });

    expect(onOpen).toHaveBeenCalledWith('p1');
    await waitFor(() => expect(onCopy).toHaveBeenCalledWith('p1'));
    expect(onToggleFavorite).toHaveBeenCalledWith('p1', true);
    expect(onEdit).toHaveBeenCalledWith('p1');
    expect(onDuplicate).toHaveBeenCalledWith('p1');
  });

  it('ignores focused-card shortcuts when a modifier or inner control is active', () => {
    const onCopy = vi.fn();
    render(
      <PromptCard
        prompt={prompt}
        folder={folder}
        tags={tags}
        onCopy={onCopy}
        onEdit={vi.fn()}
        onDuplicate={vi.fn()}
        onDelete={vi.fn()}
        onMove={vi.fn()}
        onToggleFavorite={vi.fn()}
      />,
    );

    const card = screen.getByRole('article', { name: 'Prompt: Hello' });
    card.focus();
    fireEvent.keyDown(card, { key: 'c', ctrlKey: true });
    fireEvent.keyDown(screen.getByRole('button', { name: 'Copy prompt' }), { key: 'c' });

    expect(onCopy).not.toHaveBeenCalled();
  });

  it('does not show a checkmark when the action owner rejects', async () => {
    const onCopy = vi.fn().mockRejectedValue(new Error('copy failed'));
    render(
      <PromptCard
        prompt={prompt}
        folder={folder}
        tags={tags}
        onCopy={onCopy}
        onEdit={vi.fn()}
        onDuplicate={vi.fn()}
        onDelete={vi.fn()}
        onMove={vi.fn()}
        onToggleFavorite={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Copy prompt' }));

    await waitFor(() => expect(onCopy).toHaveBeenCalledTimes(1));
    const copyButton = screen.getByRole('button', { name: 'Copy prompt' });
    expect(copyButton.querySelector('svg.lucide-copy')).toBeInTheDocument();
    expect(copyButton.querySelector('svg.lucide-check')).not.toBeInTheDocument();
  });

  it('offers version history from the prompt actions menu', async () => {
    const onHistory = vi.fn();
    const user = userEvent.setup();
    render(
      <PromptCard
        prompt={prompt}
        folder={folder}
        tags={tags}
        onCopy={vi.fn()}
        onEdit={vi.fn()}
        onDuplicate={vi.fn()}
        onDelete={vi.fn()}
        onMove={vi.fn()}
        onHistory={onHistory}
        onToggleFavorite={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Prompt actions' }));
    const historyItem = await screen.findByRole('menuitem', { name: /version history/i });
    await user.click(historyItem);

    expect(onHistory).toHaveBeenCalledWith('p1');
  });

  it('renders search matches as safe highlighted text', () => {
    const searchMatches: SearchMatch[] = [
      { field: 'title', value: 'Hello', start: 0, end: 5 },
      { field: 'content', value: 'line1\nline2', start: 0, end: 4 },
    ];

    render(
      <PromptCard
        prompt={prompt}
        folder={folder}
        tags={tags}
        searchMatches={searchMatches}
        onCopy={vi.fn()}
        onEdit={vi.fn()}
        onDuplicate={vi.fn()}
        onDelete={vi.fn()}
        onMove={vi.fn()}
        onToggleFavorite={vi.fn()}
      />,
    );

    expect(screen.getByText('Hello').tagName).toBe('MARK');
    expect(screen.getByText('line').tagName).toBe('MARK');
  });
});
