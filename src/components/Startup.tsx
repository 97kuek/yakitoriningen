import { useState } from 'react';
import { today, yen } from '../presentation/format';

import type { Snapshot } from '../domain/model';
import type { ActionHandler } from '../ui';
import type { Cashier } from '../application/ports';
import { Button, Disclosure } from './controls';
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
  const last = snapshot
    ? [...snapshot.orders].sort((a, b) =>
        (b.paidAt ?? b.createdAt).localeCompare(a.paidAt ?? a.createdAt),
      )[0]
    : null;
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
            <h2>営業前チェック</h2>
            <p className="startup-event">{snapshot.meta.event}</p>
            <dl className="startup-details">
              <dt>営業日</dt>
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
              <dt>会計記録</dt>
              <dd>
                確定済み{' '}
                {snapshot.orders.filter((o) => o.received !== null).length}件
                <small>
                  保留会計{' '}
                  {snapshot.orders.filter((o) => o.status === 'pending').length}
                  件
                </small>
              </dd>
              <dt>使用中の札</dt>
              <dd>
                {snapshot.tickets.filter((t) => t.orderId !== null).length}
                <small className="inline-small">
                  {' '}
                  / {snapshot.meta.ticketCount}枚
                </small>
              </dd>
            </dl>
            <Disclosure className="saved-details" title="直近の記録・確認待ち">
              <p>
                {last
                  ? `直近：札 ${last.ticket} / ${yen(last.quote.total)} / ${last.day}`
                  : '注文はまだありません。'}
              </p>
              <p>
                照合待ち{' '}
                {
                  snapshot.operations.filter((op) => op.status === 'pending')
                    .length
                }
                件
              </p>
            </Disclosure>
            {snapshot.meta.day !== today() && (
              <p className="hint">営業日が今日と異なります。変更は設定から。</p>
            )}
            <label className="checkbox">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              価格・営業日・保存件数を確認しました
            </label>
            <Button
              variant="primary"
              type="button"
              className="primary wide"
              disabled={!confirmed}
              onClick={onStart}
            >
              営業を始める
              <Icon name="arrow" />
            </Button>
          </>
        ) : (
          <>
            <h2>営業の準備</h2>
            <p className="muted">初めて使うPCに営業データを作成します。</p>
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
                データを作成
                <Icon name="arrow" />
              </Button>
            </form>
            <p className="hint">
              営業の続きなら、新規作成せずバックアップを復元してください。
            </p>
          </>
        )}
        <Disclosure
          className="startup-restore"
          title="バックアップから引き継ぐ"
        >
          <DataPanel
            snapshot={snapshot}
            store={store}
            perform={perform}
            errorMessage={errorMessage}
            onRestored={onRestored}
            onVerified={onVerified}
          />
        </Disclosure>
      </section>
    </div>
  );
}
