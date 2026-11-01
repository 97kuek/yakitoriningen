import { useRef, useState } from 'react';
import './History.css';
import { dayText, orderText, timeText, yen } from '../presentation/format';
import { festivalDays, timeSlotOptions } from '../presentation/festival';
import { TIME_SLOT_MINUTES } from '../domain/constants';
import { clockText } from '../domain/time';
import { ordersCsv } from '../presentation/orders-csv';
import { download } from '../presentation/download';
import { historyStateLabel, receiptNumber } from '../presentation/order';
import {
  filterHistory,
  historyPage,
  TICKET_SEARCH_MAX_LENGTH,
  type HistoryState,
  type HistorySort,
  type SortDirection,
} from '../domain/history';
import { Button, Dialog, IconButton, Select } from './controls';
import { RefundDialog } from './RefundDialog';
import { OrderDetails } from './OrderDetails';
import type { Order, Snapshot } from '../domain/model';
import type { Shared } from '../ui';
import { Icon } from './Icon';
import type { Cashier } from '../application/ports';

/** Scope value that shows every business day. */
const ALL_DAYS = 'event';

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
  const [slot, setSlot] = useState('');
  const [sort, setSort] = useState<HistorySort>('time');
  const [direction, setDirection] = useState<SortDirection>('desc');
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
  const allDays = scope === ALL_DAYS;
  const orders = snapshot.orders.filter(
    (order) => allDays || order.day === scope,
  );
  const slotStart = slot ? Number(slot) : undefined;
  const filters = {
    from: slotStart,
    to: slotStart === undefined ? undefined : slotStart + TIME_SLOT_MINUTES,
    sort,
    direction,
  };
  const slotName =
    slotStart === undefined
      ? ''
      : `_${clockText(slotStart).replace(':', '')}-${clockText(slotStart + TIME_SLOT_MINUTES).replace(':', '')}`;
  const history = historyPage(
    orders,
    ticketSearch,
    state,
    page,
    undefined,
    filters,
  );
  const firstShown = history.page * history.size + 1;
  const lastShown = Math.min((history.page + 1) * history.size, history.total);
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
            { value: ALL_DAYS, label: 'すべて' },
            ...days.map((day) => ({
              value: day,
              label: dayText(day),
            })),
          ]}
        />

        <Select
          value={slot}
          label="時間帯"
          className="history-hour"
          options={timeSlotOptions}
          onChange={(value) => {
            setSlot(value);
            setPage(0);
          }}
        />

        <label>
          <span className="sr-only">札番号で検索</span>
          <input
            type="search"
            inputMode="numeric"
            maxLength={TICKET_SEARCH_MAX_LENGTH}
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
            download(
              ordersCsv({
                prices: snapshot.prices,
                orders: filterHistory(orders, ticketSearch, state, filters),
              }),
              `焼き鳥人間_注文履歴_${allDays ? '全日' : scope}${slotName}.csv`,
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
              {sortHeading('time', allDays ? '日時' : '時刻')}
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
                  {receiptNumber(o, snapshot) ?? '会計未確定'}
                </td>
                <td className="history-time">
                  {allDays && <span>{dayText(o.day)} </span>}
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
                    {historyStateLabel(o)}
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
          <div className="history-empty">
            <img
              src="/assets/history-empty.webp"
              alt=""
              width="150"
              height="125"
            />
            <p>条件に合う注文はありません。</p>
          </div>
        )}
      </div>
      <div className="history-pagination">
        <span>
          {history.total
            ? `${firstShown}〜${lastShown}件 / ${history.total}件`
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
