import type { Context, Meta, Operation, Order, Snapshot } from './model';

export function contextOf(
  meta: Pick<Meta, 'databaseId' | 'generation'>,
): Context {
  return { databaseId: meta.databaseId, generation: meta.generation };
}

/** Reserved orders whose cash has not been confirmed yet. */
export function pendingOrders(snapshot: Pick<Snapshot, 'orders'>): Order[] {
  return snapshot.orders.filter((order) => order.status === 'pending');
}

/**
 * Prepared operations whose outcome the operator must confirm.
 * A staged payment of a pending order is shown on its payment screen instead.
 */
export function unresolvedOperations(
  snapshot: Pick<Snapshot, 'orders' | 'operations'>,
): Operation[] {
  const reserved = pendingOrders(snapshot);
  return snapshot.operations.filter((operation) => {
    if (operation.status !== 'pending') return false;
    const command = operation.command;
    return !(
      command.type === 'pay' &&
      reserved.some(
        (order) =>
          order.confirmOperationId === operation.id &&
          order.id === command.orderId &&
          order.assignmentId === command.assignmentId,
      )
    );
  });
}
