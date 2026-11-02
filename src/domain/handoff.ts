import type { Order, Snapshot, Ticket } from './model';
import { reservedTicket } from './ticket';

type HandoffHistory = Pick<Snapshot, 'orders' | 'operations' | 'logs'>;

/** A released ticket can only be reclaimed before any later reservation uses it. */
export function handoffUndoError(
  order: Order,
  completionId: string,
  history: HandoffHistory,
  ticket: Ticket | undefined,
  beforeSequence = Number.POSITIVE_INFINITY,
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
    completedAt === undefined ||
    completedAt >= beforeSequence
  )
    return '受け渡し完了の記録が見つかりません。';
  if (
    history.logs.some(
      (log) =>
        log.target === order.id &&
        log.sequence > completedAt &&
        log.sequence < beforeSequence,
    )
  )
    return '直近の受け渡し完了だけ取り消せます。';
  const sequences = new Map(
    history.logs.map((log) => [log.operationId, log.sequence]),
  );
  const orders = new Map(history.orders.map((other) => [other.id, other]));
  const reused = history.operations.some((op) => {
    const sequence = sequences.get(op.id) ?? 0;
    const command = op.command;
    if (
      op.status !== 'done' ||
      (command.type !== 'reserve' && command.type !== 'selectTicket') ||
      command.orderId === order.id ||
      sequence <= completedAt ||
      sequence >= beforeSequence
    )
      return false;
    const other = orders.get(command.orderId);
    const number =
      command.type === 'selectTicket'
        ? command.ticket
        : other
          ? reservedTicket(other, history.operations, history.logs)
          : undefined;
    return number === order.ticket;
  });
  if (
    !ticket ||
    ticket.orderId !== null ||
    reused ||
    (ticket.reuseSequence ?? 0) > completedAt
  )
    return 'この札は既に再利用されています。完了を取り消せません。';
  return null;
}
