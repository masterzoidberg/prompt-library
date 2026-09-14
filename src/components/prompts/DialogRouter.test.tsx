import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import 'fake-indexeddb/auto';
import { AppStateProvider } from '../../hooks/AppStateProvider';
import { LibraryDataProvider } from '../../hooks/LibraryDataProvider';
import { SettingsProvider } from '../../hooks/SettingsProvider';
import { useAppState } from '../../hooks/useAppState';
import { usePrompts } from '../../hooks/usePrompts';
import { resetDbCache, getDb, ensureSeeded } from '../../data/db';
import * as promptRepo from '../../data/promptRepository';
import * as settingsRepo from '../../data/settingsRepository';
import { DEFAULT_SETTINGS } from '../../types/settings';
import { DialogRouter } from './DialogRouter';

beforeEach(async () => {
  await resetDbCache();
  const db = await getDb();
  await db.clear('prompts');
  await db.clear('promptVersions');
  await db.clear('bundles');
  await db.clear('folders');
  await db.clear('tags');
  await db.clear('settings');
  await ensureSeeded();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function DeleteTrigger({ promptId }: { promptId: string }) {
  const { prompts } = usePrompts();
  const { setDialog } = useAppState();
  return (
    <button
      type="button"
      disabled={!prompts.some((prompt) => prompt.id === promptId)}
      onClick={() => setDialog({ kind: 'delete-prompt', promptId })}
    >
      Explicit delete
    </button>
  );
}

function HistoryTrigger({ promptId }: { promptId: string }) {
  const { prompts } = usePrompts();
  const { setDialog } = useAppState();
  return (
    <button
      type="button"
      disabled={!prompts.some((prompt) => prompt.id === promptId)}
      onClick={() => setDialog({ kind: 'history-prompt', promptId })}
    >
      Open version history
    </button>
  );
}

function DetailTrigger({ promptId }: { promptId: string }) {
  const { prompts } = usePrompts();
  const { setDialog } = useAppState();
  return (
    <button
      type="button"
      disabled={!prompts.some((prompt) => prompt.id === promptId)}
      onClick={() => setDialog({ kind: 'detail-prompt', promptId })}
    >
      Open prompt detail
    </button>
  );
}

function renderRouter(promptId: string) {
  render(
    <SettingsProvider>
      <LibraryDataProvider>
        <AppStateProvider>
          <DeleteTrigger promptId={promptId} />
          <HistoryTrigger promptId={promptId} />
          <DetailTrigger promptId={promptId} />
          <DialogRouter />
        </AppStateProvider>
      </LibraryDataProvider>
    </SettingsProvider>,
  );
}

describe('DialogRouter delete policy', () => {
  it('deletes immediately after an explicit action when confirmation is disabled', async () => {
    await settingsRepo.saveSettings({ ...DEFAULT_SETTINGS, confirmBeforeDelete: false });
    const prompt = await promptRepo.createPrompt({ title: 'Delete directly', content: 'content' });
    renderRouter(prompt.id);

    const user = userEvent.setup();
    const trigger = await screen.findByRole('button', { name: 'Explicit delete' });
    await waitFor(() => expect(trigger).toBeEnabled());
    await user.click(trigger);

    await waitFor(async () => expect(await promptRepo.getPrompt(prompt.id)).toBeUndefined());
    expect(screen.queryByRole('dialog', { name: 'Delete prompt?' })).not.toBeInTheDocument();
  });

  it('keeps confirmation enabled and reports rejected deletion without changing data', async () => {
    const prompt = await promptRepo.createPrompt({ title: 'Delete failure', content: 'content' });
    vi.spyOn(promptRepo, 'deletePrompt').mockRejectedValueOnce(new Error('storage unavailable'));
    renderRouter(prompt.id);

    const user = userEvent.setup();
    const trigger = await screen.findByRole('button', { name: 'Explicit delete' });
    await waitFor(() => expect(trigger).toBeEnabled());
    await user.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: 'Delete prompt?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete', exact: true }));

    expect(await screen.findByRole('alert')).toHaveTextContent('storage unavailable');
    expect(screen.getByRole('dialog', { name: 'Delete prompt?' })).toBeVisible();
    expect(await promptRepo.getPrompt(prompt.id)).toBeDefined();
  });
});

describe('DialogRouter version history', () => {
  it('routes a prompt to its loaded version history dialog', async () => {
    const prompt = await promptRepo.createPrompt({ title: 'Current', content: 'current' });
    await promptRepo.updatePrompt(prompt.id, { content: 'updated' });
    renderRouter(prompt.id);

    const user = userEvent.setup();
    const trigger = await screen.findByRole('button', { name: 'Open version history' });
    await waitFor(() => expect(trigger).toBeEnabled());
    await user.click(trigger);

    expect(await screen.findByRole('dialog', { name: 'Version history: Current' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Copy version 1' })).toBeInTheDocument();
  });
});

describe('DialogRouter prompt detail', () => {
  it('routes a prompt to the read-first detail dialog', async () => {
    const prompt = await promptRepo.createPrompt({
      title: 'Readable prompt',
      content: '# Full content',
      description: 'Description',
    });
    renderRouter(prompt.id);

    const user = userEvent.setup();
    const trigger = await screen.findByRole('button', { name: 'Open prompt detail' });
    await waitFor(() => expect(trigger).toBeEnabled());
    await user.click(trigger);

    expect(await screen.findByRole('dialog', { name: 'Prompt detail: Readable prompt' })).toBeInTheDocument();
    expect(screen.getByText(/# Full content/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Description' })).toBeInTheDocument();
  });
});
