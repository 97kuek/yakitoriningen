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

/** Compute physical, display and reservable stock from the same day's records. */
export function stockLevels(snapshot: Snapshot, day = snapshot.meta.day) {
  const balance = stockForDay(snapshot, day);
  const reserved: Quantities = {};
  for (const order of snapshot.orders) {
    if (order.day !== day) continue;
    for (const [id, quantity] of Object.entries(order.quantities)) {
      if (!Object.hasOwn(balance, id)) continue;
      if (order.paidAt !== null) balance[id] -= quantity;
      if (order.status === 'pending')
        reserved[id] = (reserved[id] ?? 0) + quantity;
    }
  }
  const remaining: Quantities = {};
  const available: Quantities = {};
  for (const [id, value] of Object.entries(balance)) {
    remaining[id] = Math.max(0, value);
    available[id] = Math.max(0, remaining[id] - (reserved[id] ?? 0));
  }
  return { balance, remaining, available };
}

/** Physical stock is never displayed as a negative count. */
export function remainingStock(
  snapshot: Snapshot,
  day = snapshot.meta.day,
): Quantities {
  return stockLevels(snapshot, day).remaining;
}
export function availableStock(
  snapshot: Snapshot,
  day = snapshot.meta.day,
): Quantities {
  return stockLevels(snapshot, day).available;
}
export function validateStock(snapshot: Snapshot, stock: Quantities) {
  const used: Quantities = {};
  for (const order of snapshot.orders) {
    if (
      order.day !== snapshot.meta.day ||
      (order.paidAt === null && order.status !== 'pending')
    )
      continue;
    for (const [id, quantity] of Object.entries(order.quantities))
      used[id] = (used[id] ?? 0) + quantity;
  }
  for (const [id, value] of Object.entries(stock)) {
    if (value < (used[id] ?? 0))
      throw new Error(
        `在庫は販売・会計中の${used[id]}本以上にしてください。追加分も含めた、用意した本数を入力します。`,
      );
  }
}
