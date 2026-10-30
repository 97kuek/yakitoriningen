import { products } from '../domain/model';

import type { Order, Snapshot } from '../domain/model';
import type { Shared } from '../ui';
import { Icon } from './Icon';
export function Waiting({
  snapshot,
  perform,
  saveCommand,
}: Shared & { snapshot: Snapshot }) {
  const waiting = snapshot.orders
    .filter((o) => o.status === 'paid' && !o.delivered)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const unreturned = snapshot.orders.filter(
    (o) => !o.returned && (o.delivered || o.status === 'cancelled'),
  );
  const free = snapshot.tickets.filter((t) => t.orderId === null).length;
  function action(order: Order, type: 'complete' | 'return') {
    void perform(() =>
      saveCommand({
        type,
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
      {waiting.length > 0 && (
        <div
          className="waiting-totals"
          title="調理済み分を含む、未受け渡しの本数"
        >
          {products.map((p) => (
            <span key={p.id}>
              {p.name}
              <strong>
                {waiting.reduce((n, o) => n + o.quantities[p.id], 0)}
              </strong>
              <small>本</small>
            </span>
          ))}
        </div>
      )}
      {!waiting.length && (
        <div className="empty">
          <Icon name="tray" className="empty-icon" />
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
                {products
                  .filter((p) => order.quantities[p.id])
                  .map((p) => (
                    <span key={p.id}>
                      {p.name}
                      <strong>
                        {order.quantities[p.id]}
                        <small>本</small>
                      </strong>
                    </span>
                  ))}
              </div>
            </div>
            <time>
              {order.day !== snapshot.meta.day
                ? order.day.slice(5).replace('-', '/')
                : new Date(order.createdAt).toLocaleTimeString('ja-JP', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
            </time>
            <button
              className="icon-button complete-button"
              aria-label="受け渡し完了（札も回収）"
              title="受け渡し完了（札も回収）"
              onClick={() => action(order, 'complete')}
            >
              <Icon name="check" />
            </button>
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
              <button
                className="icon-button secondary"
                aria-label="札を回収した"
                title="札を回収した"
                onClick={() => action(order, 'return')}
              >
                <Icon name="ticket" />
              </button>
            </div>
          ))}
        </section>
      )}
    </aside>
  );
}
