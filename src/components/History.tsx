import { useRef, useState } from 'react';
import './History.css';
import { dayText, orderText, timeText, yen } from '../presentation/format';
import { festivalDays, hourOptions } from '../presentation/festival';
import { ordersCsv } from '../application/backup';
import { download } from '../presentation/download';
import {
  historyPage,
  type HistoryState,
  type HistorySort,
} from '../domain/history';
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
  const [state, setState] = useState<HistoryState>('all');
  const [page, setPage] = useState(0);
  const [hour, setHour] = useState('');
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
  const days = festivalDays(snapshot);
  const orders = snapshot.orders.filter(
    (order) => scope === 'event' || order.day === scope,
  );
  const filters = {
    from: hour ? `${hour}:00` : '',
    to: hour ? `${hour}:59` : '',
    sort,
    direction,
  };
  const history = historyPage(orders, ticketSearch, state, page, 50, filters);
  const details = snapshot.orders.find((order) => order.id === detailsId);
  return (
    <section className="panel history">
      <div className="section-heading">
        <h2>注文履歴</h2>
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
            ...days.map((day) => ({
              value: day,
              label: dayText(day),
            })),
          ]}
        />

        <Select
          value={hour}
          label="時間帯"
          className="history-hour"
          options={hourOptions}
          onChange={(value) => {
            setHour(value);
            setPage(0);
          }}
        />

        <label>
          <span className="sr-only">札番号で検索</span>
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
        <Select
          value={state}
          label="注文の状態"
          className="history-state"
          options={[
            { value: 'all', label: 'すべての状態' },
            { value: 'waiting', label: '未完了' },
            { value: 'complete', label: '完了' },
            { value: 'cancelled', label: '取消' },
          ]}
          onChange={(value) => {
            setState(value as HistoryState);
            setPage(0);
          }}
        />
        <IconButton
          className="history-export"
          icon="download"
          label="表示条件の注文をCSVで保存"
          disabled={busy || history.total === 0}
          onClick={() => {
            const matching = historyPage(
              orders,
              ticketSearch,
              state,
              0,
              Math.max(1, orders.length),
              filters,
            );
            download(
              ordersCsv({ ...snapshot, orders: matching.orders }),
              `焼き鳥人間_注文履歴_${scope === 'event' ? '全日' : scope}${hour ? `_${hour}時台` : ''}.csv`,
              'text/csv;charset=utf-8',
            );
          }}
        />
      </div>
      <div className="table-scroll">
        <table>
          <caption className="sr-only">注文履歴</caption>
          <thead>
            <tr>
              <th>会計番号</th>
              {sortHeading('time', scope === 'event' ? '日時' : '時刻')}
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
                <td className="history-receipt-number">
                  {receiptNumber(o, snapshot).replace('会計 ', '')}
                </td>
                <td className="history-time">
                  {scope === 'event' && <span>{dayText(o.day)} </span>}
                  {timeText(o.createdAt)}
                </td>
                <td>{o.ticket}</td>
                <td>{orderText(o)}</td>
                <td>
                  {yen(o.quote.total)}
                  {o.refunded > 0 && <small>返金 {yen(o.refunded)}</small>}
                </td>
                <td>
                  <span className={`state-label${o.delivered ? ' done' : ''}`}>
                    {o.status === 'cancelled'
                      ? '取消'
                      : o.status === 'paid' && o.delivered
                        ? '完了'
                        : '未完了'}
                  </span>
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
