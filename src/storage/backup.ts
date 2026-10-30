import type { Snapshot } from '../domain/model';
import { validateSnapshot } from '../application/backup';
import { canonical } from '../application/serialization';
import { newId } from '../lib/id';
import type { Database } from './database';
import { Store } from './commands';
export { encodeBackup, parseBackup, ordersCsv } from '../application/backup';

export async function restoreBackup(
  db: Database,
  snapshot: Snapshot,
  expected: Snapshot | null,
  archived: boolean,
): Promise<void> {
  const incoming = validateSnapshot(snapshot);
  if (expected && !archived)
    throw new Error('既存データの退避ファイルを確認してから復元してください。');
  await db.transaction('rw', db.tables, async () => {
    const current = await new Store(db).read();
    if (canonical(current) !== canonical(expected))
      throw new Error(
        '退避後に保存状態が変更されました。もう一度退避して確認してください。',
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
