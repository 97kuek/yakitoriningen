import { liveQuery } from 'dexie';
import type { Cashier } from './application/ports';
import { CashierStore } from './storage/commands';
import { restoreBackup } from './storage/backup';

const store = new CashierStore();
/** Composition root: only this module wires browser persistence into the UI. */
export const cashier: Cashier = {
  read: () => store.read(),
  initialize: (event, day, tickets) => store.initialize(event, day, tickets),
  prepare: (id, context, command) => store.prepare(id, context, command),
  execute: (id, context) => store.execute(id, context),
  discard: (id, context) => store.discard(id, context),
  restore: (snapshot, expected, archived) =>
    restoreBackup(store.db, snapshot, expected, archived),
  watch: (observer) => {
    const subscription = liveQuery(() => store.read()).subscribe(observer);
    return () => subscription.unsubscribe();
  },
};
