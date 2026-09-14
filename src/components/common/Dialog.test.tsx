import { describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { useState } from 'react';
import { Dialog } from './Dialog';

function DialogHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open test dialog
      </button>
      <Dialog open={open} onOpenChange={setOpen} title="Test dialog">
        <button type="button">First action</button>
        <button type="button">Last action</button>
      </Dialog>
    </>
  );
}

describe('Dialog', () => {
  it('traps focus and restores the opener when closed', async () => {
    const user = userEvent.setup();
    render(<DialogHarness />);

    const trigger = screen.getByRole('button', { name: 'Open test dialog' });
    await user.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: 'Test dialog' });
    const close = within(dialog).getByRole('button', { name: 'Close dialog' });
    const lastAction = within(dialog).getByRole('button', { name: 'Last action' });

    await waitFor(() => expect(close).toHaveFocus());
    lastAction.focus();
    await user.tab();
    expect(close).toHaveFocus();
    await user.click(close);
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('provides a scroll-contained mobile-sized surface', () => {
    render(
      <Dialog open onOpenChange={() => undefined} title="Test dialog">
        <button type="button">Dialog action</button>
      </Dialog>,
    );

    expect(screen.getByRole('dialog', { name: 'Test dialog' })).toHaveClass(
      'max-h-[calc(100vh-2rem)]',
      'overflow-y-auto',
      'overscroll-contain',
    );
  });
});
