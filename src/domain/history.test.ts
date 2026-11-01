import { expect, it } from 'vitest';
import { historyPage } from './history';
import type { Order } from './model';
it('札を完全一致で検索し、待ちだけを絞って新しい順に50件ずつ返す', () => {
  const orders = Array.from(
    { length: 105 },
    (_, index) =>
      ({
        id: String(index),
        ticket: (index % 2) + 1,
        status: 'paid',
        delivered: index % 3 === 0,
        createdAt: new Date(index * 1000).toISOString(),
      }) as Order,
  );
  const first = historyPage(orders, '', false, 0);
  expect(first.orders).toHaveLength(50);
  expect(first.orders[0].id).toBe('104');
  expect(historyPage(orders, '', false, 2).orders).toHaveLength(5);
  const filtered = historyPage(orders, '2', true, 0);
  expect(
    filtered.orders.every((order) => order.ticket === 2 && !order.delivered),
  ).toBe(true);
  expect(filtered.total).toBe(35);
  expect(historyPage(orders, '12', false, 0).orders).toEqual([]);
  expect(historyPage([], '', false, 10)).toMatchObject({
    page: 0,
    pages: 1,
    total: 0,
  });
});

it('日本時間の範囲を分単位で絞り、並べ替えてからページを分ける', () => {
  const orders = [
    {
      id: 'a',
      createdAt: '2026-11-01T00:59:59Z',
      ticket: 3,
      quote: { total: 600 },
    },
    {
      id: 'b',
      createdAt: '2026-11-01T01:00:00Z',
      ticket: 2,
      quote: { total: 300 },
    },
    {
      id: 'c',
      createdAt: '2026-11-01T02:00:59Z',
      ticket: 1,
      quote: { total: 900 },
    },
    {
      id: 'd',
      createdAt: '2026-11-01T02:01:00Z',
      ticket: 4,
      quote: { total: 150 },
    },
  ].map((order) => ({ ...order, status: 'paid', delivered: false })) as Order[];
  const options = {
    from: '10:00',
    to: '11:00',
    sort: 'amount' as const,
    direction: 'asc' as const,
  };
  expect(historyPage(orders, '', false, 0, 1, options)).toMatchObject({
    total: 2,
    pages: 2,
    orders: [{ id: 'b' }],
  });
  expect(historyPage(orders, '', false, 1, 1, options).orders[0].id).toBe('c');
  expect(
    historyPage(orders, '1', true, 0, 50, options).orders.map((o) => o.id),
  ).toEqual(['c']);
  expect(
    historyPage(orders, '', false, 0, 50, {
      sort: 'ticket',
      direction: 'asc',
    }).orders.map((o) => o.ticket),
  ).toEqual([1, 2, 3, 4]);
  expect(
    historyPage(orders, '', false, 0, 50, { from: '12:00', to: '10:00' }).total,
  ).toBe(0);
  expect(historyPage(orders, '', false, 0, 50, { to: '09:59' }).total).toBe(1);
  expect(orders[0].id).toBe('a');
});
