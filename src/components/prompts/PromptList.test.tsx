import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import 'fake-indexeddb/auto';
import { AppStateProvider } from '../../hooks/AppStateProvider';
import { useAppState } from '../../hooks/useAppState';
import { LibraryDataProvider } from '../../hooks/LibraryDataProvider';
import { SettingsProvider } from '../../hooks/SettingsProvider';
import { resetDbCache, getDb, ensureSeeded } from '../../data/db';
import * as promptRepo from '../../data/promptRepository';
import * as folderRepo from '../../data/folderRepository';
import * as tagRepo from '../../data/tagRepository';
import { notify } from '../common/Toast';
import { PromptList } from './PromptList';

beforeEach(async () => {
  await resetDbCache();
  const db = await getDb();
  await db.clear('prompts');
  await db.clear('folders');
  await db.clear('tags');
  await db.clear('settings');
  await ensureSeeded();
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderPromptList({ folderId = 'folder-empty', tagId = 'tag-empty' } = {}) {
  return render(
    <SettingsProvider>
      <LibraryDataProvider>
        <AppStateProvider>
          <ViewControls folderId={folderId} tagId={tagId} />
          <PromptList />
        </AppStateProvider>
      </LibraryDataProvider>
    </SettingsProvider>,
  );
}

function ViewControls({ folderId, tagId }: { folderId: string; tagId: string }) {
  const { setView } = useAppState();
  return (
    <div>
      <button type="button" onClick={() => setView({ kind: 'search', query: 'missing' })}>
        Show search
      </button>
      <button type="button" onClick={() => setView({ kind: 'search', query: 'needle' })}>
        Show ranked search
      </button>
      <button type="button" onClick={() => setView({ kind: 'favorites' })}>
        Show favorites
      </button>
      <button type="button" onClick={() => setView({ kind: 'recent' })}>
        Show recent
      </button>
      <button type="button" onClick={() => setView({ kind: 'most-used' })}>
        Show most used
      </button>
      <button type="button" onClick={() => setView({ kind: 'folder', folderId })}>
        Show folder
      </button>
      <button type="button" onClick={() => setView({ kind: 'tag', tagId })}>
        Show tag
      </button>
      <button type="button" onClick={() => setView({ kind: 'type', type: 'template' })}>
        Show templates
      </button>
      <button type="button" onClick={() => setView({ kind: 'target-tool', targetTool: 'codex' })}>
        Show Codex prompts
      </button>
    </div>
  );
}

describe('PromptList copy action', () => {
  it('writes once and records one usage only after clipboard success', async () => {
    const prompt = await promptRepo.createPrompt({
      title: 'Copy once',
      content: 'exact content',
    });
    const successSpy = vi.spyOn(notify, 'success').mockImplementation(() => undefined);

    renderPromptList();
    fireEvent.click(await screen.findByRole('button', { name: 'Copy prompt' }));

    await waitFor(async () => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('exact content');
      expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
      expect((await promptRepo.getPrompt(prompt.id))?.copyCount).toBe(1);
    });
    expect(successSpy).toHaveBeenCalledWith('Copied to clipboard');
  });

  it('does not record usage and reports a clipboard failure', async () => {
    const prompt = await promptRepo.createPrompt({
      title: 'Clipboard failure',
      content: 'not copied',
    });
    const writeText = vi.fn().mockRejectedValue(new Error('clipboard unavailable'));
    Object.assign(navigator, { clipboard: { writeText } });
    const errorSpy = vi.spyOn(notify, 'error').mockImplementation(() => undefined);

    renderPromptList();
    fireEvent.click(await screen.findByRole('button', { name: 'Copy prompt' }));

    await waitFor(() => expect(errorSpy).toHaveBeenCalledWith('Failed to copy'));
    expect(writeText).toHaveBeenCalledTimes(1);
    expect((await promptRepo.getPrompt(prompt.id))?.copyCount).toBe(0);
  });

  it('reports a persistence failure without showing a successful copy', async () => {
    const prompt = await promptRepo.createPrompt({
      title: 'Persistence failure',
      content: 'copied but not recorded',
    });
    const recordCopySpy = vi
      .spyOn(promptRepo, 'recordCopy')
      .mockRejectedValueOnce(new Error('storage unavailable'));
    const successSpy = vi.spyOn(notify, 'success').mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(notify, 'error').mockImplementation(() => undefined);

    renderPromptList();
    fireEvent.click(await screen.findByRole('button', { name: 'Copy prompt' }));

    await waitFor(() => expect(errorSpy).toHaveBeenCalledWith('Failed to copy'));
    expect(recordCopySpy).toHaveBeenCalledWith(prompt.id);
    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
    expect(successSpy).not.toHaveBeenCalled();
    expect((await promptRepo.getPrompt(prompt.id))?.copyCount).toBe(0);
  });

  it('describes empty search, favorite, folder, and tag views', async () => {
    const folder = await folderRepo.createFolder({ name: 'Empty folder' });
    const tag = await tagRepo.createTag({ name: 'unused' });
    await promptRepo.createPrompt({ title: 'Existing prompt', content: 'content' });

    renderPromptList({ folderId: folder.id, tagId: tag.id });

    fireEvent.click(screen.getByRole('button', { name: 'Show search' }));
    expect(await screen.findByRole('heading', { name: 'No prompts found' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear search' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show favorites' }));
    expect(await screen.findByRole('heading', { name: 'No favorite prompts' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Browse all prompts' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show folder' }));
    expect(await screen.findByRole('heading', { name: 'No prompts in Empty folder' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show tag' }));
    expect(await screen.findByRole('heading', { name: 'No prompts tagged #unused' })).toBeInTheDocument();
  });

  it('shows recent and most-used views using their dedicated ordering and usage criteria', async () => {
    const older = await promptRepo.createPrompt({ title: 'Older prompt', content: 'older' });
    await promptRepo.createPrompt({ title: 'Newer prompt', content: 'newer' });
    await new Promise((resolve) => setTimeout(resolve, 2));
    await promptRepo.updatePrompt(older.id, { description: 'recently updated' });
    await promptRepo.recordCopy(older.id);

    renderPromptList();

    fireEvent.click(screen.getByRole('button', { name: 'Show recent' }));
    expect((await screen.findAllByRole('article', { name: /Prompt:/ })).map((card) => card.getAttribute('aria-label'))).toEqual([
      'Prompt: Older prompt',
      'Prompt: Newer prompt',
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Show most used' }));
    expect(await screen.findByRole('article', { name: 'Prompt: Older prompt' })).toBeInTheDocument();
    expect(screen.queryByRole('article', { name: 'Prompt: Newer prompt' })).not.toBeInTheDocument();
  });

  it('describes empty recent and most-used views', async () => {
    renderPromptList();

    fireEvent.click(screen.getByRole('button', { name: 'Show recent' }));
    expect(await screen.findByRole('heading', { name: 'No recent prompts' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show most used' }));
    expect(await screen.findByRole('heading', { name: 'No most-used prompts' })).toBeInTheDocument();
  });

  it('filters prompts by type and target tool', async () => {
    await promptRepo.createPrompt({
      title: 'Template prompt',
      content: 'Template content',
      type: 'template',
      targetTools: ['chatgpt'],
    });
    await promptRepo.createPrompt({
      title: 'Coding prompt',
      content: 'Coding content',
      type: 'coding-task',
      targetTools: ['codex'],
    });

    renderPromptList();

    fireEvent.click(screen.getByRole('button', { name: 'Show templates' }));
    expect(await screen.findByText('Template prompt')).toBeInTheDocument();
    expect(screen.queryByText('Coding prompt')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show Codex prompts' }));
    expect(await screen.findByText('Coding prompt')).toBeInTheDocument();
    expect(screen.queryByText('Template prompt')).not.toBeInTheDocument();
  });

  it('renders ranked search results with safe highlights', async () => {
    await promptRepo.createPrompt({ title: 'needle', content: 'Exact content' });
    await promptRepo.createPrompt({ title: 'needle plan', content: 'Prefix content' });
    await promptRepo.createPrompt({ title: 'Other prompt', content: 'This contains needle.' });

    renderPromptList();

    fireEvent.click(screen.getByRole('button', { name: 'Show ranked search' }));
    const resultCards = await screen.findAllByRole('article', { name: /Prompt:/ });

    expect(resultCards.map((card) => card.getAttribute('aria-label'))).toEqual([
      'Prompt: needle',
      'Prompt: needle plan',
      'Prompt: Other prompt',
    ]);
    expect(screen.getAllByText('needle').some((element) => element.tagName === 'MARK')).toBe(true);
  });
});
