import {
  BUSINESS_CLOSE_MINUTE,
  BUSINESS_OPEN_MINUTE,
  TIME_SLOT_MINUTES,
} from './constants';
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

/** Start minute of the half-hour slot containing a paid time in Japan, or null. */
function paidSlot(order: Order): number | null {
  if (order.received === null || !order.paidAt) return null;
  const minute = japanMinuteOfDay(order.paidAt);
  if (!Number.isFinite(minute)) return null;
  return minute - (minute % TIME_SLOT_MINUTES);
}

/**
 * Slot starts covering business hours, widened to include any payment outside
 * them, or none when nothing was paid. Charts share it so their axes line up.
 */
export function chartSlots(orders: readonly Order[]): number[] {
  const paid = orders
    .map(paidSlot)
    .filter((slot): slot is number => slot !== null);
  if (!paid.length) return [];
  const first = Math.min(BUSINESS_OPEN_MINUTE, ...paid);
  const last = Math.max(BUSINESS_CLOSE_MINUTE - TIME_SLOT_MINUTES, ...paid);
  return Array.from(
    { length: (last - first) / TIME_SLOT_MINUTES + 1 },
    (_, index) => first + index * TIME_SLOT_MINUTES,
  );
}

/** Net receipts per half hour in Japan, by each order's paid time. Refunds count at the original time. */
export function salesByHalfHour(orders: readonly Order[]) {
  const groups = new Map<number, number>();
  for (const order of orders) {
    const slot = paidSlot(order);
    if (slot === null) continue;
    groups.set(
      slot,
      (groups.get(slot) ?? 0) + order.quote.total - order.refunded,
    );
  }
  return chartSlots(orders).map((minute) => ({
    minute,
    sales: groups.get(minute) ?? 0,
  }));
}

/** Skewers sold per half hour and product. Refunded orders are excluded, as in the product totals. */
export function quantitiesByHalfHour(orders: readonly Order[]) {
  const groups = new Map<number, Record<string, number>>();
  for (const order of orders) {
    const slot = paidSlot(order);
    if (slot === null || order.status !== 'paid') continue;
    const quantities = groups.get(slot) ?? {};
    for (const [id, quantity] of Object.entries(order.quantities))
      if (quantity) quantities[id] = (quantities[id] ?? 0) + quantity;
    groups.set(slot, quantities);
  }
  return chartSlots(orders).map((minute) => {
    const quantities = groups.get(minute) ?? {};
    return {
      minute,
      quantities,
      total: Object.values(quantities).reduce((sum, n) => sum + n, 0),
    };
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
