import { useCallback, useEffect, useState } from 'react';
import { AppShell } from './components/layout/AppShell';
import { AppStateProvider } from './hooks/AppStateProvider';
import { LibraryDataProvider } from './hooks/LibraryDataProvider';
import { ensureSeeded } from './data/db';
import { runMigrations } from './data/migrations';
import { PromptList } from './components/prompts/PromptList';
import { DialogRouter } from './components/prompts/DialogRouter';
import { SettingsProvider } from './hooks/SettingsProvider';
import { useLibraryData } from './hooks/useLibraryData';
import { Button } from './components/common/Button';
import { CommandPalette } from './components/layout/CommandPalette';

function toError(error: unknown, fallback: string): Error {
  return error instanceof Error ? error : new Error(fallback);
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [startupError, setStartupError] = useState<Error | null>(null);

  const initialize = useCallback(async () => {
    setReady(false);
    setStartupError(null);
    try {
      await ensureSeeded();
      await runMigrations();
      setReady(true);
    } catch (cause) {
      setStartupError(toError(cause, 'Failed to prepare the local library'));
    }
  }, []);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  if (startupError) {
    return (
      <RecoveryState
        title="Library unavailable"
        description="Prompt Library could not prepare its local data. Your existing data was not cleared. Retry, or use a known-good backup/recovery file if the problem continues."
        onRetry={initialize}
      />
    );
  }

  if (!ready) {
    return <LoadingState />;
  }

  return (
    <SettingsProvider>
      <LibraryDataProvider>
        <AppStateProvider>
          <LibraryContent />
        </AppStateProvider>
      </LibraryDataProvider>
    </SettingsProvider>
  );
}

function LibraryContent() {
  const { loaded, error, reload } = useLibraryData();

  if (error) {
    return (
      <RecoveryState
        title="Library unavailable"
        description="Prompt Library could not load your local data. Your existing data was not cleared. Retry, or use a known-good backup/recovery file if the problem continues."
        onRetry={async () => {
          try {
            await reload();
          } catch {
            // The provider keeps the recovery state and exposes the next error.
          }
        }}
      />
    );
  }

  if (!loaded) return <LoadingState />;

  return (
    <>
      <AppShell>
        <PromptList />
      </AppShell>
      <CommandPalette />
      <DialogRouter />
    </>
  );
}

function LoadingState() {
  return (
    <div className="flex h-screen items-center justify-center bg-neutral-50 dark:bg-neutral-950">
      <p className="text-sm text-neutral-500">Loading…</p>
    </div>
  );
}

function RecoveryState({
  title,
  description,
  onRetry,
}: {
  title: string;
  description: string;
  onRetry: () => Promise<void> | void;
}) {
  return (
    <main
      role="alert"
      className="flex h-screen flex-col items-center justify-center gap-3 bg-neutral-50 p-6 text-center dark:bg-neutral-950"
    >
      <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{title}</h1>
      <p className="max-w-lg text-sm text-neutral-600 dark:text-neutral-300">{description}</p>
      <Button variant="primary" onClick={() => void onRetry()}>
        Retry
      </Button>
    </main>
  );
}
