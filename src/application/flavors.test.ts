import { afterEach, describe, expect, it } from 'vitest';
import { Database } from '../storage/database';
import { CashierStore } from '../storage/cashier-store';
import { newId } from '../lib/id';
import { normalPrice, type Command } from '../domain/model';
import { encodeBackup, parseBackup, validateSnapshot } from './backup';

const databases: Database[] = [];
afterEach(async () => {
  await Promise.all(databases.splice(0).map((db) => db.delete()));
});
async function setup() {
  const db = new Database(`flavors-${newId()}`);
  databases.push(db);
  const store = new CashierStore(db);
  const context = await store.initialize('架空の営業', '2026-11-07', 20);
  const run = async (command: Command, id = newId()) => {
    await store.prepare(id, context, command);
    return store.execute(id, context);
  };
  const price = (await store.read())!.prices[0];
  const reserve = (flavors?: Record<string, Record<string, number>>) => ({
    type: 'reserve' as const,
    orderId: newId(),
    assignmentId: newId(),
    confirmOperationId: newId(),
    quantities: { momo: 3, kawa: 2 },
    price,
    ...(flavors === undefined ? {} : { flavors }),
  });
  return { store, run, reserve };
}

describe('味別の注文の保存', () => {
  it('味別数量を保存し、金額・本数と再試行結果を維持する', async () => {
    const { store, run, reserve } = await setup();
    const command = reserve({ momo: { tare: 2, shio: 1 }, kawa: { shio: 2 } });
    const id = newId();
    await run(command, id);
    await run(command, id);
    const snapshot = (await store.read())!;
    expect(snapshot.orders).toHaveLength(1);
    expect(snapshot.orders[0].flavors).toEqual(command.flavors);
    expect(snapshot.orders[0].quote).toMatchObject({ total: 600, count: 5 });
    expect(parseBackup(encodeBackup(snapshot))).toEqual(snapshot);
  });

  it.each([
    { momo: { missing: 1 } },
    { missing: { tare: 0 } },
    { momo: { tare: 3, shio: 1 } },
    { momo: { tare: -1 } },
    { momo: { tare: 1.5 } },
    { momo: { tare: 1000 } },
    JSON.parse('{"momo":{"__proto__":1}}'),
    JSON.parse('{"constructor":{"tare":1}}'),
  ])('不正な味別数量を保存しない: %j', async (flavors) => {
    const { store, run, reserve } = await setup();
    const before = (await store.read())!;
    await expect(run(reserve(flavors))).rejects.toThrow();
    const after = (await store.read())!;
    expect(after.orders).toHaveLength(0);
    expect(after.operations).toEqual(before.operations);
    expect(after.logs).toEqual(before.logs);
    expect(parseBackup(encodeBackup(after))).toEqual(after);
  });

  it('旧形式は味を補わず、未指定本数がある記録も復元できる', async () => {
    const { store, run, reserve } = await setup();
    const legacy = reserve();
    await run(legacy);
    await run(reserve({ momo: { tare: 1 } }));
    const snapshot = (await store.read())!;
    expect(
      Object.hasOwn(
        snapshot.orders.find((order) => order.id === legacy.orderId)!,
        'flavors',
      ),
    ).toBe(false);
    const restored = parseBackup(encodeBackup(snapshot));
    expect(restored).toEqual(snapshot);
    expect(
      Object.hasOwn(
        restored.orders.find((order) => order.id === legacy.orderId)!,
        'flavors',
      ),
    ).toBe(false);
    expect(Object.hasOwn(restored.prices[0], 'flavors')).toBe(false);
  });

  it('注文だけの味変更と数量超過をバックアップで検出する', async () => {
    const { store, run, reserve } = await setup();
    await run(reserve({ momo: { tare: 1 } }));
    const snapshot = (await store.read())!;
    const changed = structuredClone(snapshot);
    changed.orders[0].flavors = { momo: { shio: 1 } };
    expect(() => validateSnapshot(changed)).toThrow();
    const excessive = structuredClone(snapshot);
    excessive.orders[0].flavors = { momo: { tare: 4 } };
    const operation = excessive.operations.find(
      (op) => op.command.type === 'reserve',
    )!;
    if (operation.command.type === 'reserve')
      operation.command.flavors = excessive.orders[0].flavors;
    expect(() => validateSnapshot(excessive)).toThrow();
  });

  it('味の改名後も価格の版に保存した注文時の名前を保つ', async () => {
    const { store, run, reserve } = await setup();
    const price = {
      ...normalPrice(newId()),
      flavors: [{ id: 'tare', name: '甘口' }],
    };
    await run({ type: 'price', price });
    await run({ ...reserve({ momo: { tare: 3 } }), price });
    await run({
      type: 'price',
      price: { ...price, id: newId(), flavors: [{ id: 'tare', name: '辛口' }] },
    });
    const snapshot = parseBackup(encodeBackup((await store.read())!));
    expect(snapshot.orders[0].price.flavors).toEqual([
      { id: 'tare', name: '甘口' },
    ]);
  });
});
