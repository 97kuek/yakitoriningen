import type { LedgerRepository, LedgerTransaction } from '../application/ports';
import type { Database } from './database';

export class DexieLedgerRepository implements LedgerRepository {
  constructor(private readonly db: Database) {}
  private records(): LedgerTransaction {
    const { meta, prices, orders, tickets, operations, logs } = this.db;
    return { meta, prices, orders, tickets, operations, logs };
  }
  read<T>(work: (tx: LedgerTransaction) => Promise<T>): Promise<T> {
    return this.db.transaction('r', this.db.tables, () => work(this.records()));
  }
  write<T>(work: (tx: LedgerTransaction) => Promise<T>): Promise<T> {
    return this.db.transaction('rw', this.db.tables, () =>
      work(this.records()),
    );
  }
}
