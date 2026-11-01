import type { Order, Snapshot } from '../domain/model';
import { orderItems, yen } from '../presentation/format';
import {
  orderDateTime,
  historyStateLabel,
  receiptNumber,
} from '../presentation/order';
import './OrderDetails.css';
import { Ticket } from './Ticket';

export function OrderDetails({
  order,
  snapshot,
}: {
  order: Order;
  snapshot: Snapshot;
}) {
  const receipt = receiptNumber(order, snapshot);
  return (
    <section
      className="order-details"
      data-testid="order-details"
      aria-label="選んだ注文の会計情報"
    >
      <div className="order-details-heading">
        <strong data-testid="receipt-number">
          {receipt ? `会計 ${receipt}` : '会計未確定'}
        </strong>
        <Ticket number={order.ticket} />
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
        <span>{historyStateLabel(order)}</span>
        {!order.returned && <span>札未回収</span>}
      </div>
      {order.cancelReason && (
        <p className="order-details-reason">取消理由：{order.cancelReason}</p>
      )}
    </section>
  );
}
