import { useRef, useState } from 'react';
import { dayText, orderText, timeText, yen } from '../presentation/format';
import { historyPage, type HistorySort } from '../domain/history';
import { Button, Dialog, IconButton, Select } from './controls';
import { RefundDialog } from './RefundDialog';
import { OrderDetails, receiptNumber } from './OrderDetails';

import type { Order, Snapshot } from '../domain/model';
import type { Shared } from '../ui';
import { Icon } from './Icon';
import type { Cashier } from '../application/ports';
export function History({
  snapshot,
  perform,
  context,
  errorMessage,
  store,
  busy,
  saveCommand,
}: Shared & {
  snapshot: Snapshot;
  store: Cashier;
}) {
  const [scope, setScope] = useState(snapshot.meta.day);
  const [cancel, setCancel] = useState<Order | null>(null);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const detailsTrigger = useRef<HTMLButtonElement | null>(null);
  const [ticketSearch, setTicketSearch] = useState('');
  const [waitingOnly, setWaitingOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState<HistorySort>('time');
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc');
  function sortBy(key: HistorySort) {
    setDirection(sort === key && direction === 'asc' ? 'desc' : 'asc');
    setSort(key);
    setPage(0);
  }
  function sortHeading(key: HistorySort, label: string) {
    return (
      <th
        aria-sort={
          sort === key
            ? direction === 'asc'
              ? 'ascending'
              : 'descending'
            : 'none'
        }
      >
        <Button variant="plain" onClick={() => sortBy(key)}>
          {label}
          <Icon
            name={sort === key ? (direction === 'asc' ? 'up' : 'down') : 'sort'}
          />
        </Button>
      </th>
    );
  }
  const days = [
    ...new Set([
      snapshot.meta.day,
      ...snapshot.orders.map((order) => order.day),
      ...snapshot.operations.flatMap((operation) =>
        operation.status === 'done' && operation.command.type === 'day'
          ? [operation.day, operation.command.day]
          : [],
      ),
    ]),
  ].sort();
  const orders = snapshot.orders.filter(
    (order) => scope === 'event' || order.day === scope,
  );
  const history = historyPage(orders, ticketSearch, waitingOnly, page, 50, {
    from,
    to,
    sort,
    direction,
  });
  const details = snapshot.orders.find((order) => order.id === detailsId);
  return (
    <section className="panel history">
      <div className="section-heading">
        <h2>
          <Icon name="chart" />
          注文履歴
        </h2>
      </div>
      <div className="history-filters">
        <Select
          value={scope}
          label="表示する日"
          onChange={(value) => {
            setScope(value);
            setPage(0);
          }}
          options={[
            { value: 'event', label: 'すべて' },
            ...days.map((day, index) => ({
              value: day,
              label:
                days.length <= 2
                  ? `${index + 1}日目（${dayText(day)}）`
                  : dayText(day),
            })),
          ]}
        />

        <label>
          札番号で検索
          <input
            type="search"
            inputMode="numeric"
            maxLength={3}
            value={ticketSearch}
            placeholder="札番号"
            onChange={(event) => {
              setTicketSearch(event.target.value);
              setPage(0);
            }}
          />
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={waitingOnly}
            onChange={(event) => {
              setWaitingOnly(event.target.checked);
              setPage(0);
            }}
          />
          未受け渡しだけ表示
        </label>
      </div>
      <div className="history-time-filter">
        <span>時間帯</span>
        <input
          type="time"
          aria-label="開始時刻"
          value={from}
          onChange={(event) => {
            setFrom(event.target.value);
            setPage(0);
          }}
        />
        <span>〜</span>
        <input
          type="time"
          aria-label="終了時刻"
          value={to}
          onChange={(event) => {
            setTo(event.target.value);
            setPage(0);
          }}
        />
        {(from || to) && (
          <IconButton
            icon="close"
            label="時間帯をクリア"
            onClick={() => {
              setFrom('');
              setTo('');
              setPage(0);
            }}
          />
        )}
        {from && to && from > to && (
          <span role="alert">終了時刻は開始時刻以降にしてください。</span>
        )}
      </div>
      <div className="table-scroll">
        <table>
          <caption className="sr-only">注文履歴</caption>
          <thead>
            <tr>
              {sortHeading('time', scope === 'event' ? '日時' : '時刻')}
              <th>会計番号</th>
              {sortHeading('ticket', '札')}
              <th>内容</th>
              {sortHeading('amount', '会計額')}
              <th>状態</th>
              <th>
                <span className="sr-only">詳細・返金</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {history.orders.map((o) => (
              <tr key={o.id}>
                <td className="history-time">
                  {scope === 'event' && <span>{dayText(o.day)} </span>}
                  {timeText(o.createdAt)}
                </td>
                <td className="history-receipt-number">
                  {receiptNumber(o, snapshot).replace('会計 ', '')}
                </td>
                <td>{o.ticket}</td>
                <td>{orderText(o)}</td>
                <td>
                  {yen(o.quote.total)}
                  {o.refunded > 0 && <small>返金 {yen(o.refunded)}</small>}
                </td>
                <td>
                  <span className={`state-label${o.delivered ? ' done' : ''}`}>
                    {o.delivered && o.status === 'paid' && (
                      <Icon name="check" />
                    )}
                    {o.status === 'pending'
                      ? '保留'
                      : o.status === 'cancelled'
                        ? '取消済み'
                        : o.delivered
                          ? '完了'
                          : '受け渡し待ち'}
                  </span>
                  <small>
                    {o.cancelReason ??
                      (!o.returned && o.delivered ? '札未回収' : null)}
                  </small>
                </td>
                <td>
                  <div className="history-order-actions">
                    <Button
                      variant="plain"
                      aria-label="注文の詳細"
                      onClick={(event) => {
                        detailsTrigger.current = event.currentTarget;
                        setDetailsId(o.id);
                      }}
                    >
                      詳細
                    </Button>
                    {o.status === 'paid' && (
                      <Button
                        variant="secondary"
                        type="button"
                        className="secondary danger-text"
                        onClick={() => {
                          detailsTrigger.current = null;
                          setCancel(o);
                        }}
                      >
                        全額返金
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!history.total && (
          <p className="empty-text">条件に合う注文はありません。</p>
        )}
      </div>
      <div className="history-pagination">
        <span>
          {history.total
            ? `${history.page * 50 + 1}〜${Math.min((history.page + 1) * 50, history.total)}件 / ${history.total}件`
            : '0件'}
        </span>
        <div>
          <IconButton
            icon="left"
            label="前のページ"
            disabled={history.page === 0}
            onClick={() => setPage(history.page - 1)}
          />
          <IconButton
            icon="right"
            label="次のページ"
            disabled={history.page + 1 >= history.pages}
            onClick={() => setPage(history.page + 1)}
          />
        </div>
      </div>
      {details && (
        <Dialog
          open
          title="注文の詳細"
          onClose={() => setDetailsId(null)}
          footer={
            <>
              <Button onClick={() => setDetailsId(null)}>閉じる</Button>
              {details.status === 'paid' && (
                <Button
                  variant="secondary"
                  className="danger-text"
                  onClick={() => {
                    setDetailsId(null);
                    setCancel(details);
                  }}
                >
                  全額返金
                </Button>
              )}
            </>
          }
        >
          <OrderDetails order={details} snapshot={snapshot} />
        </Dialog>
      )}
      {cancel && (
        <RefundDialog
          key={cancel.id}
          order={snapshot.orders.find((order) => order.id === cancel.id)!}
          snapshot={snapshot}
          store={store}
          onClose={() => {
            setCancel(null);
            requestAnimationFrame(() => {
              if (detailsTrigger.current?.isConnected)
                detailsTrigger.current.focus();
            });
          }}
          perform={perform}
          context={context}
          errorMessage={errorMessage}
          busy={busy}
          saveCommand={saveCommand}
        />
      )}
    </section>
  );
}
