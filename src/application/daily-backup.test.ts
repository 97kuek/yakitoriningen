import { afterEach, expect, it } from 'vitest';
import { Database } from '../storage/database';
import { CashierStore } from '../storage/cashier-store';
import { newId } from '../lib/id';
import type { Command } from '../domain/model';
import { encodeBackup, parseBackup } from './backup';
import {
  dailySnapshot,
  dailyExpense,
  combineDailyBackups,
} from './daily-backup';
import { handoffUndoError } from '../domain/handoff';
import { remainingStock } from '../domain/inventory';

const databases: Database[] = [];
afterEach(async () => {
  await Promise.all(databases.splice(0).map((db) => db.delete()));
});
async function setup() {
  const db = new Database(`test-daily-${newId()}`);
  databases.push(db);
  const store = new CashierStore(db);
  const context = await store.initialize('試験', '2026-11-07', 20);
  const run = async (command: Command, id = newId()) => {
    await store.prepare(id, context, command);
    return store.execute(id, context);
  };
  const pay = async () => {
    const target = { orderId: newId(), assignmentId: newId() };
    const payment = newId();
    await run({
      type: 'reserve',
      ...target,
      confirmOperationId: payment,
      quantities: { momo: 2 },
      price: (await store.read())!.prices[0],
    });
    await run({ type: 'pay', ...target, received: 500 }, payment);
    await run({ type: 'complete', ...target });
    return target;
  };
  return { store, run, pay, context };
}
it('在庫は日別。返金しても戻らず、修正・再読込・バックアップでも一致する', async () => {
  const { store, run, pay } = await setup();
  await run({ type: 'stock', quantities: { momo: 3000, kawa: 0 } });
  const target = await pay();
  expect(remainingStock((await store.read())!)).toEqual({
    momo: 2998,
    kawa: 0,
  });
  await run({ type: 'cancel', ...target, reason: '試験返金' });
  expect(remainingStock((await store.read())!).momo).toBe(2998);
  await run({ type: 'stock', quantities: { momo: 3002 } });
  expect(remainingStock((await store.read())!).momo).toBe(3000);
  await run({ type: 'day', day: '2026-11-08' });
  expect(remainingStock((await store.read())!)).toEqual({});
  await run({ type: 'stock', quantities: { momo: 20 } });
  await pay();
  const all = (await store.read())!;
  const daily = parseBackup(encodeBackup(dailySnapshot(all)));
  expect(daily.orders).toHaveLength(1);
  expect(remainingStock(daily).momo).toBe(18);
  expect(remainingStock(all, '2026-11-07').momo).toBe(3000);
});
it('当日分を復元しても会計番号を保ち、前日は元のアプリに残す', async () => {
  const { store, run, pay } = await setup();
  await pay();
  await run({ type: 'expense', amount: 100 });
  await run({ type: 'day', day: '2026-11-08' });
  await pay();
  await run({ type: 'expense', amount: 200 });
  const all = (await store.read())!;
  const first = dailySnapshot(all, '2026-11-07');
  const second = parseBackup(encodeBackup(dailySnapshot(all)));
  expect((await store.read())!.orders).toHaveLength(2);
  expect(second.orders.every((order) => order.day === '2026-11-08')).toBe(true);
  expect(second.meta.expenseTotal).toBe(200);
  expect(dailyExpense(first)).toBe(100);
  const payLog = all.logs.find(
    (log) => log.operationId === second.orders[0].confirmOperationId,
  )!;
  expect(
    second.logs.find((log) => log.operationId === payLog.operationId)?.sequence,
  ).toBe(payLog.sequence);
  expect(combineDailyBackups([first, second]).orders).toHaveLength(2);
  expect(() => combineDailyBackups([first, first])).toThrow('重複');
  const other = await setup();
  await other.store.restore(second, await other.store.read());
  expect(
    parseBackup(encodeBackup((await other.store.read())!)).orders,
  ).toHaveLength(1);
});
it('未完了の当日注文も復元可能。別日の使用中の札を持ち込まない', async () => {
  const { store, run } = await setup();
  const reserve = async () =>
    run({
      type: 'reserve',
      orderId: newId(),
      assignmentId: newId(),
      confirmOperationId: newId(),
      quantities: { momo: 1 },
      price: (await store.read())!.prices[0],
    });
  await reserve();
  await run({ type: 'day', day: '2026-11-08' });
  await reserve();
  const daily = parseBackup(encodeBackup(dailySnapshot((await store.read())!)));
  expect(daily.orders).toHaveLength(1);
  expect(daily.tickets.filter((ticket) => ticket.orderId)).toHaveLength(1);
});

it('未実行の注文作成と別日の札再利用を日別バックアップでも保つ', async () => {
  const { store, run, pay, context } = await setup();
  const target = await pay();
  await run({ type: 'day', day: '2026-11-08' });
  await pay();
  await run({ type: 'day', day: '2026-11-07' });
  const snapshot = (await store.read())!;
  const pendingId = newId();
  await store.prepare(pendingId, context, {
    type: 'reserve',
    orderId: newId(),
    assignmentId: newId(),
    confirmOperationId: newId(),
    quantities: { momo: 1 },
    price: snapshot.prices[0],
  });
  const backup = parseBackup(
    encodeBackup(dailySnapshot((await store.read())!)),
  );
  expect(backup.operations.some((op) => op.id === pendingId)).toBe(true);
  const order = backup.orders.find((order) => order.id === target.orderId)!;
  const completed = backup.operations.find(
    (op) => op.command.type === 'complete' && op.command.orderId === order.id,
  )!;
  expect(
    handoffUndoError(
      order,
      completed.id,
      backup,
      backup.tickets.find((ticket) => ticket.number === order.ticket),
    ),
  ).toContain('再利用');
});

