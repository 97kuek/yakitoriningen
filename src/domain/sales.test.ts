import { expect, it } from 'vitest';
import { normalPrice } from './model';
import type { Order } from './model';
import { quote } from './pricing';
import { profit, salesByDay, salesByHour, summarizeSales } from './sales';
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
it('保留を売上に含めず、保存した会計額と返金額を集計する', () => {
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
  ]);
  expect(result).toMatchObject({
    sales: 600,
    gross: 1200,
    refunds: 600,
    count: 5,
    orders: 1,
    pending: 1,
    quantities: { momo: 3, kawa: 2, negima: 0 },
  });
});
it('経費未登録を0円と区別し、赤字も正しく計算する', () => {
  expect(profit(600, null)).toBeNull();
  expect(profit(600, undefined)).toBeNull();
  expect(profit(600, 0)).toBe(600);
  expect(profit(600, 1000)).toBe(-400);
});
it('営業日ごとの売上と、日本時間の入金時刻での売上を作る', () => {
  const rows = [
    order(),
    order({ id: 'two', day: '2026-11-08', paidAt: '2026-11-08T02:05:00Z' }),
    order({
      id: 'cancel',
      status: 'cancelled',
      refunded: 600,
      cancelReason: '返金',
    }),
  ];
  expect(salesByDay(rows)).toEqual([
    { day: '2026-11-07', sales: 600 },
    { day: '2026-11-08', sales: 600 },
  ]);
  expect(salesByHour(rows.filter((o) => o.day === '2026-11-07'))).toEqual([
    { hour: 10, sales: 600 },
  ]);
});
it('売上がないときは0円、グラフの記録なしを返す', () => {
  expect(summarizeSales([])).toMatchObject({ sales: 0, count: 0, orders: 0 });
  expect(salesByDay([])).toEqual([]);
  expect(salesByHour([])).toEqual([]);
});
it('追加商品・削除済み商品も過去注文から集計する', () => {
  const result = summarizeSales([
    order({
      quantities: { tsukune: 2 },
      quote: { total: 400, count: 2, bundles: 0, singles: 2 },
    }),
    order({
      quantities: { momo: 1, tsukune: 3 },
      quote: { total: 750, count: 4, bundles: 0, singles: 4 },
    }),
  ]);
  expect(result.quantities).toMatchObject({
    momo: 1,
    kawa: 0,
    negima: 0,
    tsukune: 5,
  });
  expect(result.count).toBe(6);
});

it('30分区切りは日本時間の会計時刻で集計し、空の区間と返金を反映する', async () => {
  const { salesByHalfHour } = await import('./sales');
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
it('商品別本数は保存された名前でまとめ、保留と返金を含めない', async () => {
  const { quantitiesByProduct } = await import('./sales');
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
