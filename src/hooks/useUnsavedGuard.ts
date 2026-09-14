import { useEffect, useRef } from 'react';

export function useUnsavedGuard(isDirty: boolean, message = 'Discard unsaved changes?') {
  const dirtyRef = useRef(isDirty);
  useEffect(() => {
    dirtyRef.current = isDirty;
  }, [isDirty]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        e.preventDefault();
        e.returnValue = message;
        return message;
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [message]);
}

export function confirmDiscard(): boolean {
  return window.confirm('Discard unsaved changes?');
}