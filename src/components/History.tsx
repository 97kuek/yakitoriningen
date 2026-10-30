import { useState } from 'react';
import { dayText, orderText, timeText, yen } from '../presentation/format';
import { profit, summarizeSales } from '../domain/sales';
import { historyPage } from '../domain/history';
import { Button, Select } from './controls';
import { RefundDialog } from './RefundDialog';
import { SalesCharts } from './SalesCharts';

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
  onEditExpenses,
}: Shared & {
  snapshot: Snapshot;
  store: Cashier;
  onEditExpenses: () => void;
}) {
  const [scope, setScope] = useState<'day' | 'event'>('event');
  const [cancel, setCancel] = useState<Order | null>(null);
  const [ticketSearch, setTicketSearch] = useState('');
  const [waitingOnly, setWaitingOnly] = useState(false);
  const [page, setPage] = useState(0);
  const orders = snapshot.orders.filter(
    (o) => scope === 'event' || o.day === snapshot.meta.day,
  );
  const history = historyPage(orders, ticketSearch, waitingOnly, page);
  const total = summarizeSales(snapshot.orders);
  const selected = summarizeSales(orders);
  const earnings = profit(total.sales, snapshot.meta.expenseTotal);
  return (
    <section className="panel history">
      <div className="section-heading">
        <h2>
          <Icon name="chart" />
          売上・履歴
        </h2>
        <span>開催回全体</span>
      </div>
      <div className="profit-equation">
        <div>
          <span>売上</span>
          <strong data-testid="net-sales">{yen(total.sales)}</strong>
          <small>返金を差し引いた金額</small>
        </div>
        <span aria-hidden="true">−</span>
        <div>
          <span>経費</span>
          <strong data-testid="expense-total">
            {snapshot.meta.expenseTotal == null
              ? '未登録'
              : yen(snapshot.meta.expenseTotal)}
          </strong>
          <Button
            variant="plain"
            type="button"
            className="link-button"
            onClick={onEditExpenses}
          >
            {snapshot.meta.expenseTotal == null ? '経費を登録' : '経費を変更'}
          </Button>
        </div>
        <span aria-hidden="true">＝</span>
        <div>
          <span>利益</span>
          <strong
            className={earnings !== null && earnings < 0 ? 'danger-text' : ''}
            data-testid="profit"
          >
            {earnings === null ? '未登録' : yen(earnings)}
          </strong>
          <small>
            {earnings === null
              ? '経費を登録すると表示します'
              : '売上から経費を引いた金額'}
          </small>
        </div>
      </div>
      <div className="sales-detail-heading">
        <h3>売上の内訳</h3>
        <label className="inline-label">
          表示範囲
          <Select
            value={scope}
            label="表示範囲"
            onChange={(value) => {
              setScope(value as 'day' | 'event');
              setPage(0);
            }}
            options={[
              { value: 'event', label: '開催回全体' },
              { value: 'day', label: `日付 ${snapshot.meta.day}` },
            ]}
          />
        </label>
      </div>
      <div className="sales-breakdown-line">
        <span>
          {selected.count}本 / {selected.orders}件
        </span>
        {selected.refunds > 0 && <span>返金 {yen(selected.refunds)}</span>}
        <span>
          {scope === 'day' ? `この日の売上 ${yen(selected.sales)}` : ''}
        </span>
      </div>
      <SalesCharts
        orders={orders}
        scope={scope}
        price={snapshot.prices.find(
          (price) => price.id === snapshot.meta.activePriceId,
        )!}
      />
      <h3 className="history-heading">注文履歴</h3>
      <div className="history-filters">
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
      <div className="table-scroll">
        <table>
          <caption className="sr-only">注文履歴</caption>
          <thead>
            <tr>
              <th>{scope === 'event' ? '日時' : '時刻'}</th>
              <th>札</th>
              <th>内容</th>
              <th>会計額</th>
              <th>状態</th>
              <th>
                <span className="sr-only">返金</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {history.orders.map((o) => (
              <tr key={o.id}>
                <td>
                  {timeText(o.createdAt)}
                  {scope === 'event' && <small>{dayText(o.day)}</small>}
                </td>
                <td>
                  <strong>{o.ticket}</strong>
                </td>
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
                          ? '受け渡し済み'
                          : '受け渡し待ち'}
                  </span>
                  <small>
                    {o.cancelReason ??
                      (!o.returned && o.delivered ? '札未回収' : null)}
                  </small>
                </td>
                <td>
                  {o.status === 'paid' && (
                    <Button
                      variant="secondary"
                      type="button"
                      className="secondary danger-text"
                      onClick={() => {
                        setCancel(o);
                      }}
                    >
                      全額返金
                    </Button>
                  )}
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
          <Button
            disabled={history.page === 0}
            onClick={() => setPage(history.page - 1)}
          >
            新しい50件
          </Button>
          <Button
            disabled={history.page + 1 >= history.pages}
            onClick={() => setPage(history.page + 1)}
          >
            前の50件
          </Button>
        </div>
      </div>
      {cancel && (
        <RefundDialog
          key={cancel.id}
          order={snapshot.orders.find((order) => order.id === cancel.id)!}
          snapshot={snapshot}
          store={store}
          onClose={() => setCancel(null)}
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
