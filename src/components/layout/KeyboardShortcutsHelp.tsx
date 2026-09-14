import { useState } from 'react';
import { Keyboard } from 'lucide-react';
import { Button } from '../common/Button';
import { Dialog } from '../common/Dialog';

const shortcuts = [
  ['Ctrl/⌘ + N', 'New prompt'],
  ['/', 'Focus search when you are not typing'],
  ['Ctrl/⌘ + Shift + P', 'Open the command palette'],
  ['Enter', 'Open the focused prompt card'],
  ['C', 'Copy the focused prompt'],
  ['F', 'Favorite or unfavorite the focused prompt'],
  ['E', 'Edit the focused prompt'],
  ['D', 'Duplicate the focused prompt'],
  ['Ctrl/⌘ + Enter', 'Save the open prompt form'],
  ['Escape', 'Close the open dialog or mobile navigation'],
  ['Arrow Up / Arrow Down', 'Move through command palette results'],
  ['Home / End', 'Jump to the first or last palette result'],
] as const;

export function KeyboardShortcutsHelp() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="ghost" size="sm" aria-label="Keyboard shortcuts" onClick={() => setOpen(true)}>
        <Keyboard className="h-4 w-4" />
        <span className="hidden sm:inline">Shortcuts</span>
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Keyboard shortcuts"
        description="Shortcuts are available while Prompt Library is active."
        maxWidthClass="max-h-[calc(100vh-2rem)] max-w-2xl overflow-y-auto"
      >
        <dl className="grid gap-2 sm:grid-cols-2">
          {shortcuts.map(([keys, description]) => (
            <div key={keys} className="flex items-center justify-between gap-3 rounded-md border border-neutral-200 px-3 py-2 dark:border-neutral-800">
              <dt>
                <kbd className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-xs text-neutral-800 dark:bg-neutral-800 dark:text-neutral-100">
                  {keys}
                </kbd>
              </dt>
              <dd className="text-right text-sm text-neutral-600 dark:text-neutral-300">{description}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-xs text-neutral-500">
          Ctrl/⌘ + N and Ctrl/⌘ + Shift + P can overlap browser or operating-system shortcuts. If your browser wins, use the visible buttons and menus.
        </p>
        <p className="mt-2 text-xs text-neutral-500">Actions also remain available through buttons and menus.</p>
      </Dialog>
    </>
  );
}
