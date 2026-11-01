import type { BackupHistory } from '../application/ports';
import type { Meta } from '../domain/model';

/** Small, non-ledger UI preferences scoped to database, restore generation and business day. */
export class LocalBackupHistory implements BackupHistory {
  private memory = new Map<string, number>();
  private key(meta: Meta) {
    return `yakitori-backup:${meta.databaseId}:${meta.generation}:${meta.day}`;
  }
  lastSequence(meta: Meta): number | null {
    const key = this.key(meta);
    if (this.memory.has(key)) return this.memory.get(key)!;
    try {
      const value = localStorage.getItem(key);
      const sequence = value === null ? NaN : Number(value);
      return Number.isSafeInteger(sequence) && sequence >= 0 ? sequence : null;
    } catch {
      return null;
    }
  }
  record(meta: Meta) {
    const key = this.key(meta);
    this.memory.set(key, meta.sequence);
    try {
      localStorage.setItem(key, String(meta.sequence));
    } catch {
      /* Keep a session-only reminder if browser preferences cannot be saved. */
    }
  }
}
