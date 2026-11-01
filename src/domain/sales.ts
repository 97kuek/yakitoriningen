import { TIME_SLOT_MINUTES } from './constants';
import type { Order } from './model';
import { japanMinuteOfDay } from './time';

/** Sales net of refunds. Pending orders are not sales; full refunds remove their skewers. */
export function summarizeSales(orders: readonly Order[]) {
  const settled = orders.filter((o) => o.received !== null);
  const sold = orders.filter((o) => o.status === 'paid');
  const gross = settled.reduce((n, o) => n + o.quote.total, 0);
  const refunds = settled.reduce((n, o) => n + o.refunded, 0);
  return {
    sales: gross - refunds,
    gross,
    refunds,
    count: sold.reduce((n, o) => n + o.quote.count, 0),
    orders: sold.length,
  };
}

export function profit(
  sales: number,
  expenses: number | null | undefined,
): number | null {
  return expenses == null ? null : sales - expenses;
}

/** Net receipts per half hour in Japan, by each order's paid time, including empty slots. */
export function salesByHalfHour(orders: readonly Order[]) {
  const groups = new Map<number, number>();
  for (const order of orders) {
    if (order.received === null || !order.paidAt) continue;
    const minute = japanMinuteOfDay(order.paidAt);
    if (!Number.isFinite(minute)) continue;
    const slot = minute - (minute % TIME_SLOT_MINUTES);
    groups.set(
      slot,
      (groups.get(slot) ?? 0) + order.quote.total - order.refunded,
    );
  }
  if (!groups.size) return [];
  const first = Math.min(...groups.keys());
  const last = Math.max(...groups.keys());
  return Array.from(
    { length: (last - first) / TIME_SLOT_MINUTES + 1 },
    (_, index) => {
      const minute = first + index * TIME_SLOT_MINUTES;
      return { minute, sales: groups.get(minute) ?? 0 };
    },
  );
}

export function quantitiesByProduct(orders: readonly Order[]) {
  const products = new Map<
    string,
    { id: string; name: string; quantity: number }
  >();
  for (const order of orders) {
    if (order.status !== 'paid') continue;
    for (const [id, quantity] of Object.entries(order.quantities)) {
      if (!quantity) continue;
      const previous = products.get(id);
      products.set(id, {
        id,
        name: order.names[id] ?? previous?.name ?? '商品',
        quantity: (previous?.quantity ?? 0) + quantity,
      });
    }
  }
  return [...products.values()].sort(
    (a, b) => b.quantity - a.quantity || a.id.localeCompare(b.id),
  );
}
