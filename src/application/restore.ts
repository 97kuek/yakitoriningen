import type { Snapshot } from '../domain/model';
import { releasesTicket } from '../domain/ticket';
import { canonical } from './serialization';
import { validateSnapshot } from './backup';

/** Replace the dates in a backup, retaining every other day's ledger and receipt sequences. */
export function restoreDays(
  incoming: Snapshot,
  current: Snapshot | null,
): Snapshot {
  if (!current) return incoming;
  const days = new Set([
    incoming.meta.day,
    ...incoming.orders.map((order) => order.day),
    ...incoming.operations
      .filter((op) => !('orderId' in op.command))
      .map((op) => op.day),
  ]);
  const orders = current.orders.filter((order) => !days.has(order.day));
  const ids = new Set(orders.map((order) => order.id));
  const operations = current.operations.filter((op) =>
    'orderId' in op.command
      ? ids.has(op.command.orderId) ||
        (op.command.type === 'reserve' &&
          op.status !== 'done' &&
          !days.has(op.day))
      : !days.has(op.day),
  );
  if (
    orders.some((order) => !releasesTicket(order)) ||
    operations.some((op) => op.status === 'pending')
  )
    throw new Error('別の日の会計と札回収を終えてから復元してください。');
  if (!orders.length && !operations.length) return incoming;
  if (current.meta.event !== incoming.meta.event)
    throw new Error(
      '営業名が異なります。同じ営業のバックアップを選んでください。',
    );
  const operationIds = new Set(operations.map((op) => op.id));
  const logs = [
    ...current.logs.filter((log) => operationIds.has(log.operationId)),
    ...incoming.logs,
  ];
  // Never renumber receipts or silently overwrite an independently created day's logs.
  if (new Set(logs.map((log) => log.sequence)).size !== logs.length)
    throw new Error(
      '別の日の会計番号と重複するため復元できません。集計画面で各日のバックアップを読み込んでください。',
    );
  const prices = new Map(current.prices.map((price) => [price.id, price]));
  for (const price of incoming.prices) {
    if (
      prices.has(price.id) &&
      canonical(prices.get(price.id)) !== canonical(price)
    )
      throw new Error(
        '商品の記録が一致しません。元のバックアップを確認してください。',
      );
    prices.set(price.id, price);
  }
  const combined = [...operations, ...incoming.operations].map((op) => ({
    ...op,
    context: { ...op.context, databaseId: incoming.meta.databaseId },
  }));
  const allOrders = [...orders, ...incoming.orders];
  const orderMap = new Map(allOrders.map((order) => [order.id, order]));
  const operationMap = new Map(combined.map((op) => [op.id, op]));
  const reuse = new Map(
    current.tickets.map((ticket) => [ticket.number, ticket.reuseSequence ?? 0]),
  );
  const sequence = Math.max(current.meta.sequence, incoming.meta.sequence);
  let expenseTotal: number | null = null;
  for (const log of [...logs].sort((a, b) => a.sequence - b.sequence)) {
    const op = operationMap.get(log.operationId);
    if (op?.status !== 'done') continue;
    if (op.command.type === 'expense') expenseTotal = op.command.amount;
    if (op.command.type === 'reserve') {
      const order = orderMap.get(op.command.orderId);
      if (order)
        reuse.set(
          order.ticket,
          Math.max(reuse.get(order.ticket) ?? 0, log.sequence),
        );
    }
  }
  return validateSnapshot({
    ...incoming,
    meta: {
      ...incoming.meta,
      sequence,
      omittedLogs: sequence - logs.length,
      expenseTotal,
    },
    prices: [...prices.values()],
    orders: allOrders,
    operations: combined,
    logs,
    tickets: incoming.tickets.map((ticket) => ({
      ...ticket,
      reuseSequence: Math.max(
        ticket.reuseSequence ?? 0,
        reuse.get(ticket.number) ?? 0,
      ),
    })),
  });
}
