import { useEffect, useState } from 'react';

// Changing the name lets an old and a new version run side by side.
const LOCK_NAME = 'yakitoriningen-counter-v1';

/** UI ownership only; command transactions remain the authority for data integrity. */
export function useExclusiveTab() {
  const [state, setState] = useState<
    'checking' | 'owned' | 'blocked' | 'unsupported'
  >('checking');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let closed = false;
    let release: (() => void) | undefined;
    setState('checking');
    if (!navigator.locks) {
      setState('unsupported');
      return;
    }
    void navigator.locks
      .request(
        LOCK_NAME,
        { mode: 'exclusive', ifAvailable: true },
        async (lock) => {
          if (closed) return;
          if (!lock) {
            setState('blocked');
            return;
          }
          setState('owned');
          await new Promise<void>((resolve) => {
            release = resolve;
          });
        },
      )
      .catch(() => {
        if (!closed) setState('unsupported');
      });
    return () => {
      closed = true;
      release?.();
    };
  }, [attempt]);
  return { state, retry: () => setAttempt((n) => n + 1) };
}
