import type { Snapshot } from './model';

/** Starting a new day preserves the ledger and requires the previous work to be settled. */
export function validateDaySetup(
  snapshot: Snapshot,
  day: string,
  expectedSequence: number,
  operationId?: string,
) {
  if (snapshot.meta.sequence !== expectedSequence)
    throw new Error(
      '準備中に記録が変わりました。営業日の準備を開き直してください。',
    );
  if (
    snapshot.operations.some(
      (op) => op.id !== operationId && op.status === 'pending',
    ) ||
    snapshot.tickets.some((ticket) => ticket.orderId !== null)
  )
    throw new Error(
      '途中の会計と番号札の回収を終えてから、別の日を準備してください。',
    );
  if (
    day === snapshot.meta.day ||
    snapshot.operations.some(
      (op) => op.id !== operationId && op.status === 'done' && op.day === day,
    ) ||
    snapshot.orders.some((order) => order.day === day)
  )
    throw new Error(
      'この営業日の記録があります。設定の営業日で再開してください。',
    );
}
