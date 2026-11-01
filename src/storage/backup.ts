import type { Snapshot } from '../domain/model';
import { validateSnapshot } from '../application/backup';
import { canonical } from '../application/serialization';
import { newId } from '../lib/id';
import type { Database } from './database';
import { CashierStore } from './commands';
export { encodeBackup, parseBackup, ordersCsv } from '../application/backup';

export async function restoreBackup(
  db: Database,
  snapshot: Snapshot,
  expected: Snapshot | null,
): Promise<void> {
  const incoming = validateSnapshot(snapshot);
  await db.transaction('rw', db.tables, async () => {
    const current = await new CashierStore(db).read();
    if (canonical(current) !== canonical(expected))
      throw new Error(
        '確認中に記録が変更されました。画面を開き直してください。',
      );
    for (const table of db.tables) await table.clear();
    await db.meta.add({ ...incoming.meta, generation: newId() });
    await db.prices.bulkAdd(incoming.prices);
    await db.orders.bulkAdd(
      incoming.orders.map((order) =>
        order.status === 'pending'
          ? { ...order, confirmOperationId: newId() }
          : order,
      ),
    );
    await db.tickets.bulkAdd(incoming.tickets);
    await db.operations.bulkAdd(incoming.operations);
    await db.logs.bulkAdd(incoming.logs);
  });
}
