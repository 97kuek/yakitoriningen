import 'fake-indexeddb/auto';
import type { Page } from '@playwright/test';
import type { Price, Snapshot } from '../../src/domain/model';
import { Database } from '../../src/storage/database';
import { CashierStore } from '../../src/storage/cashier-store';
import { newId } from '../../src/lib/id';

export async function historyFixture(
  count: number,
  override?: Partial<Price>,
  orderDays?: readonly string[],
): Promise<Snapshot> {
  const database = new Database(`fixture-${newId()}`);
  const cashier = new CashierStore(database);
  try {
    const context = await cashier.initialize(
      '試験用の開催回',
      orderDays?.[0] ?? '2026-11-07',
      20,
    );
    let price = (await cashier.read())!.prices[0];
    if (override) {
      price = { ...price, ...override, id: newId() };
      const operationId = newId();
      await cashier.prepare(operationId, context, { type: 'price', price });
      await cashier.execute(operationId, context);
    }
    let day = orderDays?.[0] ?? '2026-11-07';
    for (let index = 0; index < count; index++) {
      const orderDay = orderDays?.[index] ?? day;
      if (orderDay !== day) {
        const operationId = newId();
        await cashier.prepare(operationId, context, {
          type: 'day',
          day: orderDay,
        });
        await cashier.execute(operationId, context);
        day = orderDay;
      }
      const orderId = newId(),
        assignmentId = newId(),
        confirmOperationId = newId(),
        reserveId = newId();
      await cashier.prepare(reserveId, context, {
        type: 'reserve',
        orderId,
        assignmentId,
        confirmOperationId,
        quantities: { momo: 1, kawa: 0, negima: 0 },
        price,
      });
      await cashier.execute(reserveId, context);
      await cashier.prepare(confirmOperationId, context, {
        type: 'pay',
        orderId,
        assignmentId,
        received: 1000,
      });
      await cashier.execute(confirmOperationId, context);
      const completionId = newId();
      await cashier.prepare(completionId, context, {
        type: 'complete',
        orderId,
        assignmentId,
      });
      await cashier.execute(completionId, context);
    }
    return (await cashier.read())!;
  } finally {
    await database.delete();
  }
}
export async function openFixture(page: Page, snapshot: Snapshot) {
  await page.goto('/');
  await page
    .getByRole('heading', { name: '営業の準備', exact: true })
    .waitFor();
  await page.evaluate(
    (snapshot) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('yakitoriningen-v1');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction(
            ['meta', 'prices', 'orders', 'tickets', 'operations', 'logs'],
            'readwrite',
          );
          for (const name of [
            'meta',
            'prices',
            'orders',
            'tickets',
            'operations',
            'logs',
          ] as const) {
            const table = transaction.objectStore(name);
            table.clear();
            for (const value of name === 'meta'
              ? [snapshot.meta]
              : snapshot[name])
              table.put(value);
          }
          transaction.oncomplete = () => {
            database.close();
            resolve();
          };
          transaction.onabort = () => {
            database.close();
            reject(transaction.error);
          };
        };
      }),
    snapshot,
  );
  await page.reload();
  await page.getByLabel('日付・価格を確認した').check();
  await page.getByRole('button', { name: '会計を始める', exact: true }).click();
}
