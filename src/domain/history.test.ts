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
