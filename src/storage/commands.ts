import { CashierCommands } from '../application/cashier-commands';
import { newId } from '../lib/id';
import { Database } from './database';
import { DexieLedgerRepository } from './ledger-repository';

/** Persistence adapter used by integration tests and the composition root. */
export class Store extends CashierCommands {
  constructor(readonly db = new Database()) {
    super(new DexieLedgerRepository(db), newId, () => new Date().toISOString());
  }
}
