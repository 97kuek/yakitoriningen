import { expect, it } from 'vitest';
import { normalPrice } from './model';
import type { Order } from './model';
import { quote } from './pricing';
import {
  profit,
  quantitiesByProduct,
  salesByHalfHour,
  summarizeSales,
} from './sales';
function order(overrides: Partial<Order> = {}): Order {
  const price = normalPrice('normal'),
    quantities = { momo: 3, kawa: 2, negima: 0 };
  return {
    id: 'one',
    assignmentId: 'assignment',
    confirmOperationId: 'pay',
    event: '祭',
    day: '2026-11-07',
    ticket: 1,
    quantities,
    names: { momo: 'もも', kawa: 'かわ', negima: 'ねぎま' },
    price,
    quote: quote(quantities, price),
    status: 'paid',
    received: 1000,
    change: 400,
    delivered: false,
    returned: false,
    refunded: 0,
    createdAt: '2026-11-07T01:00:00Z',
    paidAt: '2026-11-07T01:05:00Z',
    cancelReason: null,
    ...overrides,
  };
}
it('保留を売上に含めず、保存した会計額から返金を差し引き、追加・削除済み商品も数える', () => {
  const result = summarizeSales([
    order(),
    order({
      id: 'two',
      status: 'cancelled',
      refunded: 600,
      cancelReason: '返金',
    }),
    order({
      id: 'pending',
      status: 'pending',
      received: null,
      change: null,
      paidAt: null,
    }),
    order({
      id: 'removed-product',
      quantities: { tsukune: 2 },
      quote: { total: 400, count: 2, bundles: 0, singles: 2 },
    }),
  ]);
  expect(result).toEqual({
    sales: 1000,
    gross: 1600,
    refunds: 600,
    count: 7,
    orders: 2,
  });
  expect(summarizeSales([])).toEqual({
    sales: 0,
    gross: 0,
    refunds: 0,
    count: 0,
    orders: 0,
  });
});
it('経費未登録を0円と区別し、赤字も正しく計算する', () => {
  expect(profit(600, null)).toBeNull();
  expect(profit(600, undefined)).toBeNull();
  expect(profit(600, 0)).toBe(600);
  expect(profit(600, 1000)).toBe(-400);
});
it('30分区切りは日本時間の会計時刻で集計し、空の区間と返金を反映する', () => {
  const rows = [
    order({ paidAt: '2026-11-07T01:29:59Z' }),
    order({ paidAt: '2026-11-07T01:30:00Z' }),
    order({ paidAt: '2026-11-07T02:30:00Z' }),
    order({ status: 'cancelled', refunded: 600 }),
    order({ status: 'pending', received: null, paidAt: null }),
  ];
  expect(salesByHalfHour(rows)).toEqual([
    { minute: 600, sales: 600 },
    { minute: 630, sales: 600 },
    { minute: 660, sales: 0 },
    { minute: 690, sales: 600 },
  ]);
  expect(salesByHalfHour([])).toEqual([]);
  expect(
    salesByHalfHour([order({ paidAt: '2026-11-07T15:00:00Z' })])[0].minute,
  ).toBe(0);
});
it('商品別本数は保存された名前でまとめ、保留と返金を含めない', () => {
  expect(
    quantitiesByProduct([
      order(),
      order({ status: 'cancelled', refunded: 600 }),
      order({ quantities: { tsukune: 4 }, names: { tsukune: 'つくね' } }),
    ]),
  ).toEqual([
    { id: 'tsukune', name: 'つくね', quantity: 4 },
    { id: 'momo', name: 'もも', quantity: 3 },
    { id: 'kawa', name: 'かわ', quantity: 2 },
  ]);
});
