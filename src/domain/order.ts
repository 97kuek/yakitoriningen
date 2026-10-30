import type { Command, Order } from './model';

type OrderAction = Extract<
  Command,
  { type: 'pay' | 'cancel' | 'deliver' | 'return' | 'complete' | 'undoHandoff' }
>;

/** Order state transitions contain no browser, clock, or persistence access. */
export function applyOrderAction(
  current: Order,
  action: OrderAction,
  operationId: string,
  at: string,
  paymentPending: boolean,
): Order {
  if (
    current.id !== action.orderId ||
    current.assignmentId !== action.assignmentId
  )
    throw new Error('注文と札の割り当てが一致しません。');
  const order = { ...current };
  switch (action.type) {
    case 'pay':
      if (
        operationId !== order.confirmOperationId ||
        order.status !== 'pending'
      )
        throw new Error(
          '確定済みまたは異なる会計操作です。履歴を確認してください。',
        );
      if (action.received < order.quote.total)
        throw new Error('お預かり金額が不足しています。');
      return {
        ...order,
        status: 'paid',
        received: action.received,
        change: action.received - order.quote.total,
        paidAt: at,
      };
    case 'cancel':
      if (order.status === 'cancelled') throw new Error('取消済みです。');
      if (order.status === 'pending') {
        if (paymentPending)
          throw new Error(
            '入金の照合が必要です。先に保留中の確定操作を照合または破棄してください。',
          );
        order.returned = true;
      } else order.refunded = order.quote.total;
      return { ...order, status: 'cancelled', cancelReason: action.reason };
    case 'complete':
    case 'deliver':
      if (order.status !== 'paid' || order.delivered)
        throw new Error('受け渡しできる会計済み注文ではありません。');
      return {
        ...order,
        delivered: true,
        returned: action.type === 'complete' || order.returned,
      };
    case 'undoHandoff':
      if (order.status !== 'paid' || !order.delivered || !order.returned)
        throw new Error('取り消せる受け渡し完了ではありません。');
      return { ...order, delivered: false, returned: false };
    case 'return':
      if (order.status === 'pending' || order.returned)
        throw new Error('この札は回収操作できません。');
      return { ...order, returned: true };
  }
}
