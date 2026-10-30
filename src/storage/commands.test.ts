import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { newId } from '../lib/id';

import type { Command, Context, Price } from '../domain/model';
import { Database } from './database';
import { Store } from './commands';
let db: Database, store: Store, ctx: Context, price: Price;
const q = { momo: 3, kawa: 2, negima: 0 };
async function run(command: Command, op = newId()) {
  await store.stage(op, ctx, command);
  return store.execute(op, ctx);
}
async function reserve() {
  const command = {
    type: 'reserve' as const,
    orderId: newId(),
    assignmentId: newId(),
    confirmOperationId: newId(),
    quantities: q,
    price,
  };
  await run(command);
  return command;
}
beforeEach(async () => {
  db = new Database(`test-${newId()}`);
  store = new Store(db);
  ctx = await store.initialize('早稲田祭', '2026-11-07', 2);
  price = (await store.read())!.prices[0];
});
afterEach(async () => {
  await db.delete();
});
describe('保存コマンド', () => {
  it('初期化は明示操作のみで既存データを置き換えない', async () => {
    const blank = new Database(`blank-${newId()}`);
    expect(await new Store(blank).read()).toBeNull();
    await blank.delete();
    await expect(store.initialize('別', '2026-11-08', 20)).rejects.toThrow();
    expect((await store.read())!.meta.event).toBe('早稲田祭');
  });
  it('保留保存だけでは売上にならず、注文・札・ログ・結果を一括保存する', async () => {
    const c = await reserve(),
      s = (await store.read())!;
    expect(s.orders[0]).toMatchObject({
      id: c.orderId,
      status: 'pending',
      quote: { total: 600 },
      received: null,
    });
    expect(s.tickets[0]).toMatchObject({
      orderId: c.orderId,
      assignmentId: c.assignmentId,
    });
    expect(s.operations[0].status).toBe('done');
    expect(s.logs).toHaveLength(1);
  });
  it('同じIDは同じ結果を返し、異なる入力を拒否する', async () => {
    const c = await reserve();
    const op = newId(),
      pay = {
        type: 'pay' as const,
        orderId: c.orderId,
        assignmentId: c.assignmentId,
        received: 1000,
      };
    await store.stage(c.confirmOperationId, ctx, pay);
    expect(await store.execute(c.confirmOperationId, ctx)).toBe(c.orderId);
    expect(await store.execute(c.confirmOperationId, ctx)).toBe(c.orderId);
    await expect(
      store.stage(c.confirmOperationId, ctx, { ...pay, received: 2000 }),
    ).rejects.toThrow(/同じ操作ID/);
    await expect(
      store.stage(op, ctx, pay).then(() => store.execute(op, ctx)),
    ).rejects.toThrow();
    const s = (await store.read())!;
    expect(s.orders[0]).toMatchObject({
      status: 'paid',
      received: 1000,
      change: 400,
    });
    expect(s.logs).toHaveLength(2);
  });
  it('不足金額の確定を拒否し、保留と札を保持する', async () => {
    const c = await reserve();
    await expect(
      run(
        {
          type: 'pay',
          orderId: c.orderId,
          assignmentId: c.assignmentId,
          received: 599,
        },
        c.confirmOperationId,
      ),
    ).rejects.toThrow(/不足/);
    expect((await store.read())!.orders[0].status).toBe('pending');
  });
  it('並行実行でも札を重複させず満札を拒否する', async () => {
    const commands = Array.from({ length: 3 }, () => ({
      type: 'reserve' as const,
      orderId: newId(),
      assignmentId: newId(),
      confirmOperationId: newId(),
      quantities: q,
      price,
    }));
    const results = await Promise.allSettled(commands.map((c) => run(c)));
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(2);
    const s = (await store.read())!;
    expect(new Set(s.orders.map((o) => o.ticket)).size).toBe(2);
    expect(s.orders).toHaveLength(2);
    expect(s.logs).toHaveLength(2);
  });
  it('札回収と受け渡しの両方まで解放せず、再利用後の古い操作を拒否する', async () => {
    const c = await reserve(),
      target = { orderId: c.orderId, assignmentId: c.assignmentId };
    await run({ type: 'pay', ...target, received: 600 }, c.confirmOperationId);
    await run({ type: 'deliver', ...target });
    expect((await store.read())!.tickets[0].orderId).toBe(c.orderId);
    await run({ type: 'return', ...target });
    expect((await store.read())!.tickets[0].orderId).toBeNull();
    const next = await reserve();
    await expect(run({ type: 'return', ...target })).rejects.toThrow();
    expect((await store.read())!.tickets[0].orderId).toBe(next.orderId);
  });
  it('先に札だけ戻っても受け渡しまで再利用しない', async () => {
    const c = await reserve(),
      target = { orderId: c.orderId, assignmentId: c.assignmentId };
    await run({ type: 'pay', ...target, received: 600 }, c.confirmOperationId);
    await run({ type: 'return', ...target });
    expect((await store.read())!.tickets[0].orderId).toBe(c.orderId);
    await run({ type: 'deliver', ...target });
    expect((await store.read())!.tickets[0].orderId).toBeNull();
  });
  it('全額取消を一度だけ記録し、回収前の札を保持する', async () => {
    const c = await reserve(),
      target = { orderId: c.orderId, assignmentId: c.assignmentId };
    await run({ type: 'pay', ...target, received: 1000 }, c.confirmOperationId);
    const op = newId();
    await run({ type: 'cancel', ...target, reason: '返金済み' }, op);
    await store.execute(op, ctx);
    const s = (await store.read())!;
    expect(s.orders[0]).toMatchObject({
      status: 'cancelled',
      refunded: 600,
      received: 1000,
    });
    expect(s.tickets[0].orderId).toBe(c.orderId);
    expect(s.logs).toHaveLength(3);
    await run({ type: 'return', ...target });
    expect((await store.read())!.tickets[0].orderId).toBeNull();
  });
  it('価格変更前の保留と翌日の未回収札を保持する', async () => {
    const c = await reserve();
    await run({
      type: 'price',
      price: {
        ...price,
        id: newId(),
        label: '値下げ',
        unit: 50,
        bundleEnabled: false,
      },
    });
    await run({ type: 'day', day: '2026-11-08' });
    const s = (await store.read())!;
    expect(s.orders[0]).toMatchObject({
      id: c.orderId,
      day: '2026-11-07',
      quote: { total: 600 },
    });
    expect(s.tickets[0].orderId).toBe(c.orderId);
    expect(s.meta.day).toBe('2026-11-08');
  });
  it('偽造価格と空注文を拒否する', async () => {
    const c = {
      type: 'reserve' as const,
      orderId: newId(),
      assignmentId: newId(),
      confirmOperationId: newId(),
      quantities: q,
      price: { ...price, unit: 1 },
    };
    await expect(run(c)).rejects.toThrow(/価格/);
    await expect(
      run({ ...c, price, quantities: { momo: 0, kawa: 0, negima: 0 } }),
    ).rejects.toThrow();
  });
  it.each(['orders', 'tickets', 'logs', 'operations'] as const)(
    '%s書込の失敗時は全変更をロールバックする',
    async (table) => {
      const op = newId();
      await store.stage(op, ctx, {
        type: 'reserve',
        orderId: newId(),
        assignmentId: newId(),
        confirmOperationId: newId(),
        quantities: q,
        price,
      });
      const fail = () => {
        throw new Error('容量不足の試験');
      };
      if (table === 'operations') db.operations.hook('updating', fail);
      else if (table === 'tickets') db.tickets.hook('updating', fail);
      else db[table].hook('creating', fail);
      await expect(store.execute(op, ctx)).rejects.toThrow();
      const s = (await store.read())!;
      expect(s.orders).toHaveLength(0);
      expect(s.logs).toHaveLength(0);
      expect(s.tickets.every((t) => t.orderId === null)).toBe(true);
      expect(s.operations[0].status).toBe('pending');
    },
  );
  it('DB識別子・世代の異なる操作を拒否する', async () => {
    const c = { type: 'day' as const, day: '2026-11-08' };
    await expect(
      store.stage(newId(), { ...ctx, generation: newId() }, c),
    ).rejects.toThrow(/世代/);
    await expect(
      store.stage(newId(), { ...ctx, databaseId: newId() }, c),
    ).rejects.toThrow(/世代/);
  });
});
it('入金照合後に保留操作を破棄すると新しい確定IDで入力し直せる', async () => {
  const c = await reserve();
  await store.stage(c.confirmOperationId, ctx, {
    type: 'pay',
    orderId: c.orderId,
    assignmentId: c.assignmentId,
    received: 599,
  });
  await store.dismiss(c.confirmOperationId, ctx);
  const order = (await store.read())!.orders[0];
  expect(order.confirmOperationId).not.toBe(c.confirmOperationId);
  await run(
    {
      type: 'pay',
      orderId: order.id,
      assignmentId: order.assignmentId,
      received: 1000,
    },
    order.confirmOperationId,
  );
  expect((await store.read())!.orders[0].status).toBe('paid');
});
it('受け渡しと札回収を1回で保存し、再試行や古い操作で札を変更しない', async () => {
  const c = await reserve(),
    target = { orderId: c.orderId, assignmentId: c.assignmentId };
  await run({ type: 'pay', ...target, received: 1000 }, c.confirmOperationId);
  const op = newId();
  await run({ type: 'complete', ...target }, op);
  await store.execute(op, ctx);
  const state = (await store.read())!;
  expect(state.orders[0]).toMatchObject({ delivered: true, returned: true });
  expect(state.tickets[0].orderId).toBeNull();
  expect(state.logs).toHaveLength(3);
  const next = await reserve();
  await expect(run({ type: 'complete', ...target })).rejects.toThrow();
  expect((await store.read())!.tickets[0].orderId).toBe(next.orderId);
});
it('受け渡し・札回収の保存に失敗したら両方とも未反映で残す', async () => {
  const c = await reserve(),
    target = { orderId: c.orderId, assignmentId: c.assignmentId };
  await run({ type: 'pay', ...target, received: 1000 }, c.confirmOperationId);
  db.tickets.hook('updating', () => {
    throw new Error('容量不足の試験');
  });
  await expect(run({ type: 'complete', ...target })).rejects.toThrow();
  const state = (await store.read())!;
  expect(state.orders[0]).toMatchObject({ delivered: false, returned: false });
  expect(state.tickets[0].orderId).toBe(c.orderId);
  expect(state.logs).toHaveLength(2);
});
