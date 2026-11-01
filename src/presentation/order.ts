import type { Order, Snapshot } from '../domain/model';
import { JAPAN_TIME_ZONE } from '../domain/time';

const RECEIPT_NUMBER_DIGITS = 4;

const dateTimeFormat = new Intl.DateTimeFormat('ja-JP', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  timeZone: JAPAN_TIME_ZONE,
});

/**
 * Receipt number derived from the payment's log sequence, so no new stored field is needed.
 * Numbers have gaps but tell apart orders with the same ticket, time and contents.
 */
export function receiptNumber(
  order: Pick<Order, 'confirmOperationId'>,
  snapshot: Pick<Snapshot, 'logs'>,
): string | null {
  const payment = snapshot.logs.find(
    (log) => log.type === 'pay' && log.operationId === order.confirmOperationId,
  );
  return payment
    ? `No.${String(payment.sequence).padStart(RECEIPT_NUMBER_DIGITS, '0')}`
    : null;
}

export function orderDateTime(order: Pick<Order, 'paidAt' | 'createdAt'>) {
  return dateTimeFormat.format(new Date(order.paidAt ?? order.createdAt));
}

/** Detailed state for the order details panel. */
export function orderState(order: Order) {
  if (order.status === 'pending') return '会計保留';
  if (order.status === 'cancelled')
    return order.refunded > 0 ? '全額返金済み' : '取消済み';
  return order.delivered ? '受け渡し済み' : '受け渡し待ち';
}

/** Short state for the history table. */
export function historyStateLabel(order: Order) {
  if (order.status === 'cancelled') return '取消';
  return order.status === 'paid' && order.delivered ? '完了' : '未完了';
}
