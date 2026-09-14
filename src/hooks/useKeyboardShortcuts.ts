import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

interface ShortcutHandlers {
  focusSearch: () => void;
  openPalette: () => void;
  openNewPrompt: () => void;
  closeOverlays: () => void;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers): RefObject<boolean> {
  const activeRef = useRef(true);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target instanceof HTMLElement ? e.target : null;
      const isEditable = Boolean(
        target &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable ||
            target.closest('[contenteditable="true"]')),
      );

      if (
        (e.ctrlKey || e.metaKey) &&
        !e.shiftKey &&
        !e.altKey &&
        !e.repeat &&
        e.key.toLowerCase() === 'n' &&
        !isEditable
      ) {
        e.preventDefault();
        handlers.openNewPrompt();
        return;
      }

      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        !e.altKey &&
        !e.repeat &&
        e.key.toLowerCase() === 'p'
      ) {
        e.preventDefault();
        handlers.openPalette();
        return;
      }

      if (e.key === 'Escape' && !isEditable) {
        handlers.closeOverlays();
        return;
      }

      if (e.key === '/' && !isEditable) {
        e.preventDefault();
        handlers.focusSearch();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handlers]);
  return activeRef;
}
