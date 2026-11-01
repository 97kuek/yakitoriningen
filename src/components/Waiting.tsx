import { useRef, useState } from 'react';
import { IconButton, Button, Dialog } from './controls';
import { handoffUndoError, needsTicketReturn } from '../domain/handoff';
import { newId } from '../lib/id';
import { orderItems, timeText, dayText } from '../presentation/format';

import type { Order, Snapshot } from '../domain/model';
import type { Shared } from '../ui';
import { Icon } from './Icon';
import './Waiting.css';
export function Waiting({
  snapshot,
  perform,
  saveCommand,
  busy,
  errorMessage,
  lastHandoff,
  onHandoffChange,
}: Shared & {
  snapshot: Snapshot;
  lastHandoff: { orderId: string; completionId: string } | null;
  onHandoffChange: (
    value: { orderId: string; completionId: string } | null,
  ) => void;
}) {
  const [ticketSearch, setTicketSearch] = useState('');
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [undoNotice, setUndoNotice] = useState('');
  const [heldRecoveryIds, setHeldRecoveryIds] = useState<string[]>([]);
  // Keep every completed row until the operator explicitly clears it. Removing
  // it on a timer would let a later click reach another order at that position.
  const [heldOrderIds, setHeldOrderIds] = useState<string[]>([]);
  const completing = useRef(false);
  const returnOperationIds = useRef(new Map<string, string>());
  const waiting = snapshot.orders
    .filter((o) => o.status === 'paid' && !o.delivered)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const unreturnedOrders = snapshot.orders.filter(needsTicketReturn);
  const returnRows = snapshot.orders.filter(
    (order) => needsTicketReturn(order) || heldRecoveryIds.includes(order.id),
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
  const undoError =
    completedOrder && lastHandoff
      ? handoffUndoError(
          completedOrder,
          lastHandoff.completionId,
          snapshot,
          snapshot.tickets.find(
            (ticket) => ticket.number === completedOrder.ticket,
          ),
        )
      : null;
  const heldOrders = snapshot.orders.filter(
    (order) => heldOrderIds.includes(order.id) && order.delivered,
  );
  const visibleOrders = snapshot.orders
    .filter(
      (order) =>
        order.status === 'paid' &&
        (!order.delivered || heldOrderIds.includes(order.id)) &&
        (!ticketSearch.trim() ||
          (/^\d+$/.test(ticketSearch.trim()) &&
            order.ticket === Number(ticketSearch))),
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  function completeHandoff(order: Order) {
    if (busy || completing.current || order.delivered) return;
    void perform(async () => {
      if (completing.current) return;
      completing.current = true;
      // Retain the position before the committed subscription can update.
      // The row only changes to completed when the saved snapshot says so.
      setHeldOrderIds((ids) =>
        ids.includes(order.id) ? ids : [...ids, order.id],
      );
      const completionId = newId();
      try {
        await saveCommand(
          {
            type: 'complete',
            orderId: order.id,
            assignmentId: order.assignmentId,
          },
          completionId,
        );
        onHandoffChange({ orderId: order.id, completionId });
      } finally {
        completing.current = false;
      }
    });
  }
  function recoverTicket(order: Order) {
    void perform(async () => {
      const operationId = returnOperationIds.current.get(order.id) ?? newId();
      returnOperationIds.current.set(order.id, operationId);
      setHeldRecoveryIds((ids) =>
        ids.includes(order.id) ? ids : [...ids, order.id],
      );
      await saveCommand(
        {
          type: 'return',
          orderId: order.id,
          assignmentId: order.assignmentId,
        },
        operationId,
      );
      returnOperationIds.current.delete(order.id);
    });
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
      <div className="waiting-tools">
        <label>
          <span className="sr-only">待ち注文の札番号</span>
          <input
            type="search"
            inputMode="numeric"
            maxLength={3}
            placeholder="例：1"
            value={ticketSearch}
            onChange={(event) => setTicketSearch(event.target.value)}
          />
        </label>
        <div className="waiting-actions">
          <div className="waiting-recovery-slot">
            {unreturnedOrders.length > 0 && (
              <Button
                variant="plain"
                className="waiting-recovery-button"
                title={`札の回収待ち ${unreturnedOrders.length}`}
                aria-label={`札の回収待ち ${unreturnedOrders.length}`}
                onClick={() => setRecoveryOpen(true)}
              >
                <Icon name="ticket" />
                <span>{unreturnedOrders.length}</span>
              </Button>
            )}
          </div>
          <span className="waiting-undo-slot" title={undoError ?? ''}>
            {completedOrder && lastHandoff && (
              <IconButton
                icon="reset"
                label="元に戻す"
                disabled={busy}
                aria-describedby={undoError ? 'undo-reason' : undefined}
                onClick={() => {
                  if (undoError) {
                    setUndoNotice(undoError);
                    return;
                  }
                  void perform(async () => {
                    await saveCommand({
                      type: 'undoHandoff',
                      orderId: completedOrder.id,
                      assignmentId: completedOrder.assignmentId,
                      completionId: lastHandoff.completionId,
                    });
                    setHeldOrderIds((ids) =>
                      ids.filter((id) => id !== completedOrder.id),
                    );
                    onHandoffChange(null);
                  });
                }}
              />
            )}
            {undoError && (
              <span id="undo-reason" className="sr-only">
                {undoError}
              </span>
            )}
          </span>
          <IconButton
            icon="refresh"
            label="完了表示を片づける"
            disabled={!heldOrders.length || busy}
            onClick={() => setHeldOrderIds([])}
          />
        </div>
      </div>
      {(waiting.length > 0 || heldOrders.length > 0) && (
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
      {!waiting.length && !heldOrders.length && !ticketSearch && (
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
        {visibleOrders.map((order) => (
          <article
            className={`order-card${order.delivered ? ' handoff-completed' : ''}`}
            key={order.id}
            data-testid={
              order.delivered ? 'completed-handoff' : 'waiting-order'
            }
          >
            <span className="ticket-badge">
              <strong aria-label={`札 ${order.ticket}`}>{order.ticket}</strong>
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
              {order.delivered && (
                <small className="handoff-completed-note">
                  完了・札回収済み
                </small>
              )}
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
              disabled={busy || order.delivered}
              onKeyDown={(event) => {
                if (
                  event.repeat &&
                  (event.key === 'Enter' || event.key === ' ')
                )
                  event.preventDefault();
              }}
              onClick={(event) => {
                if (event.detail > 1) return;
                completeHandoff(order);
              }}
              label={
                order.delivered
                  ? '受け渡し済み（札も回収済み）'
                  : '受け渡し完了（札も回収）'
              }
              icon="check"
            />
          </article>
        ))}
        {ticketSearch && !visibleOrders.length && (
          <p className="empty-text">この札の待ち注文はありません。</p>
        )}
      </div>
      {undoNotice && (
        <Dialog open title="元に戻せません" onClose={() => setUndoNotice('')}>
          <p>{undoNotice}</p>
        </Dialog>
      )}
      {recoveryOpen && (
        <Dialog
          open
          title="札の回収待ち"
          onClose={() => {
            if (!busy) {
              setRecoveryOpen(false);
              setHeldRecoveryIds([]);
            }
          }}
          footer={
            <Button
              disabled={busy}
              onClick={() => {
                setRecoveryOpen(false);
                setHeldRecoveryIds([]);
              }}
            >
              閉じる
            </Button>
          }
        >
          {errorMessage && (
            <p className="inline-error" role="alert">
              {errorMessage}
            </p>
          )}
          <div className="ticket-recovery-list" data-testid="unreturned">
            {returnRows.map((order) => (
              <div key={order.id}>
                <strong>札 {order.ticket}</strong>
                <span>
                  {order.returned
                    ? '回収済み'
                    : order.status === 'cancelled'
                      ? '取消済み'
                      : '受け渡し済み'}
                </span>
                <Button
                  variant="secondary"
                  type="button"
                  disabled={busy || order.returned}
                  aria-label={`札${order.ticket}を回収した`}
                  onKeyDown={(event) => {
                    if (
                      event.repeat &&
                      (event.key === 'Enter' || event.key === ' ')
                    )
                      event.preventDefault();
                  }}
                  onClick={(event) => {
                    if (event.detail <= 1) recoverTicket(order);
                  }}
                >
                  回収
                </Button>
              </div>
            ))}
          </div>
        </Dialog>
      )}
    </aside>
  );
}
