import type { Snapshot } from '../domain/model';
import { validateSnapshot } from './backup';

export function dailyExpense(
  snapshot: Snapshot,
  day = snapshot.meta.day,
): number | null {
  const sequence = new Map(
    snapshot.logs.map((log) => [log.operationId, log.sequence]),
  );
  const latest = snapshot.operations
    .filter(
      (op) =>
        op.day === day && op.status === 'done' && op.command.type === 'expense',
    )
    .sort((a, b) => (sequence.get(b.id) ?? 0) - (sequence.get(a.id) ?? 0))[0];
  return latest?.command.type === 'expense' ? latest.command.amount : null;
}

/** Keep original log/receipt numbers while selecting one day's complete order histories. */
export function dailySnapshot(
  snapshot: Snapshot,
  day = snapshot.meta.day,
): Snapshot {
  const orders = snapshot.orders.filter((order) => order.day === day);
  const orderIds = new Set(orders.map((order) => order.id));
  const operations = snapshot.operations.filter((op) =>
    'orderId' in op.command
      ? orderIds.has(op.command.orderId) ||
        (op.command.type === 'reserve' &&
          op.status !== 'done' &&
          op.day === day)
      : op.day === day,
  );
  const operationIds = new Set(operations.map((op) => op.id));
  const logs = snapshot.logs.filter((log) => operationIds.has(log.operationId));
  const priceIds = new Set([
    snapshot.meta.activePriceId,
    ...orders.map((order) => order.price.id),
  ]);
  for (const op of operations) {
    if ('price' in op.command) priceIds.add(op.command.price.id);
  }
  return validateSnapshot({
    meta: {
      ...snapshot.meta,
      day,
      expenseTotal: dailyExpense(snapshot, day),
      omittedLogs: snapshot.meta.sequence - logs.length,
    },
    orders,
    operations,
    logs,
    prices: snapshot.prices.filter((price) => priceIds.has(price.id)),
    tickets: snapshot.tickets.map((ticket) => {
      const related = new Set(
        snapshot.orders
          .filter((order) => order.ticket === ticket.number)
          .map((order) => order.id),
      );
      const reservations = new Set(
        snapshot.operations
          .filter(
            (op) =>
              op.status === 'done' &&
              op.command.type === 'reserve' &&
              related.has(op.command.orderId),
          )
          .map((op) => op.id),
      );
      const reuseSequence = Math.max(
        ticket.reuseSequence ?? 0,
        ...snapshot.logs
          .filter((log) => reservations.has(log.operationId))
          .map((log) => log.sequence),
      );
      return {
        ...ticket,
        reuseSequence,
        ...(ticket.orderId && !orderIds.has(ticket.orderId)
          ? { orderId: null, assignmentId: null }
          : {}),
      };
    }),
  });
}
/** Reporting only: no restore or write. Duplicate dates are rejected, never added twice. */
export function combineDailyBackups(
  snapshots: Snapshot[],
): Pick<Snapshot, 'meta' | 'orders' | 'operations' | 'logs'> {
  if (!snapshots.length) throw new Error('バックアップを選んでください。');
  const days = new Set<string>();
  const daily = snapshots.map((snapshot) => {
    if (snapshot.meta.event !== snapshots[0].meta.event)
      throw new Error('同じ開催回のバックアップを選んでください。');
    if (days.has(snapshot.meta.day))
      throw new Error(
        `${snapshot.meta.day}が重複しています。1日につき1ファイルを選んでください。`,
      );
    days.add(snapshot.meta.day);
    return dailySnapshot(snapshot);
  });
  return {
    meta: daily[0].meta,
    orders: daily.flatMap((snapshot) => snapshot.orders),
    operations: daily.flatMap((snapshot) => snapshot.operations),
    logs: daily.flatMap((snapshot) => snapshot.logs),
  };
}
