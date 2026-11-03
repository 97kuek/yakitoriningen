import { useEffect, useRef, useState } from 'react';

export type StorageProtection =
  'checking' | 'protected' | 'denied' | 'unavailable';

async function protect(): Promise<StorageProtection> {
  try {
    const storage = navigator.storage;
    if (await storage?.persisted?.()) return 'protected';
    if (!storage?.persist) return 'unavailable';
    return (await storage.persist()) ? 'protected' : 'denied';
  } catch {
    // Protection permission must not prevent accounting or backup downloads.
    return 'unavailable';
  }
}

/** Ask once after a ledger is available; browser permission survives app reloads. */
export function useStorageProtection(enabled: boolean) {
  const [status, setStatus] = useState<StorageProtection>('checking');
  const request = useRef<Promise<StorageProtection> | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    request.current ??= protect();
    void request.current.then((result) => {
      if (active) setStatus(result);
    });
    return () => {
      active = false;
    };
  }, [enabled]);
  return status;
}
