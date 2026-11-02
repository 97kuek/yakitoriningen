import type { Order, Operation, Snapshot } from '../domain/model';
import { applyOrderAction } from '../domain/order';
import { handoffUndoError } from '../domain/handoff';
import { reservedTicket } from '../domain/ticket';
import { canonical } from './serialization';

/** Replay persisted actions so a completion and its undo retain both records. */
export function validateOrderHistory(
  order: Order,
  actions: Operation[],
  snapshot: Snapshot,
): void {
  const sequences = new Map(
    snapshot.logs.map((log) => [log.operationId, log.sequence]),
  );
  let replay: Order = {
    ...order,
    ticket: reservedTicket(order, actions, snapshot.logs),
    status: 'pending',
    received: null,
    change: null,
    paidAt: null,
    delivered: false,
    returned: false,
    refunded: 0,
    cancelReason: null,
  };
  for (const action of [...actions].sort(
    (a, b) => (sequences.get(a.id) ?? 0) - (sequences.get(b.id) ?? 0),
  )) {
    const command = action.command;
    if (!('orderId' in command) || command.type === 'reserve') continue;
    if (command.type === 'undoHandoff') {
      const sequence = sequences.get(action.id) ?? 0;
      const error = handoffUndoError(
        replay,
        command.completionId,
        snapshot,
        { number: order.ticket, orderId: null, assignmentId: null },
        sequence,
      );
      if (error) throw new Error(error);
    }
    replay = applyOrderAction(
      replay,
      command,
      action.id,
      order.paidAt ?? action.createdAt,
      false,
    );
  }
  const state = (value: Order) => ({
    ticket: value.ticket,
    status: value.status,
    received: value.received,
    change: value.change,
    delivered: value.delivered,
    returned: value.returned,
    refunded: value.refunded,
    cancelReason: value.cancelReason,
  });
  if (canonical(state(replay)) !== canonical(state(order)))
    throw new Error('注文の状態と操作記録が一致しません。');
}
