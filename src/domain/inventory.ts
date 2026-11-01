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
        op.day === day && op.status === 'done' && op.command.type === 'stock',
    )
    .sort((a, b) => (sequence.get(b.id) ?? 0) - (sequence.get(a.id) ?? 0))[0];
  return latest?.command.type === 'stock' ? latest.command.quantities : {};
}

export function remainingStock(
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
