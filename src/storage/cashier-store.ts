import { CashierCommands } from '../application/cashier-commands';
import { newId } from '../lib/id';
import { Database } from './database';
import { DexieLedgerRepository } from './ledger-repository';

/** Cashier use cases bound to IndexedDB, real IDs and the system clock. */
export class CashierStore extends CashierCommands {
  constructor(readonly db = new Database()) {
    super(new DexieLedgerRepository(db), newId, () => new Date().toISOString());
  }
}
