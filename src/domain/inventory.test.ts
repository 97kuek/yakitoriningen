import { expect, it } from 'vitest';
import type { Order, Snapshot } from './model';
import { normalPrice } from './model';
import { stockLevels, validateStock } from './inventory';

function order(overrides: Partial<Order>): Order {
  return {
    id: 'order',
    assignmentId: 'assignment',
    confirmOperationId: 'payment',
    event: '在庫試験',
    day: '2026-11-07',
    ticket: 1,
    quantities: {},
    names: {},
    price: normalPrice('price'),
    quote: { total: 0, count: 0, bundles: 0, singles: 0 },
    status: 'paid',
    paidAt: '2026-11-07T01:00:00Z',
    received: 0,
    change: 0,
    delivered: false,
    returned: false,
    refunded: 0,
    createdAt: '2026-11-07T01:00:00Z',
    cancelReason: null,
    ...overrides,
  };
}

function fixture(): Snapshot {
  return {
    meta: {
      key: 'main',
      databaseId: 'inventory-test',
      generation: 'one',
      event: '在庫試験',
      day: '2026-11-07',
      activePriceId: 'price',
      ticketCount: 20,
      sequence: 2,
      expenseTotal: null,
    },
    prices: [normalPrice('price')],
    tickets: [],
    operations: [
      {
        id: 'stock',
        day: '2026-11-07',
        status: 'done',
        command: { type: 'stock', quantities: { momo: 10, kawa: 2 } },
      },
      {
        id: 'other',
        day: '2026-11-08',
        status: 'done',
        command: { type: 'stock', quantities: { momo: 20 } },
      },
    ].map((operation) => ({
      ...operation,
      context: { databaseId: 'inventory-test', generation: 'one' },
      event: '在庫試験',
      result: '設定',
      createdAt: '2026-11-07T01:00:00Z',
    })) as Snapshot['operations'],
    logs: [
      { operationId: 'stock', sequence: 1 },
      { operationId: 'other', sequence: 2 },
    ].map((log) => ({
      ...log,
      type: 'stock',
      target: '設定',
      at: '2026-11-07T01:00:00Z',
    })),
    orders: [
      {
        day: '2026-11-07',
        status: 'paid',
        paidAt: '2026-11-07T01:00:00Z',
        quantities: { momo: 3 },
      },
      {
        day: '2026-11-07',
        status: 'cancelled',
        paidAt: '2026-11-07T01:01:00Z',
        quantities: { momo: 2 },
      },
      {
        day: '2026-11-07',
        status: 'pending',
        paidAt: null,
        quantities: { momo: 4, kawa: 3, untracked: 1 },
      },
      {
        day: '2026-11-07',
        status: 'cancelled',
        paidAt: null,
        quantities: { momo: 100 },
      },
      {
        day: '2026-11-08',
        status: 'paid',
        paidAt: '2026-11-08T01:00:00Z',
        quantities: { momo: 7 },
      },
    ].map((item) => order(item as Partial<Order>)),
  };
}

it('販売・予約・返金を区別して日別の在庫を一度に計算し、入力を変更しない', () => {
  const snapshot = fixture();
  const before = structuredClone(snapshot);
  expect(stockLevels(snapshot)).toEqual({
    balance: { momo: 5, kawa: 2 },
    remaining: { momo: 5, kawa: 2 },
    available: { momo: 1, kawa: 0 },
  });
  expect(stockLevels(snapshot, '2026-11-08')).toEqual({
    balance: { momo: 13 },
    remaining: { momo: 13 },
    available: { momo: 13 },
  });
  expect(snapshot).toEqual(before);
});

it('旧データの不足は残数を0にし、不整合判定の元の差分は残す', () => {
  const snapshot = fixture();
  snapshot.orders.push(
    order({
      day: snapshot.meta.day,
      status: 'paid',
      paidAt: '2026-11-07T01:02:00Z',
      quantities: { momo: 8 },
    }),
  );
  expect(stockLevels(snapshot)).toEqual({
    balance: { momo: -3, kawa: 2 },
    remaining: { momo: 0, kawa: 2 },
    available: { momo: 0, kawa: 0 },
  });
});

it('在庫の未登録を0と区別し、予約と返金済みの販売分未満は登録できない', () => {
  const snapshot = fixture();
  expect(stockLevels({ ...snapshot, operations: [], logs: [] })).toEqual({
    balance: {},
    remaining: {},
    available: {},
  });
  expect(() => validateStock(snapshot, { momo: 8 })).toThrow('9本以上');
  expect(() => validateStock(snapshot, { momo: 9, kawa: 3 })).not.toThrow();
});
