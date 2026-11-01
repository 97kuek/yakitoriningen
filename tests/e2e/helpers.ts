import 'fake-indexeddb/auto';
import type { Page } from '@playwright/test';
import { CashierCommands } from '../../src/application/cashier-commands';
import type { Command, Price, Snapshot } from '../../src/domain/model';
import { Database } from '../../src/storage/database';
import { DexieLedgerRepository } from '../../src/storage/ledger-repository';
import { newId } from '../../src/lib/id';

const FIXTURE_EVENT = '試験用の開催回';
const FIXTURE_DAY = '2026-11-07';
const FIXTURE_TICKETS = 20;

type FixtureOptions = {
  /** Number of paid orders of one もも each. */
  orders?: number;
  /** Changes saved as a new price before the first order. */
  price?: Partial<Price>;
  /** Business day of each order; the meta day ends as the last one. */
  days?: readonly string[];
  /** The first N orders stay waiting for handoff; the rest are completed. */
  waiting?: number;
  /** Amount received for each order. */
  received?: (index: number) => number;
  /** Fixed clock for every record, so details show the same second. */
  now?: string;
};

/** Builds a ledger with the real use cases in a throwaway database. */
export async function ledgerFixture(
  options: FixtureOptions = {},
): Promise<Snapshot> {
  const { orders = 0, days = [], waiting = 0, received = () => 1000 } = options;
  const database = new Database(`fixture-${newId()}`);
  const clock = options.now
    ? () => options.now!
    : () => new Date().toISOString();
  const cashier = new CashierCommands(
    new DexieLedgerRepository(database),
    newId,
    clock,
  );
  try {
    let day = days[0] ?? FIXTURE_DAY;
    const context = await cashier.initialize(
      FIXTURE_EVENT,
      day,
      FIXTURE_TICKETS,
    );
    const run = async (command: Command, id = newId()) => {
      await cashier.prepare(id, context, command);
      return cashier.execute(id, context);
    };
    let price = (await cashier.read())!.prices[0];
    if (options.price) {
      price = { ...price, ...options.price, id: newId() };
      await run({ type: 'price', price });
    }
    for (let index = 0; index < orders; index++) {
      const orderDay = days[index] ?? day;
      if (orderDay !== day) {
        await run({ type: 'day', day: orderDay });
        day = orderDay;
      }
      const target = { orderId: newId(), assignmentId: newId() };
      const confirmOperationId = newId();
      await run({
        type: 'reserve',
        ...target,
        confirmOperationId,
        quantities: { momo: 1 },
        price,
      });
      await run(
        { type: 'pay', ...target, received: received(index) },
        confirmOperationId,
      );
      if (index >= waiting) await run({ type: 'complete', ...target });
    }
    return (await cashier.read())!;
  } finally {
    await database.delete();
  }
}

/** Replaces the app database with a fixture and reloads to the resume screen. */
export async function loadFixture(page: Page, snapshot: Snapshot) {
  await page.goto('/');
  await page.locator('.startup').waitFor();
  await page.evaluate(
    (snapshot) =>
      new Promise<void>((resolve, reject) => {
        const names = [
          'meta',
          'prices',
          'orders',
          'tickets',
          'operations',
          'logs',
        ] as const;
        const request = indexedDB.open('yakitoriningen-v1');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction([...names], 'readwrite');
          for (const name of names) {
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
}

/** Loads a fixture and starts the counter. */
export async function openFixture(page: Page, snapshot: Snapshot) {
  await loadFixture(page, snapshot);
  await startCounter(page);
}

/** Confirms the date and prices on the resume screen. */
export async function startCounter(page: Page) {
  await page.getByLabel('日付・価格を確認した').check();
  await page.getByRole('button', { name: '会計を始める', exact: true }).click();
}

/** Creates a new event through the first-run form. */
export async function startNewEvent(page: Page) {
  await page.goto('/');
  await page.getByLabel('開催回').fill('早稲田祭 2026');
  await page.getByLabel('営業日').fill(FIXTURE_DAY);
  await page.getByRole('button', { name: '新しく作る' }).click();
  await startCounter(page);
}

export async function openScreen(
  page: Page,
  name: '会計' | '注文履歴' | '集計' | '設定',
) {
  await page.getByRole('button', { name, exact: true }).click();
}

export async function addSkewers(page: Page, product: string, count = 1) {
  for (let index = 0; index < count; index++)
    await page.getByRole('button', { name: `${product}を1本増やす` }).click();
}

/** Takes cash for the current draft and confirms the payment. */
export async function pay(page: Page, received = '1000') {
  await page.getByRole('button', { name: '会計へ', exact: true }).click();
  await page.getByLabel('お預かり金額').fill(received);
  await page.getByRole('button', { name: 'お釣りを確認', exact: true }).click();
  await page.getByRole('button', { name: '会計を確定', exact: true }).click();
}

export const completeButton = (page: Page) =>
  page
    .getByTestId('waiting-order')
    .getByRole('button', { name: '受け渡し完了（札も回収）', exact: true });

/** Fully refunds the newest paid order from the history screen. */
export async function refundNewest(page: Page, reason = '注文間違い') {
  await openScreen(page, '注文履歴');
  await page
    .getByRole('button', { name: '全額返金', exact: true })
    .first()
    .click();
  const dialog = page.getByRole('dialog', { name: '全額返金', exact: true });
  await dialog.getByLabel('取消理由').fill(reason);
  await dialog.getByRole('button', { name: '返金を始める' }).click();
  await dialog.getByLabel('全額返金し、現金を確認しました').check();
  await dialog.getByRole('button', { name: '返金を記録' }).click();
}

/** Whether leaving the page would ask for confirmation. */
export const leaveIsBlocked = (page: Page) =>
  page.evaluate(
    // The same cancelable event used by navigation, without leaving the page.
    () =>
      !window.dispatchEvent(new Event('beforeunload', { cancelable: true })),
  );

export const rows = (page: Page) => page.getByRole('table').locator('tbody tr');

/** Vertical centers of elements, to check they share one row. */
export async function centersY(locators: ReturnType<Page['locator']>[]) {
  return Promise.all(
    locators.map(async (locator) => {
      const box = (await locator.boundingBox())!;
      return box.y + box.height / 2;
    }),
  );
}
