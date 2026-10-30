import { afterEach, beforeEach, expect, it } from 'vitest';
import { newId } from '../lib/id';

import type { Context, Snapshot } from '../domain/model';
import { Database } from './database';
import { CashierStore } from './commands';
import { encodeBackup, parseBackup, restoreBackup } from './backup';
let db: Database, store: CashierStore, ctx: Context, original: Snapshot;
beforeEach(async () => {
  db = new Database(`backup-${newId()}`);
  store = new CashierStore(db);
  ctx = await store.initialize('祭', '2026-11-07', 3);
  const price = (await store.read())!.prices[0];
  const op = newId();
  await store.prepare(op, ctx, {
    type: 'reserve',
    orderId: newId(),
    assignmentId: newId(),
    confirmOperationId: newId(),
    quantities: { momo: 5, kawa: 0, negima: 0 },
    price,
  });
  await store.execute(op, ctx);
  original = (await store.read())!;
});
afterEach(async () => {
  await db.delete();
});
it('全ストアとメタデータを往復できる', () => {
  expect(parseBackup(encodeBackup(original))).toEqual(original);
});
it('空のDBへの復元に成功し世代を変更する', async () => {
  const other = new Database(`other-${newId()}`);
  await restoreBackup(other, original, null, false);
  const s = (await new CashierStore(other).read())!;
  expect(s.meta.generation).not.toBe(original.meta.generation);
  expect(s.orders[0].quote.total).toBe(600);
  expect(s.orders[0].confirmOperationId).not.toBe(
    original.orders[0].confirmOperationId,
  );
  await other.delete();
});
it.each([
  'format',
  'money',
  'owner',
  'price',
  'log',
  'count',
  'duplicate',
  'status',
  'missing-ticket',
  'operation',
] as const)('不整合なバックアップ %s を拒否する', (kind) => {
  const file = JSON.parse(encodeBackup(original));
  if (kind === 'format') file.version = 999;
  if (kind === 'money') file.data.orders[0].quote.total = 1;
  if (kind === 'owner') file.data.tickets[0].assignmentId = 'different';
  if (kind === 'price') file.data.prices = [];
  if (kind === 'log') file.data.logs[0].operationId = 'missing';
  if (kind === 'count') file.counts.orders++;
  if (kind === 'duplicate') {
    file.data.tickets.push(file.data.tickets[0]);
    file.counts.tickets++;
  }
  if (kind === 'status') file.data.orders[0].status = 'paid';
  if (kind === 'missing-ticket') {
    file.data.tickets.pop();
    file.counts.tickets--;
  }
  if (kind === 'operation') file.data.operations[0].status = 'pending';
  expect(() => parseBackup(JSON.stringify(file))).toThrow();
});
it('退避未確認と、退避後に記録が増えた復元を拒否する', async () => {
  await expect(restoreBackup(db, original, original, false)).rejects.toThrow(
    /退避/,
  );
  await store.prepare(newId(), ctx, { type: 'day', day: '2026-11-08' });
  await expect(restoreBackup(db, original, original, true)).rejects.toThrow(
    /変更/,
  );
});
it('復元後の古い画面と古い保留操作の再実行を拒否する', async () => {
  const op = newId();
  await store.prepare(op, ctx, { type: 'day', day: '2026-11-08' });
  const before = (await store.read())!;
  await restoreBackup(db, before, before, true);
  const current = (await store.read())!.meta;
  await expect(store.execute(op, ctx)).rejects.toThrow(/世代/);
  await expect(store.execute(op, current)).rejects.toThrow(/世代/);
});
it.each(['meta', 'prices', 'orders', 'tickets', 'operations', 'logs'] as const)(
  '復元の%s書込が失敗しても元データを残す',
  async (table) => {
    const before = (await store.read())!;
    const fail = () => {
      throw new Error('復元中の容量不足');
    };
    db[table].hook('creating', fail);
    await expect(restoreBackup(db, original, before, true)).rejects.toThrow();
    expect(await store.read()).toEqual(before);
  },
);
it('バックアップ中の会計に対して整合した一時点を返す', async () => {
  const order = original.orders[0];
  await store.prepare(order.confirmOperationId, ctx, {
    type: 'pay',
    orderId: order.id,
    assignmentId: order.assignmentId,
    received: 1000,
  });
  const [snapshot] = await Promise.all([
    store.read(),
    store.execute(order.confirmOperationId, ctx),
  ]);
  expect(parseBackup(encodeBackup(snapshot!))).toEqual(snapshot);
  const s = snapshot!;
  expect(
    s.orders[0].status === 'paid' ? s.logs.length === 2 : s.logs.length === 1,
  ).toBe(true);
});
it('確定操作のない会計済み注文を復元しない', () => {
  const file = JSON.parse(encodeBackup(original));
  Object.assign(file.data.orders[0], {
    status: 'paid',
    received: 1000,
    change: 400,
    paidAt: new Date().toISOString(),
  });
  expect(() => parseBackup(JSON.stringify(file))).toThrow();
});
it('作成操作と異なる数量の注文を復元しない', () => {
  const file = JSON.parse(encodeBackup(original));
  file.data.orders[0].quantities = { momo: 0, kawa: 5, negima: 0 };
  expect(() => parseBackup(JSON.stringify(file))).toThrow();
});
it('同時に受け渡し・札回収した記録をバックアップできる', async () => {
  const order = original.orders[0],
    target = { orderId: order.id, assignmentId: order.assignmentId };
  await store.prepare(order.confirmOperationId, ctx, {
    type: 'pay',
    ...target,
    received: 1000,
  });
  await store.execute(order.confirmOperationId, ctx);
  const op = newId();
  await store.prepare(op, ctx, { type: 'complete', ...target });
  await store.execute(op, ctx);
  const current = (await store.read())!;
  expect(current.orders[0]).toMatchObject({ delivered: true, returned: true });
  expect(parseBackup(encodeBackup(current))).toEqual(current);
});
it('経費を保存したバックアップを戻せる', async () => {
  const op = newId();
  await store.prepare(op, ctx, { type: 'expense', amount: 2500 });
  await store.execute(op, ctx);
  const snapshot = (await store.read())!;
  const incoming = parseBackup(encodeBackup(snapshot));
  expect(incoming.meta.expenseTotal).toBe(2500);
  await restoreBackup(db, incoming, snapshot, true);
  expect((await store.read())!.meta.expenseTotal).toBe(2500);
});
it('経費を持たない従来のファイルは未登録として読み込む', () => {
  const file = JSON.parse(encodeBackup(original));
  delete file.data.meta.expenseTotal;
  expect(parseBackup(JSON.stringify(file)).meta.expenseTotal).toBeNull();
});
it('変更記録と一致しない経費を拒否する', () => {
  const file = JSON.parse(encodeBackup(original));
  file.data.meta.expenseTotal = 1000;
  expect(() => parseBackup(JSON.stringify(file))).toThrow();
});
