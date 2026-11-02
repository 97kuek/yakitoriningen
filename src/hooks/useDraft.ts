import { useEffect, useState } from 'react';
import type { Draft, DraftCache } from '../application/ports';
import type { Snapshot } from '../domain/model';
import { emptyDraft } from '../ui';

/** Restore before saving, so mounting or a second tab cannot erase the cached input. */
export function useDraft(
  snapshot: Snapshot | null | undefined,
  cache: DraftCache,
  enabled: boolean,
) {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [loaded, setLoaded] = useState('');
  const meta = snapshot?.meta;
  const key = meta ? `${meta.databaseId}:${meta.generation}:${meta.day}` : '';
  useEffect(() => {
    if (!enabled || !meta) return;
    // A committed reservation already holds these items, even if a crash left the input cache behind.
    const reserved = snapshot?.orders.some(
      (order) => order.status === 'pending',
    );
    setDraft(reserved ? emptyDraft() : (cache.load(meta) ?? emptyDraft()));
    setLoaded(key);
  }, [key, enabled, cache]);
  useEffect(() => {
    if (enabled && meta && loaded === key) cache.save(meta, draft);
  }, [draft, loaded, key, enabled, cache]);
  return [draft, setDraft] as const;
}
