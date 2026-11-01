import { emptyQuantities } from './model';
import type { Order } from './model';

export function summarizeSales(orders: readonly Order[]) {
  const settled = orders.filter((o) => o.received !== null);
  const sold = orders.filter((o) => o.status === 'paid');
  const gross = settled.reduce((n, o) => n + o.quote.total, 0);
  const refunds = settled.reduce((n, o) => n + o.refunded, 0);
  const quantities = emptyQuantities();
  for (const order of sold)
    for (const [id, quantity] of Object.entries(order.quantities))
      quantities[id] = (quantities[id] ?? 0) + quantity;
  return {
    sales: gross - refunds,
    gross,
    refunds,
    count: sold.reduce((n, o) => n + o.quote.count, 0),
    orders: sold.length,
    pending: orders.filter((o) => o.status === 'pending').length,
    quantities,
  };
}
export function profit(
  sales: number,
  expenses: number | null | undefined,
): number | null {
  return expenses == null ? null : sales - expenses;
}
export function salesByDay(
  orders: readonly Order[],
): { day: string; sales: number }[] {
  const groups = new Map<string, number>();
  for (const order of orders)
    if (order.status === 'paid')
      groups.set(order.day, (groups.get(order.day) ?? 0) + order.quote.total);
  return [...groups]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, sales]) => ({ day, sales }));
}
export function salesByHour(
  orders: readonly Order[],
): { hour: number; sales: number }[] {
  const groups = new Map<number, number>();
  for (const order of orders)
    if (order.status === 'paid' && order.paidAt) {
      const hour = (new Date(order.paidAt).getUTCHours() + 9) % 24;
      if (Number.isFinite(hour))
        groups.set(hour, (groups.get(hour) ?? 0) + order.quote.total);
    }
  return [...groups]
    .sort(([a], [b]) => a - b)
    .map(([hour, sales]) => ({ hour, sales }));
}

/** Net receipts grouped by half-hour in Japan, using each order's paid time. */
export function salesByHalfHour(orders: readonly Order[]) {
  const groups = new Map<number, number>();
  for (const order of orders) {
    if (order.received === null || !order.paidAt) continue;
    const date = new Date(order.paidAt);
    const minute =
      ((date.getUTCHours() + 9) % 24) * 60 +
      Math.floor(date.getUTCMinutes() / 30) * 30;
    if (!Number.isFinite(minute)) continue;
    groups.set(
      minute,
      (groups.get(minute) ?? 0) + order.quote.total - order.refunded,
    );
  }
  if (!groups.size) return [];
  const first = Math.min(...groups.keys()),
    last = Math.max(...groups.keys());
  return Array.from({ length: (last - first) / 30 + 1 }, (_, index) => {
    const minute = first + index * 30;
    return { minute, sales: groups.get(minute) ?? 0 };
  });
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
