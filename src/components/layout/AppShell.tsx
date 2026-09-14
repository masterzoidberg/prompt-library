import { useState, useCallback, useRef } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { MobileSidebar } from './MobileSidebar';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useApplyTheme } from '../../hooks/useTheme';
import { useSettings } from '../../hooks/useSettings';
import { useAppState } from '../../hooks/useAppState';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const { settings } = useSettings();
  const { dialog, paletteOpen, setPaletteOpen, setDialog } = useAppState();
  useApplyTheme(settings?.theme);

  const focusSearch = useCallback(() => {
    if (dialog.kind !== 'none' || paletteOpen) return;
    const inputs = document.querySelectorAll<HTMLInputElement>('input[type="search"]');
    const el = inputs[0] ?? null;
    if (el) {
      el.focus();
      el.select();
    }
    searchRef.current = el;
  }, [dialog.kind, paletteOpen]);

  const openNewPrompt = useCallback(() => {
    if (dialog.kind !== 'none' || paletteOpen) return;
    setDialog({ kind: 'new-prompt' });
  }, [dialog.kind, paletteOpen, setDialog]);

  const openPalette = useCallback(() => {
    if (dialog.kind !== 'none' || paletteOpen) return;
    setPaletteOpen(true);
  }, [dialog.kind, paletteOpen, setPaletteOpen]);

  const closeOverlays = useCallback(() => {
    if (dialog.kind !== 'none' || paletteOpen) return;
    setMobileOpen(false);
  }, [dialog.kind, paletteOpen]);

  useKeyboardShortcuts({ focusSearch, openPalette, openNewPrompt, closeOverlays });

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <a
        href="#main"
        className="sr-only focus:not-sr-only fixed left-4 top-2 z-[60] rounded-md bg-white px-3 py-2 text-sm font-medium text-neutral-900 shadow-lg dark:bg-neutral-900 dark:text-neutral-100"
      >
        Skip to main content
      </a>
      <div className="hidden lg:flex">
        <Sidebar />
      </div>
      <MobileSidebar open={mobileOpen} onClose={() => setMobileOpen(false)}>
        <Sidebar />
      </MobileSidebar>
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onToggleSidebar={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto scrollbar-thin" id="main" tabIndex={-1} aria-label="Prompt library content">
          {children}
        </main>
      </div>
    </div>
  );
}
