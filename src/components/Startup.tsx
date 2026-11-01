import { useState } from 'react';
import { today, yen } from '../presentation/format';

import type { Snapshot } from '../domain/model';
import type { ActionHandler } from '../ui';
import { commandNames } from '../ui';
import type { Cashier } from '../application/ports';
import { Button } from './controls';
import { getMenu, getUnitPrice } from '../domain/catalog';
import { DataPanel } from './DataPanel';
import { Icon } from './Icon';
export function Startup({
  snapshot,
  store,
  perform,
  onStart,
  onRestored,
  onVerified,
  errorMessage,
}: {
  snapshot: Snapshot | null;
  store: Cashier;
  perform: ActionHandler;
  onStart: () => void;
  onRestored: () => void;
  onVerified: (s: Snapshot) => void;
  errorMessage: string;
}) {
  const [event, setEvent] = useState('');
  const [day, setDay] = useState(today());
  const [tickets, setTickets] = useState(20);
  const [confirmed, setConfirmed] = useState(false);
  const price = snapshot?.prices.find(
    (p) => p.id === snapshot.meta.activePriceId,
  );
  const pendingOrders =
    snapshot?.orders.filter((o) => o.status === 'pending') ?? [];
  const pendingOperations =
    snapshot?.operations.filter((operation) => {
      if (operation.status !== 'pending') return false;
      const command = operation.command;
      return !(
        command.type === 'pay' &&
        pendingOrders.some(
          (order) =>
            order.confirmOperationId === operation.id &&
            order.id === command.orderId &&
            order.assignmentId === command.assignmentId,
        )
      );
    }) ?? [];
  return (
    <div className="startup-shell">
      <aside className="startup-art">
        <img
          src="/assets/welcome-stall.png"
          alt="ひよこたちが営む焼き鳥の屋台"
          width="1536"
          height="1024"
        />
      </aside>
      <section className="startup panel">
        {snapshot && price ? (
          <>
            <h2>会計を始める前に</h2>
            <p className="startup-event">{snapshot.meta.event}</p>
            <dl className="startup-details">
              <dt>日付</dt>
              <dd>{snapshot.meta.day}</dd>
              <dt>価格</dt>
              <dd>
                {getMenu(price).map((item) => (
                  <span className="startup-menu-price" key={item.id}>
                    {item.name} {yen(getUnitPrice(item, price))}
                  </span>
                ))}
                {price.bundleEnabled &&
                  (!price.discounted || price.bundleDuringDiscount) && (
                    <small>
                      対象商品 {price.bundleSize}本 {yen(price.bundlePrice)}
                    </small>
                  )}
              </dd>
            </dl>
            {(pendingOrders.length > 0 || pendingOperations.length > 0) && (
              <section
                className="startup-pending notice"
                aria-labelledby="startup-pending-heading"
              >
                <h3 id="startup-pending-heading">確認が必要な会計</h3>
                <p>現金と札を確認し、二度受け取らないでください。</p>
                {pendingOrders.length > 0 && (
                  <>
                    <p>途中の会計 {pendingOrders.length}件</p>
                    <ul>
                      {pendingOrders.map((order) => (
                        <li key={order.id}>
                          札 {order.ticket} / {yen(order.quote.total)}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {pendingOperations.length > 0 && (
                  <>
                    <p>結果の確認待ち {pendingOperations.length}件</p>
                    <ul>
                      {pendingOperations.map((operation) => {
                        const command = operation.command;
                        const order =
                          'orderId' in command
                            ? snapshot.orders.find(
                                (order) => order.id === command.orderId,
                              )
                            : null;
                        return (
                          <li key={operation.id}>
                            {commandNames[command.type]}
                            {order &&
                              ` / 札 ${order.ticket} / ${yen(order.quote.total)}`}
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
                <p>会計を始めたら、画面の案内に沿って確認してください。</p>
              </section>
            )}
            {snapshot.meta.day !== today() && (
              <p className="hint">
                今日と違う日付です。必要なら設定で変更してください。
              </p>
            )}
            <label className="checkbox">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              日付・価格を確認した
            </label>
            <Button
              variant="primary"
              type="button"
              className="primary wide"
              disabled={!confirmed}
              onClick={onStart}
            >
              会計を始める
              <Icon name="arrow" />
            </Button>
          </>
        ) : (
          <>
            <h2>営業の準備</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void perform(() => store.initialize(event, day, tickets));
              }}
            >
              <label>
                開催回
                <input
                  value={event}
                  required
                  maxLength={80}
                  placeholder="例：早稲田祭 2026"
                  onChange={(e) => setEvent(e.target.value)}
                />
              </label>
              <div className="form-row">
                <label>
                  営業日
                  <input
                    type="date"
                    required
                    value={day}
                    onChange={(e) => setDay(e.target.value)}
                  />
                </label>
                <label>
                  番号札の枚数
                  <input
                    type="number"
                    min="1"
                    max="100"
                    required
                    value={tickets}
                    onChange={(e) => setTickets(Number(e.target.value))}
                  />
                </label>
              </div>
              <Button
                variant="primary"
                type="submit"
                className="primary wide"
                disabled={!event.trim()}
              >
                新しく作る
                <Icon name="arrow" />
              </Button>
            </form>
            <p className="hint">
              営業の続きは、下の「保存した記録を開く」から。
            </p>
          </>
        )}
        <DataPanel
          snapshot={snapshot}
          store={store}
          perform={perform}
          errorMessage={errorMessage}
          onRestored={onRestored}
          onVerified={onVerified}
        />
      </section>
    </div>
  );
}
