import { useEffect, useMemo, useState } from 'react';
import { Button } from '../common/Button';
import { Dialog } from '../common/Dialog';
import { Textarea } from '../common/Textarea';
import { useSettings } from '../../hooks/useSettings';
import { detectVariables, renderTemplate } from '../../services/templateService';
import type { Prompt } from '../../types';

interface FillPromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prompt: Prompt;
  onCopy: (id: string, content: string) => Promise<void>;
}

function initialValues(prompt: Prompt, remembered: Record<string, string>): Record<string, string> {
  const values: Record<string, string> = {};
  for (const name of detectVariables(prompt.content)) {
    if (Object.prototype.hasOwnProperty.call(prompt.variableDefaults, name)) {
      values[name] = prompt.variableDefaults[name];
    } else if (Object.prototype.hasOwnProperty.call(remembered, name)) {
      values[name] = remembered[name];
    } else {
      values[name] = '';
    }
  }
  return values;
}

export function FillPromptDialog({ open, onOpenChange, prompt, onCopy }: FillPromptDialogProps) {
  const { settings, update } = useSettings();
  const variables = useMemo(() => detectVariables(prompt.content), [prompt.content]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setValues(initialValues(prompt, settings?.rememberedVariableValues ?? {}));
    setRemember(false);
    setError(null);
    setBusy(false);
  }, [open, prompt, settings?.rememberedVariableValues]);

  const result = useMemo(() => renderTemplate(prompt.content, values), [prompt.content, values]);
  const hasIssues = result.missingVariables.length > 0 || result.malformedTokens.length > 0;

  const handleCopy = async (allowPlaceholders: boolean) => {
    if (busy || (!allowPlaceholders && hasIssues)) return;
    setError(null);
    setBusy(true);
    try {
      await onCopy(prompt.id, result.rendered);
      if (remember) {
        const remembered = { ...(settings?.rememberedVariableValues ?? {}) };
        for (const name of variables) {
          const value = values[name];
          if (value) remembered[name] = value;
        }
        await update({ rememberedVariableValues: remembered });
      }
      onOpenChange(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to copy rendered prompt.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Fill variables: ${prompt.title}`}
      description="Fill values for this copy only. The saved prompt stays unchanged."
      maxWidthClass="max-h-[calc(100vh-2rem)] max-w-2xl overflow-y-auto"
    >
      <div className="space-y-4">
        {variables.length > 0 ? (
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold">Values</legend>
            {variables.map((name) => (
              <div key={name}>
                <label htmlFor={`prompt-variable-value-${name}`} className="mb-1 block text-sm">
                  Value for {name}
                </label>
                <Textarea
                  id={`prompt-variable-value-${name}`}
                  value={values[name] ?? ''}
                  onChange={(event) =>
                    setValues((current) => ({ ...current, [name]: event.target.value }))
                  }
                  placeholder={`Value for {{${name}}}`}
                  rows={3}
                />
              </div>
            ))}
          </fieldset>
        ) : (
          <p className="text-sm text-neutral-500">This prompt has no valid variables to fill.</p>
        )}

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={remember}
            onChange={(event) => setRemember(event.target.checked)}
            className="h-4 w-4 rounded border-neutral-300 accent-accent-600"
          />
          Remember these values on this device
        </label>
        <p className="text-xs text-neutral-500">
          Remembered values are stored locally and are not encrypted.
        </p>

        <section aria-labelledby="rendered-prompt-preview" className="space-y-2">
          <h3 id="rendered-prompt-preview" className="text-sm font-semibold">
            Preview
          </h3>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md border border-neutral-200 bg-neutral-50 p-3 font-mono text-sm dark:border-neutral-800 dark:bg-neutral-900">
            {result.rendered}
          </pre>
        </section>

        {result.missingVariables.length > 0 ? (
          <p role="alert" className="text-sm text-amber-700 dark:text-amber-300">
            Missing values: {result.missingVariables.join(', ')}
          </p>
        ) : null}
        {result.malformedTokens.length > 0 ? (
          <p role="alert" className="text-sm text-amber-700 dark:text-amber-300">
            Malformed tokens remain unchanged: {result.malformedTokens.join(', ')}
          </p>
        ) : null}
        {error ? <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

        <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          {hasIssues ? (
            <Button
              variant="secondary"
              onClick={() => void handleCopy(true)}
              disabled={busy}
            >
              Copy with placeholders
            </Button>
          ) : null}
          <Button
            variant="primary"
            onClick={() => void handleCopy(false)}
            disabled={busy || hasIssues}
          >
            {busy ? 'Copying…' : 'Copy rendered'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
