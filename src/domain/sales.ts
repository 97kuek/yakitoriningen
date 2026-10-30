import { emptyQuantities, products } from './model';
import type { Order } from './model';

export function summarizeSales(orders: readonly Order[]) {
  const settled = orders.filter((o) => o.received !== null);
  const sold = orders.filter((o) => o.status === 'paid');
  const gross = settled.reduce((n, o) => n + o.quote.total, 0);
  const refunds = settled.reduce((n, o) => n + o.refunded, 0);
  const quantities = emptyQuantities();
  for (const order of sold)
    for (const p of products) quantities[p.id] += order.quantities[p.id];
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