it('日別復元後に札枚数を減らして戻しても、過去の完了を取り消せない', async () => {
  const { store, run, pay } = await setup();
  await run({ type: 'tickets', count: 2 });
  const occupied = { orderId: newId(), assignmentId: newId() };
  await run({
    type: 'reserve',
    ...occupied,
    confirmOperationId: newId(),
    quantities: { momo: 1 },
    price: (await store.read())!.prices[0],
  });
  const target = await pay();
  await run({ type: 'cancel', ...occupied, reason: '試験取消' });
  await run({ type: 'day', day: '2026-11-08' });
  await pay();
  await run({ type: 'day', day: '2026-11-07' });
  const daily = dailySnapshot((await store.read())!);
  const other = await setup();
  await other.store.restore(daily, await other.store.read());
  const { databaseId, generation } = (await other.store.read())!.meta;
  const context = { databaseId, generation };
  for (const count of [1, 2]) {
    const id = newId();
    await other.store.prepare(id, context, { type: 'tickets', count });
    await other.store.execute(id, context);
  }
  const restored = parseBackup(encodeBackup((await other.store.read())!));
  const completed = restored.operations.find(
    (op) =>
      op.command.type === 'complete' && op.command.orderId === target.orderId,
  )!;
  expect(
    handoffUndoError(
      restored.orders.find((order) => order.id === target.orderId)!,
      completed.id,
      restored,
      restored.tickets.find((ticket) => ticket.number === 2),
    ),
  ).toContain('再利用');
});

it('前日のバックアップを戻しても翌日の注文・経費・会計番号を失わない', async () => {
  const { store, run, pay } = await setup();
  await pay();
  await run({ type: 'expense', amount: 100 });
  const first = dailySnapshot((await store.read())!);
  await run({ type: 'day', day: '2026-11-08' });
  const secondOrder = await pay();
  await run({ type: 'stock', quantities: { momo: 30 } });
  await run({ type: 'expense', amount: 200 });
  const before = (await store.read())!;
  const secondLogs = before.logs.filter((log) =>
    before.operations.some(
      (op) => op.id === log.operationId && op.day === '2026-11-08',
    ),
  );
  await store.restore(first, before);
  const restored = parseBackup(encodeBackup((await store.read())!));
  expect(restored.orders).toHaveLength(2);
  expect(
    restored.orders.find((order) => order.id === secondOrder.orderId),
  ).toEqual(before.orders.find((order) => order.id === secondOrder.orderId));
  expect(restored.logs).toEqual(expect.arrayContaining(secondLogs));
  expect(dailyExpense(restored, '2026-11-08')).toBe(200);
  expect(remainingStock(restored, '2026-11-08').momo).toBe(28);
  expect(restored.meta.day).toBe('2026-11-07');
  expect(restored.meta.generation).not.toBe(before.meta.generation);
});

it('別日の使用中の札がある復元は記録を変更せず拒否する', async () => {
  const { store, run, pay } = await setup();
  await pay();
  const first = dailySnapshot((await store.read())!);
  await run({ type: 'day', day: '2026-11-08' });
  await run({
    type: 'reserve',
    orderId: newId(),
    assignmentId: newId(),
    confirmOperationId: newId(),
    quantities: { momo: 1 },
    price: first.prices[0],
  });
  const before = (await store.read())!;
  await expect(store.restore(first, before)).rejects.toThrow('別の日');
  expect(await store.read()).toEqual(before);
});

it('独立した別日の記録と会計番号が衝突する場合は元の記録を保持する', async () => {
  const first = await setup();
  await first.pay();
  const backup = dailySnapshot((await first.store.read())!);
  const second = await setup();
  await second.run({ type: 'day', day: '2026-11-08' });
  await second.pay();
  const before = (await second.store.read())!;
  await expect(second.store.restore(backup, before)).rejects.toThrow(
    '会計番号',
  );
  expect(await second.store.read()).toEqual(before);
});

it('同じ日を再度復元しても他の日の注文は重複せず、後続会計もバックアップ可能', async () => {
  const { store, run, pay } = await setup();
  await pay();
  const backup = dailySnapshot((await store.read())!);
  await run({ type: 'day', day: '2026-11-08' });
  await pay();
  await store.restore(backup, await store.read());
  await store.restore(backup, await store.read());
  const current = (await store.read())!;
  const context = {
    databaseId: current.meta.databaseId,
    generation: current.meta.generation,
  };
  const id = newId();
  await store.prepare(id, context, { type: 'expense', amount: 123 });
  await store.execute(id, context);
  const restored = parseBackup(encodeBackup((await store.read())!));
  expect(restored.orders).toHaveLength(2);
  expect(restored.logs.at(-1)?.sequence).toBe(current.meta.sequence + 1);
  expect(dailyExpense(restored)).toBe(123);
});
