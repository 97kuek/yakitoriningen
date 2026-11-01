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
it('在庫の追加・廃棄を差分で保存し、予約分未満への廃棄を拒否する', async () => {
  const { store, run } = await setup();
  await run({ type: 'stock', quantities: { momo: 10 } });
  await run({ type: 'adjustStock', productId: 'momo', change: 20 });
  await run({ type: 'adjustStock', productId: 'momo', change: -3 });
  expect(remainingStock((await store.read())!).momo).toBe(27);
  await run({
    type: 'reserve',
    orderId: newId(),
    assignmentId: newId(),
    confirmOperationId: newId(),
    quantities: { momo: 25 },
    price: (await store.read())!.prices[0],
  });
  await expect(
    run({ type: 'adjustStock', productId: 'momo', change: -3 }),
  ).rejects.toThrow();
  expect(remainingStock((await store.read())!).momo).toBe(27);
  expect(
    remainingStock(parseBackup(encodeBackup((await store.read())!))).momo,
  ).toBe(27);
});
it('保存済みの営業日に戻るとその日の商品・在庫・札枚数を使う', async () => {
  const { store, run } = await setup();
  const price = normalPrice(newId());
  await run({ type: 'catalog', price, stock: { momo: 40 } });
  await run({ type: 'tickets', count: 12 });
  await run({
    type: 'startDay',
    day: '2026-11-08',
    price: normalPrice(newId()),
    stock: { momo: 80 },
    ticketCount: 20,
    expectedSequence: (await store.read())!.meta.sequence,
  });
  await run({
    type: 'resumeDay',
    day: '2026-11-07',
    expectedSequence: (await store.read())!.meta.sequence,
  });
  const resumed = (await store.read())!;
  expect(resumed.meta.day).toBe('2026-11-07');
  expect(resumed.meta.activePriceId).toBe(price.id);
  expect(resumed.meta.ticketCount).toBe(12);
  expect(remainingStock(resumed).momo).toBe(40);
  expect(() => parseBackup(encodeBackup(resumed))).not.toThrow();
});

it.each([true, false])(
  '札枚数の変更操作がなくても初日の12枚を再開できる（初回設定 %s）',
  async (withSettings) => {
    const db = new Database(`initial-tickets-${newId()}`);
    databases.push(db);
    const store = new CashierStore(db);
    const context = await store.initialize(
      '試験',
      '2026-11-07',
      12,
      withSettings ? { price: normalPrice(newId()), stock: {} } : undefined,
    );
    for (const command of [
      {
        type: 'startDay' as const,
        day: '2026-11-08',
        price: normalPrice(newId()),
        stock: {},
        ticketCount: 30,
      },
      { type: 'resumeDay' as const, day: '2026-11-07' },
    ]) {
      const id = newId();
      await store.prepare(id, context, {
        ...command,
        expectedSequence: (await store.read())!.meta.sequence,
      });
      await store.execute(id, context);
    }
    expect((await store.read())!.meta.ticketCount).toBe(12);
    const restored = (await store.read())!;
    expect(() => parseBackup(encodeBackup(restored))).not.toThrow();
  },
);

it('旧初期設定のバックアップ復元後も日付を往復して初日の札枚数を保つ', async () => {
  const { store, run } = await setup();
  await run({ type: 'catalog', price: normalPrice(newId()), stock: {} });
  await run({ type: 'tickets', count: 12 });
  const first = dailySnapshot((await store.read())!);
  const legacy = {
    ...first,
    operations: first.operations.filter((op) => op.command.type !== 'tickets'),
    logs: first.logs.filter((log) => log.type !== 'tickets'),
    meta: { ...first.meta, omittedLogs: 1 },
  };
  parseBackup(encodeBackup(legacy));
  await run({
    type: 'startDay',
    day: '2026-11-08',
    price: normalPrice(newId()),
    stock: {},
    ticketCount: 30,
    expectedSequence: (await store.read())!.meta.sequence,
  });
  await store.restore(legacy, await store.read());
  for (const day of ['2026-11-08', '2026-11-07']) {
    const current = (await store.read())!;
    const id = newId();
    const context = {
      databaseId: current.meta.databaseId,
      generation: current.meta.generation,
    };
    await store.prepare(id, context, {
      type: 'resumeDay',
      day,
      expectedSequence: current.meta.sequence,
    });
    await store.execute(id, context);
  }
  expect((await store.read())!.meta.ticketCount).toBe(12);
});
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
