import { liveQuery } from 'dexie';
import type { Cashier } from './application/ports';
import { Store } from './storage/commands';
import { restoreBackup } from './storage/backup';

const store = new Store();
/** Composition root: only this module wires browser persistence into the UI. */
export const cashier: Cashier = {
  read: () => store.read(),
  initialize: (event, day, tickets) => store.initialize(event, day, tickets),
  stage: (id, context, command) => store.stage(id, context, command),
  execute: (id, context) => store.execute(id, context),
  dismiss: (id, context) => store.dismiss(id, context),
  restore: (snapshot, expected, archived) =>
    restoreBackup(store.db, snapshot, expected, archived),
  watch: (observer) => {
    const subscription = liveQuery(() => store.read()).subscribe(observer);
    return () => subscription.unsubscribe();
  },
};
