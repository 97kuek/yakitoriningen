import type { Snapshot, Quantities } from './model';
import { MAX_STOCK } from './constants';

/** Registered supply for one business day. Refunds do not put food back. */
export function stockForDay(
  snapshot: Snapshot,
  day = snapshot.meta.day,
): Quantities {
  const sequence = new Map(
    snapshot.logs.map((log) => [log.operationId, log.sequence]),
  );
  let stock: Quantities = {};
  const operations = snapshot.operations
    .filter(
      (op) =>
        op.day === day &&
        op.status === 'done' &&
        ['stock', 'catalog', 'startDay', 'adjustStock'].includes(
          op.command.type,
        ),
    )
    .sort((a, b) => (sequence.get(a.id) ?? 0) - (sequence.get(b.id) ?? 0));
  for (const { command } of operations) {
    if (command.type === 'stock') stock = { ...command.quantities };
    else if (command.type === 'catalog' || command.type === 'startDay')
      stock = { ...command.stock };
    else if (command.type === 'adjustStock')
      stock[command.productId] += command.change;
  }
  return stock;
}

/** Validate a physical addition/discard against registered stock and current reservations. */
export function adjustedStock(
  snapshot: Snapshot,
  productId: string,
  change: number,
): Quantities {
  const stock = stockForDay(snapshot);
  if (!Object.hasOwn(stock, productId))
    throw new Error('先にこの商品の在庫を登録してください。');
  const next = stock[productId] + change;
  if (!Number.isInteger(change) || change === 0 || next < 0 || next > MAX_STOCK)
    throw new Error('在庫の調整本数を確認してください。');
  const quantities = { ...stock, [productId]: next };
  validateStock(snapshot, quantities);
  return quantities;
}

export function stockBalance(
  snapshot: Snapshot,
  day = snapshot.meta.day,
): Quantities {
  const remaining = { ...stockForDay(snapshot, day) };
  for (const order of snapshot.orders) {
    if (order.day !== day || order.paidAt === null) continue;
    for (const [id, quantity] of Object.entries(order.quantities)) {
      if (Object.hasOwn(remaining, id)) remaining[id] -= quantity;
    }
  }
  return remaining;
}

/** Physical stock is never displayed as a negative count. */
export function remainingStock(
  snapshot: Snapshot,
  day = snapshot.meta.day,
): Quantities {
  return Object.fromEntries(
    Object.entries(stockBalance(snapshot, day)).map(([id, value]) => [
      id,
      Math.max(0, value),
    ]),
  );
}
export function availableStock(
  snapshot: Snapshot,
  day = snapshot.meta.day,
): Quantities {
  const remaining = remainingStock(snapshot, day);
  for (const order of snapshot.orders) {
    if (order.day !== day || order.status !== 'pending') continue;
    for (const [id, value] of Object.entries(order.quantities))
      if (Object.hasOwn(remaining, id))
        remaining[id] = Math.max(0, remaining[id] - value);
  }
  return remaining;
}
export function validateStock(snapshot: Snapshot, stock: Quantities) {
  for (const [id, value] of Object.entries(stock)) {
    const used = snapshot.orders
      .filter(
        (order) =>
          order.day === snapshot.meta.day &&
          (order.paidAt !== null || order.status === 'pending'),
      )
      .reduce((sum, order) => sum + (order.quantities[id] ?? 0), 0);
    if (value < used)
      throw new Error(
        `在庫は販売・会計中の${used}本以上にしてください。追加分も含めた、用意した本数を入力します。`,
      );
  }
}
