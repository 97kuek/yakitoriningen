import { afterEach, expect, it } from 'vitest';
import { Database } from '../storage/database';
import { CashierStore } from '../storage/cashier-store';
import { newId } from '../lib/id';
import { normalPrice, type Command } from '../domain/model';
import { dayName } from '../domain/day';
import { contextOf } from '../domain/snapshot';
import { dailySnapshot, combineDailyBackups } from './daily-backup';
import { encodeBackup, parseBackup } from './backup';
import { ordersCsv } from '../presentation/orders-csv';

const databases: Database[] = [];
afterEach(async () => {
  await Promise.all(databases.splice(0).map((db) => db.delete()));
});

it('営業日ごとに名前を保存・変更し、注文を改変せず復元・集計・CSVにも反映する', async () => {
  const db = new Database(`day-name-${newId()}`);
  databases.push(db);
  const store = new CashierStore(db);
  const context = await store.initialize('早稲田祭', '2026-11-07', 20);
  const run = async (command: Command, id = newId()) => {
    await store.prepare(id, context, command);
    return store.execute(id, context);
  };
  const target = { orderId: newId(), assignmentId: newId() };
  const payment = newId();
  await run({
    type: 'reserve',
    ...target,
    confirmOperationId: payment,
    quantities: { momo: 1 },
    price: (await store.read())!.prices[0],
  });
  await run({ type: 'pay', ...target, received: 500 }, payment);
  await run({ type: 'complete', ...target });
  const originalOrders = (await store.read())!.orders;
  const renameId = newId();
  await run({ type: 'renameDay', name: ' 早稲田祭 土曜日 ' }, renameId);
  await store.execute(renameId, context);
  expect(dayName((await store.read())!)).toBe('早稲田祭 土曜日');
  expect((await store.read())!.orders).toEqual(originalOrders);
  const first = dailySnapshot((await store.read())!);
  expect(ordersCsv(first)).toContain('早稲田祭 土曜日');
  await run({
    type: 'startDay',
    name: '早稲田祭 日曜日',
    day: '2026-11-08',
    price: normalPrice(newId()),
    stock: {},
    ticketCount: 20,
    expectedSequence: (await store.read())!.meta.sequence,
  });
  const second = parseBackup(
    encodeBackup(dailySnapshot((await store.read())!)),
  );
  expect(dayName(second)).toBe('早稲田祭 日曜日');
  const combined = combineDailyBackups([first, second]);
  expect(dayName(combined, '2026-11-07')).toBe('早稲田祭 土曜日');
  expect(dayName(combined, '2026-11-08')).toBe('早稲田祭 日曜日');
  await store.restore(first, await store.read());
  const restored = (await store.read())!;
  expect(dayName(restored)).toBe('早稲田祭 土曜日');
  const id = newId();
  await store.prepare(id, contextOf(restored.meta), {
    type: 'resumeDay',
    day: '2026-11-08',
    expectedSequence: restored.meta.sequence,
  });
  await store.execute(id, contextOf(restored.meta));
  expect(dayName(parseBackup(encodeBackup((await store.read())!)))).toBe(
    '早稲田祭 日曜日',
  );
});

it('名前のない既存データは従来の営業名を表示し、空白の名前は保存しない', async () => {
  const db = new Database(`legacy-day-name-${newId()}`);
  databases.push(db);
  const store = new CashierStore(db);
  const context = await store.initialize('従来の営業', '2026-11-07', 20);
  const before = (await store.read())!;
  expect(dayName(parseBackup(encodeBackup(before)))).toBe('従来の営業');
  await expect(
    store.prepare(newId(), context, { type: 'renameDay', name: '  ' }),
  ).rejects.toThrow();
  expect(await store.read()).toEqual(before);
});
