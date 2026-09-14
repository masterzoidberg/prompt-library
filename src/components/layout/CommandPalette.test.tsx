import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import 'fake-indexeddb/auto';
import { AppShell } from './AppShell';
import { CommandPalette } from './CommandPalette';
import { DialogRouter } from '../prompts/DialogRouter';
import { AppStateProvider } from '../../hooks/AppStateProvider';
import { LibraryDataProvider } from '../../hooks/LibraryDataProvider';
import { SettingsProvider } from '../../hooks/SettingsProvider';
import { resetDbCache, ensureSeeded, getDb } from '../../data/db';
import * as promptRepo from '../../data/promptRepository';
import * as copyUtils from '../../utils/copy';

beforeEach(async () => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  });
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

function renderPalette() {
  render(
    <SettingsProvider>
      <LibraryDataProvider>
        <AppStateProvider>
          <AppShell><div /></AppShell>
          <CommandPalette />
          <DialogRouter />
        </AppStateProvider>
      </LibraryDataProvider>
    </SettingsProvider>,
  );
}

describe('CommandPalette', () => {
  it('opens with the application shortcut, searches, opens a result, and restores focus', async () => {
    await promptRepo.createPrompt({ title: 'Palette target', content: 'Read this completely.' });
    renderPalette();

    const user = userEvent.setup();
    const mainSearch = await screen.findByRole('searchbox', { name: 'Search prompts' });
    mainSearch.focus();
    fireEvent.keyDown(window, { key: 'P', ctrlKey: true, shiftKey: true });

    const palette = await screen.findByRole('dialog', { name: 'Command palette' });
    const search = within(palette).getByRole('searchbox', { name: 'Command palette search' });
    await waitFor(() => expect(search).toHaveFocus());
    await user.type(search, 'Palette target');
    expect(within(palette).getByText('Palette target')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(mainSearch).toHaveFocus());

    fireEvent.keyDown(window, { key: 'P', ctrlKey: true, shiftKey: true });
    const reopenedPalette = await screen.findByRole('dialog', { name: 'Command palette' });
    const reopenedSearch = within(reopenedPalette).getByRole('searchbox', { name: 'Command palette search' });
    await waitFor(() => expect(reopenedSearch).toHaveFocus());
    await user.type(reopenedSearch, 'Palette target');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(await screen.findByRole('dialog', { name: 'Prompt detail: Palette target' })).toBeInTheDocument();
  });

  it('supports a keyboard-only copy action for a searched result', async () => {
    const writeText = vi.spyOn(copyUtils, 'copyToClipboard').mockResolvedValue(undefined);
    const prompt = await promptRepo.createPrompt({ title: 'Copy from palette', content: 'Copied body' });
    renderPalette();

    const user = userEvent.setup();
    const mainSearch = await screen.findByRole('searchbox', { name: 'Search prompts' });
    mainSearch.focus();
    fireEvent.keyDown(window, { key: 'P', metaKey: true, shiftKey: true });
    const palette = await screen.findByRole('dialog', { name: 'Command palette' });
    const search = within(palette).getByRole('searchbox', { name: 'Command palette search' });
    await waitFor(() => expect(search).toHaveFocus());
    await user.type(search, 'Copy from palette');
    await user.tab();
    await user.tab();
    await user.keyboard('{Enter}');

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('Copied body'));
    expect(await promptRepo.getPrompt(prompt.id)).toMatchObject({ copyCount: 1 });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Command palette' })).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('searchbox', { name: 'Search prompts' })).toHaveFocus());
  });
});
