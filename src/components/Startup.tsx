import { useState } from 'react';
import { today, yen } from '../presentation/format';
import { normalPrice, type Snapshot } from '../domain/model';
import { menuForm, menuPrice, menuStock } from '../presentation/menu-form';
import { newId } from '../lib/id';
import { MenuFields } from './MenuFields';
import {
  DEFAULT_TICKET_COUNT,
  MAX_EVENT_NAME_LENGTH,
  MAX_TICKETS,
} from '../domain/constants';
import { pendingOrders, unresolvedOperations } from '../domain/snapshot';
import type { ActionHandler } from '../ui';
import { commandNames } from '../ui';
import type { Cashier } from '../application/ports';
import { Button, Dialog, InlineError } from './controls';
import { DataPanel } from './DataPanel';
import { Icon } from './Icon';
import { eventNameExample } from '../presentation/festival';
export function Startup({
  snapshot,
  store,
  perform,
  onStart,
  onRestart,
  errorMessage,
}: {
  snapshot: Snapshot | null;
  store: Cashier;
  perform: ActionHandler;
  onStart: () => void;
  onRestart: () => void;
  errorMessage: string;
}) {
  const [event, setEvent] = useState('');
  const [day, setDay] = useState(today());
  const [setupOpen, setSetupOpen] = useState(!snapshot);
  const [menu, setMenu] = useState(() => menuForm(normalPrice(newId())));
  const [tickets, setTickets] = useState(DEFAULT_TICKET_COUNT);
  const reserved = snapshot ? pendingOrders(snapshot) : [];
  const pendingOperations = snapshot ? unresolvedOperations(snapshot) : [];
  return (
    <div className="startup-shell">
      <aside className="startup-art">
        <img
          src="/assets/welcome-stall.webp"
          alt="ひよこたちが営む焼き鳥の屋台"
          width="1200"
          height="800"
        />
      </aside>
      <section className="startup panel">
        {snapshot ? (
          <>
            <h2>保存されている記録から再開</h2>
            <div className="startup-record">
              <p className="startup-event">{snapshot.meta.event}</p>
              <time dateTime={snapshot.meta.day}>{snapshot.meta.day}</time>
            </div>
            {(reserved.length > 0 || pendingOperations.length > 0) && (
              <section
                className="startup-pending notice"
                aria-labelledby="startup-pending-heading"
              >
                <h3 id="startup-pending-heading">確認が必要な会計</h3>
                <p>現金と札を確認し、二度受け取らないでください。</p>
                {reserved.length > 0 && (
                  <>
                    <p>途中の会計 {reserved.length}件</p>
                    <ul>
                      {reserved.map((order) => (
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
                今日と違う日付です。別の日は「別の日の営業を準備」から。
              </p>
            )}
            <Button
              variant="primary"
              type="button"
              className="primary wide"
              onClick={onStart}
            >
              会計を始める
              <Icon name="arrow" />
            </Button>
          </>
        ) : (
          <>
            <h2>営業の準備</h2>
            <Button
              variant="primary"
              className="wide"
              onClick={() => setSetupOpen(true)}
            >
              営業を準備
            </Button>
            <Dialog
              open={setupOpen}
              onClose={() => setSetupOpen(false)}
              title="営業の準備"
              className="day-setup-dialog"
            >
              <InlineError message={errorMessage} />
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void perform(() =>
                    store.initialize(event, day, tickets, {
                      price: menuPrice(menu),
                      stock: menuStock(menu),
                    }),
                  );
                }}
              >
                <label>
                  営業名
                  <input
                    value={event}
                    required
                    maxLength={MAX_EVENT_NAME_LENGTH}
                    placeholder={eventNameExample()}
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
                      max={MAX_TICKETS}
                      required
                      value={tickets}
                      onChange={(e) => setTickets(Number(e.target.value))}
                    />
                  </label>
                </div>
                <div className="menu-pricing-settings">
                  <MenuFields draft={menu} onChange={setMenu} />
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
            </Dialog>
            <p className="hint">
              営業の続きは、下の「バックアップから復元」から。
            </p>
          </>
        )}
        <DataPanel
          snapshot={snapshot}
          store={store}
          perform={perform}
          errorMessage={errorMessage}
          onRestart={onRestart}
        />
      </section>
    </div>
  );
}
