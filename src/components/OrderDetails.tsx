import type { Order, Snapshot } from '../domain/model';
import { orderItems, yen } from '../presentation/format';
import './OrderDetails.css';

export function receiptNumber(order: Order, snapshot: Snapshot) {
  const payment = snapshot.logs.find(
    (log) => log.type === 'pay' && log.operationId === order.confirmOperationId,
  );
  return payment
    ? `会計 No.${String(payment.sequence).padStart(4, '0')}`
    : '会計未確定';
}

export function orderDateTime(order: Order) {
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Asia/Tokyo',
  }).format(new Date(order.paidAt ?? order.createdAt));
}

export function orderState(order: Order) {
  return order.status === 'pending'
    ? '会計保留'
    : order.status === 'cancelled'
      ? order.refunded > 0
        ? '全額返金済み'
        : '取消済み'
      : order.delivered
        ? '受け渡し済み'
        : '受け渡し待ち';
}

export function OrderDetails({
  order,
  snapshot,
}: {
  order: Order;
  snapshot: Snapshot;
}) {
  return (
    <section
      className="order-details"
      data-testid="order-details"
      aria-label="選んだ注文の会計情報"
    >
      <div className="order-details-heading">
        <strong data-testid="receipt-number">
          {receiptNumber(order, snapshot)}
        </strong>
        <span className="ticket-badge">札 {order.ticket}</span>
      </div>
      <time
        className="order-details-time"
        dateTime={order.paidAt ?? order.createdAt}
      >
        {order.paidAt ? '会計日時' : '受付日時'} {orderDateTime(order)}
      </time>
      <ul className="order-details-items" aria-label="注文した商品">
        {orderItems(order).map((item) => (
          <li key={item.id}>
            <span>{item.name}</span>
            <span>{item.quantity}本</span>
          </li>
        ))}
      </ul>
      <dl className="order-details-facts">
        <div>
          <dt>会計額</dt>
          <dd>{yen(order.quote.total)}</dd>
        </div>
        <div>
          <dt>お預かり</dt>
          <dd data-testid="received-amount">
            {order.received === null ? '未入金' : yen(order.received)}
          </dd>
        </div>
        <div>
          <dt>お釣り</dt>
          <dd>{order.change === null ? '未確定' : yen(order.change)}</dd>
        </div>
        {order.refunded > 0 && (
          <div>
            <dt>返金額</dt>
            <dd>{yen(order.refunded)}</dd>
          </div>
        )}
      </dl>
      <div className="order-details-status">
        <span>{orderState(order)}</span>
        <span>{order.returned ? '札回収済み' : '札未回収'}</span>
      </div>
      {order.cancelReason && (
        <p className="order-details-reason">取消理由：{order.cancelReason}</p>
      )}
    </section>
  );
}
