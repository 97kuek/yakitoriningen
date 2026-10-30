import { useEffect, useRef, useState } from 'react';
import { products } from '../domain/model';
import { newId } from '../lib/id';
import { yen } from '../presentation/format';

import type { Order, Snapshot } from '../domain/model';
import type { Shared } from '../ui';
import { Icon } from './Icon';
import type { Cashier } from '../application/ports';
export function History({
  snapshot,
  act,
  context,
  errorMessage,
  store,
}: Shared & { snapshot: Snapshot; store: Cashier }) {
  const [scope, setScope] = useState('day');
  const [cancel, setCancel] = useState<Order | null>(null);
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const staged = snapshot.operations.find(
    (op) =>
      op.status === 'pending' &&
      op.command.type === 'cancel' &&
      op.command.orderId === cancel?.id &&
      op.context.generation === context.generation,
  );
  const stagedReason =
    staged?.command.type === 'cancel' ? staged.command.reason : '';
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (cancel) dialog.current?.showModal();
    else dialog.current?.close();
  }, [cancel]);
  const orders = snapshot.orders.filter(
    (o) => scope === 'event' || o.day === snapshot.meta.day,
  );
  const sold = orders.filter((o) => o.status === 'paid');
  const sales = sold.reduce((n, o) => n + o.quote.total, 0);
  const gross = orders
    .filter((o) => o.received !== null)
    .reduce((n, o) => n + o.quote.total, 0);
  return (
    <section className="panel history">
      <div className="section-heading">
        <h2>
          <Icon name="chart" />
          売上・履歴
        </h2>
        <label className="inline-label">
          集計範囲
          <select value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="day">営業日 {snapshot.meta.day}</option>
            <option value="event">開催回全体</option>
          </select>
        </label>
      </div>
      <div className="sales-overview">
        <div className="sales-amount">
          <span>売上</span>
          <strong data-testid="net-sales">{yen(sales)}</strong>
        </div>
        <div className="sales-breakdown">
          <span>
            {sold.reduce((n, o) => n + o.quote.count, 0)}本 / {sold.length}件
          </span>
          <span>
            {products
              .map(
                (p) =>
                  `${p.name} ${sold.reduce((n, o) => n + o.quantities[p.id], 0)}本`,
              )
              .join('　')}
          </span>
        </div>
        {gross !== sales && (
          <p className="sales-adjustments">
            返金 {yen(gross - sales)}を差し引いた売上です。
          </p>
        )}
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
            {[...orders].reverse().map((o) => (
              <tr key={o.id}>
                <td>
                  {new Date(o.createdAt).toLocaleTimeString('ja-JP', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {scope === 'event' && (
                    <small>
                      {new Intl.DateTimeFormat('ja-JP', {
                        month: 'numeric',
                        day: 'numeric',
                        timeZone: 'Asia/Tokyo',
                      }).format(new Date(`${o.day}T00:00:00+09:00`))}
                    </small>
                  )}
                </td>
                <td>
                  <strong>{o.ticket}</strong>
                </td>
                <td>
                  {products
                    .filter((p) => o.quantities[p.id])
                    .map((p) => `${o.names[p.id]} ${o.quantities[p.id]}本`)
                    .join(' ／ ')}
                </td>
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
                    <button
                      className="secondary danger-text"
                      onClick={() => {
                        setReason('');
                        setConfirmed(false);
                        setCancel(o);
                      }}
                    >
                      全額返金
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!orders.length && (
          <p className="empty-text">この範囲の注文はありません。</p>
        )}
      </div>
      <dialog ref={dialog} onCancel={() => setCancel(null)}>
        <h2>全額返金</h2>
        {errorMessage && (
          <p className="inline-error" role="alert">
            {errorMessage}
          </p>
        )}
        {cancel && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void act(async () => {
                if (!staged)
                  throw new Error('返金前に準備を保存してください。');
                await store.execute(staged.id, context);
                setCancel(null);
              });
            }}
          >
            <div className="refund-amount">
              <span>札 {cancel.ticket} の返金</span>
              <strong>{yen(cancel.quote.total)}</strong>
            </div>
            {!staged && (
              <p className="hint">準備ができてから現金を返してください。</p>
            )}
            <label>
              取消理由
              <input
                required
                maxLength={200}
                disabled={!!staged}
                value={staged ? stagedReason : reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            {!staged && (
              <button
                type="button"
                className="primary wide"
                disabled={!reason.trim()}
                onClick={() =>
                  act(() =>
                    store.stage(newId(), context, {
                      type: 'cancel',
                      orderId: cancel.id,
                      assignmentId: cancel.assignmentId,
                      reason,
                    }),
                  )
                }
              >
                返金を始める
              </button>
            )}
            {staged && (
              <>
                <p className="notice">
                  <strong>返金の準備ができました。</strong>
                  <br />
                  返金済みか確認し、未返金なら {yen(cancel.quote.total)}{' '}
                  を返金してください。
                </p>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                  />
                  全額返金し、現金を確認しました
                </label>
              </>
            )}

            <div className="actions">
              <button
                type="button"
                className="secondary"
                onClick={() => setCancel(null)}
              >
                戻る
              </button>
              <button className="danger" disabled={!staged || !confirmed}>
                返金を記録
              </button>
            </div>
          </form>
        )}
      </dialog>
    </section>
  );
}
