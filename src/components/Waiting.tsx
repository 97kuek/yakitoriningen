import { IconButton, Button } from './controls';
import { canUndoHandoff } from '../domain/handoff';
import { newId } from '../lib/id';
import { orderItems, timeText, dayText } from '../presentation/format';

import type { Order, Snapshot } from '../domain/model';
import type { Shared } from '../ui';
import { Icon } from './Icon';
export function Waiting({
  snapshot,
  perform,
  saveCommand,
  lastHandoff,
  onHandoffChange,
}: Shared & {
  snapshot: Snapshot;
  lastHandoff: { orderId: string; completionId: string } | null;
  onHandoffChange: (
    value: { orderId: string; completionId: string } | null,
  ) => void;
}) {
  const waiting = snapshot.orders
    .filter((o) => o.status === 'paid' && !o.delivered)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const unreturned = snapshot.orders.filter(
    (o) => !o.returned && (o.delivered || o.status === 'cancelled'),
  );
  const products = [
    ...new Map(
      waiting
        .flatMap((order) => orderItems(order))
        .map((item) => [item.id, item]),
    ).values(),
  ];
  const free = snapshot.tickets.filter((t) => t.orderId === null).length;
  const completedOrder = snapshot.orders.find(
    (order) => order.id === lastHandoff?.orderId,
  );
  function completeHandoff(order: Order) {
    void perform(async () => {
      const completionId = newId();
      await saveCommand(
        {
          type: 'complete',
          orderId: order.id,
          assignmentId: order.assignmentId,
        },
        completionId,
      );
      onHandoffChange({ orderId: order.id, completionId });
    });
  }
  function recoverTicket(order: Order) {
    void perform(() =>
      saveCommand({
        type: 'return',
        orderId: order.id,
        assignmentId: order.assignmentId,
      }),
    );
  }
  return (
    <aside className="waiting panel" aria-labelledby="waiting-title">
      <div className="section-heading">
        <h2 id="waiting-title">
          受け渡し待ち<span className="count-badge">{waiting.length}</span>
        </h2>
        <span className={`ticket-availability${!free ? ' full' : ''}`}>
          <Icon name="ticket" />
          空き {free}
          <small>/{snapshot.meta.ticketCount}</small>
        </span>
      </div>
      <div className="handoff-feedback" role="status">
        {completedOrder && lastHandoff && (
          <>
            <span>札 {completedOrder.ticket} を受け渡し済みにしました。</span>
            <Button
              variant="plain"
              type="button"
              className="link-button"
              disabled={
                !canUndoHandoff(
                  completedOrder,
                  lastHandoff.completionId,
                  snapshot,
                )
              }
              onClick={() =>
                void perform(async () => {
                  await saveCommand({
                    type: 'undoHandoff',
                    orderId: completedOrder.id,
                    assignmentId: completedOrder.assignmentId,
                    completionId: lastHandoff.completionId,
                  });
                  onHandoffChange(null);
                })
              }
            >
              元に戻す
            </Button>
          </>
        )}
      </div>
      {waiting.length > 0 && (
        <div
          className="waiting-totals"
          title="調理済み分を含む、未受け渡しの本数"
        >
          {products.map((p) => (
            <span key={p.id}>
              {p.name}
              <strong>
                {waiting.reduce((n, o) => n + (o.quantities[p.id] ?? 0), 0)}
              </strong>
              <small>本</small>
            </span>
          ))}
        </div>
      )}
      {!waiting.length && (
        <div className="empty">
          <img
            src="/assets/empty-orders.png"
            alt=""
            width="1536"
            height="1024"
          />
          <h3>待っている注文はありません</h3>
        </div>
      )}
      <div className="waiting-list">
        {waiting.map((order) => (
          <article
            className="order-card"
            key={order.id}
            data-testid="waiting-order"
          >
            <span className="ticket-badge">
              <small>札</small>
              <strong>{order.ticket}</strong>
            </span>
            <div className="order-content">
              <div className="order-quantities">
                {orderItems(order).map((item) => (
                  <span key={item.id}>
                    {item.name}
                    <strong>
                      {item.quantity}
                      <small>本</small>
                    </strong>
                  </span>
                ))}
              </div>
            </div>
            <time>
              {order.day !== snapshot.meta.day
                ? dayText(order.day)
                : timeText(order.createdAt)}
            </time>
            <IconButton
              variant="plain"
              type="button"
              className="icon-button complete-button"
              onClick={() => completeHandoff(order)}
              label="受け渡し完了（札も回収）"
              icon="check"
            />
          </article>
        ))}
      </div>
      {unreturned.length > 0 && (
        <section className="unreturned" data-testid="unreturned">
          <h3>
            札の回収待ち<span className="count-badge">{unreturned.length}</span>
          </h3>
          {unreturned.map((order) => (
            <div key={order.id}>
              <strong>札 {order.ticket}</strong>
              <span>
                {order.status === 'cancelled' ? '取消済み' : '受け渡し済み'}
              </span>
              <IconButton
                variant="plain"
                type="button"
                className="icon-button secondary"
                onClick={() => recoverTicket(order)}
                label="札を回収した"
                icon="ticket"
              />
            </div>
          ))}
        </section>
      )}
    </aside>
  );
}
