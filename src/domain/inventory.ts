import type { Snapshot, Quantities } from './model';

/** Registered supply for one business day. Refunds do not put food back. */
export function stockForDay(
  snapshot: Snapshot,
  day = snapshot.meta.day,
): Quantities {
  const sequence = new Map(
    snapshot.logs.map((log) => [log.operationId, log.sequence]),
  );
  const latest = snapshot.operations
    .filter(
      (op) =>
        op.day === day &&
        op.status === 'done' &&
        ['stock', 'catalog', 'startDay'].includes(op.command.type),
    )
    .sort((a, b) => (sequence.get(b.id) ?? 0) - (sequence.get(a.id) ?? 0))[0];
  if (!latest) return {};
  const command = latest.command;
  if (command.type === 'stock') return command.quantities;
  return command.type === 'catalog' || command.type === 'startDay'
    ? command.stock
    : {};
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
