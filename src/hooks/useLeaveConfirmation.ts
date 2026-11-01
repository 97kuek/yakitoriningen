import { useEffect } from 'react';

/** Ask the browser to confirm closing or reloading while there are unsaved edits. */
export function useLeaveConfirmation(unsaved: boolean) {
  useEffect(() => {
    if (!unsaved) return;
    const confirmLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', confirmLeave);
    return () => window.removeEventListener('beforeunload', confirmLeave);
  }, [unsaved]);
}
