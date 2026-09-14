import type { TextareaHTMLAttributes } from 'react';
import { forwardRef } from 'react';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className = '', ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={`w-full rounded-md border border-neutral-300 bg-white px-3 py-2 font-mono text-sm text-neutral-900 placeholder-neutral-400 focus:border-accent-500 focus:outline-none disabled:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder-neutral-500 ${className}`}
      {...rest}
    />
  );
});