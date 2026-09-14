import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { useState } from 'react';
import { MobileSidebar } from './MobileSidebar';

function MobileSidebarHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open navigation
      </button>
      <MobileSidebar open={open} onClose={() => setOpen(false)}>
        <nav aria-label="Library navigation">
          <button type="button">First link</button>
          <button type="button">Last link</button>
        </nav>
      </MobileSidebar>
    </>
  );
}

describe('MobileSidebar', () => {
  it('names the drawer, traps focus, closes with Escape, and restores the trigger focus', async () => {
    const user = userEvent.setup();
    render(<MobileSidebarHarness />);

    const trigger = screen.getByRole('button', { name: 'Open navigation' });
    await user.click(trigger);

    const drawer = await screen.findByRole('dialog', { name: 'Navigation' });
    const close = within(drawer).getByRole('button', { name: 'Close navigation' });
    const firstLink = within(drawer).getByRole('button', { name: 'First link' });
    const lastLink = within(drawer).getByRole('button', { name: 'Last link' });

    await waitFor(() => expect(close).toHaveFocus());
    lastLink.focus();
    await user.tab();
    expect(close).toHaveFocus();
    close.focus();
    await user.tab();
    expect(firstLink).toHaveFocus();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Navigation' })).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it('does not close from an Escape key outside the drawer content', () => {
    const onClose = vi.fn();
    render(
      <MobileSidebar open onClose={onClose}>
        <button type="button">Drawer action</button>
      </MobileSidebar>,
    );

    const outside = document.createElement('button');
    outside.type = 'button';
    document.body.append(outside);
    outside.focus();
    outside.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }));

    expect(onClose).not.toHaveBeenCalled();
    outside.remove();
  });
});
