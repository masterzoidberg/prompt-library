import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  maxWidthClass?: string;
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"]):not([data-radix-focus-guard])',
].join(',');

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  maxWidthClass = 'max-w-lg',
}: DialogProps) {
  const previousFocusRef = useRef<HTMLElement | null>(open ? getActiveElement() : null);

  useEffect(() => {
    if (open) return;

    const captureFocus = (event?: Event) => {
      if (!event && previousFocusRef.current) return;
      const eventTarget = event?.target;
      const target =
        (eventTarget instanceof HTMLElement
          ? eventTarget.closest<HTMLElement>(FOCUSABLE_SELECTOR)
          : eventTarget instanceof Element
            ? eventTarget.closest<HTMLElement>(FOCUSABLE_SELECTOR)
            : null) ?? getActiveElement();
      if (target instanceof HTMLElement && target !== document.body && target.isConnected) {
        previousFocusRef.current = target;
      }
    };
    captureFocus();
    document.addEventListener('focusin', captureFocus);
    document.addEventListener('pointerdown', captureFocus, true);
    return () => {
      document.removeEventListener('focusin', captureFocus);
      document.removeEventListener('pointerdown', captureFocus, true);
    };
  }, [open]);

  const restoreFocus = () => {
    const previousFocus = previousFocusRef.current;
    if (previousFocus?.isConnected) previousFocus.focus();
  };

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) restoreFocus();
        onOpenChange(nextOpen);
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-modal="true"
          className={`fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] ${maxWidthClass} max-h-[calc(100vh-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto overscroll-contain rounded-lg border border-neutral-200 bg-white p-4 shadow-xl dark:border-neutral-800 dark:bg-neutral-950 sm:p-6`}
          onOpenAutoFocus={(e) => {
            const target = e.currentTarget as HTMLElement;
            const active = document.activeElement;
            if (!previousFocusRef.current && active instanceof HTMLElement && !target.contains(active)) {
              previousFocusRef.current = active;
            }
            const dangerous = target.querySelector<HTMLElement>('[data-autofocus-unsafe="true"]');
            if (dangerous) {
              e.preventDefault();
              const safe = target.querySelector<HTMLElement>(
                '[data-autofocus-safe="true"], input:not([type="hidden"]), textarea, select, button:not([disabled]):not([data-autofocus-unsafe="true"]), a[href], [tabindex]:not([tabindex="-1"])',
              );
              safe?.focus();
            }
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            restoreFocus();
          }}
        >
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="min-w-0">
              <DialogPrimitive.Title className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                {title}
              </DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                  {description}
                </DialogPrimitive.Description>
              ) : null}
            </div>
            <DialogPrimitive.Close
              aria-label="Close dialog"
              className="rounded-md p-1 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              <X className="h-5 w-5" />
            </DialogPrimitive.Close>
          </div>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function getActiveElement(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  const active = document.activeElement;
  return active instanceof HTMLElement &&
    active !== document.body &&
    !active.matches('[data-radix-focus-guard]') &&
    active.isConnected
    ? active
    : null;
}
