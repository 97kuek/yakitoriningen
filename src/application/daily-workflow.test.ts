import { afterEach, expect, it } from 'vitest';
import { Database } from '../storage/database';
import { CashierStore } from '../storage/cashier-store';
import { newId } from '../lib/id';
import type { Command } from '../domain/model';
import { normalPrice } from '../domain/model';
import { remainingStock } from '../domain/inventory';
import { dailySnapshot } from './daily-backup';
import { encodeBackup, parseBackup } from './backup';

const databases: Database[] = [];
afterEach(async () => {
  await Promise.all(databases.splice(0).map((db) => db.delete()));
});
async function setup() {
  const db = new Database(`daily-workflow-${newId()}`);
  databases.push(db);
  const store = new CashierStore(db);
  const context = await store.initialize('早稲田祭', '2026-11-07', 20);
  const run = async (command: Command) => {
    const id = newId();
    await store.prepare(id, context, command);
    return store.execute(id, context);
  };
  return { store, context, run };
}
it('商品と任意の在庫を一括保存し、翌日の準備でも前日の注文を残す', async () => {
  const { store, run } = await setup();
  const price = normalPrice(newId());
  await run({ type: 'catalog', price, stock: { momo: 100 } });
  const target = { orderId: newId(), assignmentId: newId() };
  const payment = newId();
  await run({
    type: 'reserve',
    ...target,
    confirmOperationId: payment,
    quantities: { momo: 2 },
    price,
  });
  const meta = (await store.read())!.meta;
  const context = { databaseId: meta.databaseId, generation: meta.generation };
  await store.prepare(payment, context, {
    type: 'pay',
    ...target,
    received: 500,
  });
  await store.execute(payment, context);
  await run({ type: 'complete', ...target });
  await run({ type: 'expense', amount: 100 });
  const before = (await store.read())!;
  expect(remainingStock(before).momo).toBe(98);
  await run({
    type: 'startDay',
    day: '2026-11-08',
    price: { ...price, id: newId() },
    ticketCount: 25,
    stock: { momo: 300 },
    expectedSequence: before.meta.sequence,
  });
  const after = parseBackup(encodeBackup((await store.read())!));
  expect(after.orders).toEqual(before.orders);
  expect(after.meta.day).toBe('2026-11-08');
  expect(after.tickets).toHaveLength(25);
  expect(remainingStock(after).momo).toBe(300);
  expect(remainingStock(after, '2026-11-07').momo).toBe(98);
  expect(dailySnapshot(after).orders).toHaveLength(0);
});
it('初回も商品・価格・任意の在庫をまとめて準備する', async () => {
  const db = new Database(`daily-first-${newId()}`);
  databases.push(db);
  const store = new CashierStore(db);
  await store.initialize(' 早稲田祭 ', '2026-11-07', 20, {
    price: normalPrice(newId()),
    stock: { momo: 0 },
  });
  const snapshot = parseBackup(encodeBackup((await store.read())!));
  expect(remainingStock(snapshot)).toEqual({ momo: 0 });
});
it('準備中に記録が変われば営業日と価格・在庫を変更しない', async () => {
  const { store, run } = await setup();
  const before = (await store.read())!;
  await run({ type: 'expense', amount: 100 });
  await expect(
    run({
      type: 'startDay',
      day: '2026-11-08',
      price: normalPrice(newId()),
      ticketCount: 20,
      stock: {},
      expectedSequence: before.meta.sequence,
    }),
  ).rejects.toThrow(/記録が変わ/);
  expect((await store.read())!.meta.day).toBe('2026-11-07');
});
it('登録在庫を超える予約や、販売・予約済みより少ない在庫の保存を拒否する', async () => {
  const { store, run } = await setup();
  const price = normalPrice(newId());
  await run({ type: 'catalog', price, stock: { momo: 2 } });
  await run({
    type: 'reserve',
    orderId: newId(),
    assignmentId: newId(),
    confirmOperationId: newId(),
    quantities: { momo: 2 },
    price,
  });
  await expect(
    run({
      type: 'reserve',
      orderId: newId(),
      assignmentId: newId(),
      confirmOperationId: newId(),
      quantities: { momo: 1 },
      price,
    }),
  ).rejects.toThrow(/在庫/);
  await expect(
    run({
      type: 'catalog',
      price: { ...price, id: newId() },
      stock: { momo: 1 },
    }),
  ).rejects.toThrow(/在庫/);
  expect((await store.read())!.orders).toHaveLength(1);
});

it('破棄した準備を同じ営業日でやり直せる', async () => {
  const { store, run, context } = await setup();
  await run({ type: 'expense', amount: 100 });
  const id = newId();
  await store.prepare(id, context, {
    type: 'startDay',
    day: '2026-11-08',
    price: normalPrice(newId()),
    stock: {},
    ticketCount: 20,
    expectedSequence: 0,
  });
  await expect(store.execute(id, context)).rejects.toThrow();
  await store.discard(id, context);
  await run({
    type: 'startDay',
    day: '2026-11-08',
    price: normalPrice(newId()),
    stock: {},
    ticketCount: 20,
    expectedSequence: (await store.read())!.meta.sequence,
  });
  expect((await store.read())!.meta.day).toBe('2026-11-08');
});
it('営業日を変えても古い注文作成や在庫保存を別の日へ適用できない', async () => {
  const { store, run, context } = await setup();
  const price = normalPrice(newId());
  await run({ type: 'catalog', price, stock: { momo: 0 } });
  const id = newId();
  await store.prepare(id, context, {
    type: 'reserve',
    orderId: newId(),
    assignmentId: newId(),
    confirmOperationId: newId(),
    quantities: { momo: 1 },
    price,
  });
  await expect(store.execute(id, context)).rejects.toThrow(/在庫/);
  await run({ type: 'day', day: '2026-11-08' });
  await expect(store.execute(id, context)).rejects.toThrow(/営業日/);
  expect((await store.read())!.orders).toHaveLength(0);
});
