import type { Order, Snapshot, Ticket } from './model';

type HandoffHistory = Pick<Snapshot, 'orders' | 'operations' | 'logs'>;

/** A released ticket can only be reclaimed before any later reservation uses it. */
export function handoffUndoError(
  order: Order,
  completionId: string,
  history: HandoffHistory,
  ticket: Ticket | undefined,
): string | null {
  if (order.status !== 'paid' || !order.delivered || !order.returned)
    return '取り消せる受け渡し完了ではありません。';
  const completion = history.operations.find((op) => op.id === completionId);
  const completedAt = history.logs.find(
    (log) => log.operationId === completionId,
  )?.sequence;
  if (
    !completion ||
    completion.status !== 'done' ||
    completion.command.type !== 'complete' ||
    completion.command.orderId !== order.id ||
    completion.command.assignmentId !== order.assignmentId ||
    completedAt === undefined
  )
    return '受け渡し完了の記録が見つかりません。';
  if (
    history.logs.some(
      (log) => log.target === order.id && log.sequence > completedAt,
    )
  )
    return '直近の受け渡し完了だけ取り消せます。';
  const reusedOrders = new Set(
    history.orders
      .filter((other) => other.ticket === order.ticket && other.id !== order.id)
      .map((other) => other.id),
  );
  const laterReservations = history.operations.filter(
    (op) =>
      op.status === 'done' &&
      op.command.type === 'reserve' &&
      reusedOrders.has(op.command.orderId),
  );
  const reused = laterReservations.some((op) =>
    history.logs.some(
      (log) => log.operationId === op.id && log.sequence > completedAt,
    ),
  );
  if (!ticket || ticket.orderId !== null || reused)
    return 'この札は既に再利用されています。完了を取り消せません。';
  return null;
}

export function canUndoHandoff(
  order: Order,
  completionId: string,
  snapshot: Snapshot,
): boolean {
  return (
    handoffUndoError(
      order,
      completionId,
      snapshot,
      snapshot.tickets.find((ticket) => ticket.number === order.ticket),
    ) === null
  );
}
