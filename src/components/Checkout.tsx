import { useEffect, useRef, useState } from 'react';
import { count, emptyQuantities, products } from '../domain/model';
import { newId } from '../lib/id';
import { yen } from '../presentation/format';

import type {
  Operation,
  Order,
  Price,
  Quantities,
  Snapshot,
} from '../domain/model';
import { quote } from '../domain/pricing';
import type { Shared } from '../ui';
import type { Cashier } from '../application/ports';
import { Icon } from './Icon';

type Draft = { quantities: Quantities; price: Price | null };
export function Checkout({
  snapshot,
  draft,
  setDraft,
  store,
  resumeOrderIds,
  ...shared
}: Shared & {
  snapshot: Snapshot;
  draft: Draft;
  setDraft: (d: Draft) => void;
  store: Cashier;
  resumeOrderIds: string[];
}) {
  const [lastPaidTicket, setLastPaidTicket] = useState<number | null>(null);
  const activePrice = snapshot.prices.find(
    (p) => p.id === snapshot.meta.activePriceId,
  )!;
  const price = draft.price ?? activePrice;
  let estimate: ReturnType<typeof quote> | null = null;
  let latestEstimate: ReturnType<typeof quote> | null = null;
  try {
    estimate = quote(draft.quantities, price);
  } catch {
    /* Invalid totals cannot be submitted. */
  }
  try {
    latestEstimate = quote(draft.quantities, activePrice);
  } catch {
    /* Keep the original draft available. */
  }
  const pending = snapshot.orders.filter((o) => o.status === 'pending');
  const unresolved = snapshot.operations.some((op) => op.status === 'pending');
  const hasTicket = snapshot.tickets.some((t) => !t.orderId);
  const changeQuantity = (id: keyof Quantities, value: number) => {
    if (!Number.isInteger(value) || value < 0 || value > 999) return;
    setLastPaidTicket(null);
    const quantities = { ...draft.quantities, [id]: value };
    setDraft({ quantities, price: count(quantities) ? price : null });
  };
  if (pending.length)
    return (
      <section className="checkout panel payment-mode">
        {pending.map((order) => (
          <Payment
            key={`${order.id}-${order.confirmOperationId}`}
            order={order}
            operation={snapshot.operations.find(
              (op) => op.id === order.confirmOperationId,
            )}
            store={store}
            onConfirmed={() => setLastPaidTicket(order.ticket)}
            resumed={resumeOrderIds.includes(order.id)}
            {...shared}
          />
        ))}
      </section>
    );
  return (
    <section className="checkout panel" aria-labelledby="checkout-title">
      <div className="section-heading">
        <h2 id="checkout-title">
          <Icon name="skewer" />
          注文
        </h2>
        <button
          className="icon-button muted"
          aria-label="注文をクリア"
          title="注文をクリア"
          disabled={!count(draft.quantities)}
          onClick={() =>
            setDraft({ quantities: emptyQuantities(), price: null })
          }
        >
          <Icon name="reset" />
        </button>
      </div>
      <div
        className={`checkout-feedback${lastPaidTicket !== null ? ' success' : ''}`}
        role="status"
        data-testid="checkout-feedback"
      >
        {lastPaidTicket !== null ? (
          <>
            <Icon name="check" />
            <span>札 {lastPaidTicket} 会計済み。番号札を渡してください。</span>
          </>
        ) : (
          <span>本数を選んで「会計へ」</span>
        )}
      </div>
      <div className="price-strip">
        <span className="price-label">{price.label}</span>
        <span>
          1本 <b>{yen(price.unit)}</b>
        </span>
        {price.bundleEnabled && (
          <span>
            {price.bundleSize}本 <b>{yen(price.bundlePrice)}</b>
            <small>{price.mix ? '組合せ自由' : '同じ種類'}</small>
          </span>
        )}
      </div>
      {draft.price && draft.price.id !== activePrice.id && (
        <div className="notice compact-notice">
          <span>この注文は変更前の価格です。</span>
          {latestEstimate ? (
            <button
              className="link-button"
              onClick={() => setDraft({ ...draft, price: activePrice })}
            >
              {yen(latestEstimate.total)}に変更
            </button>
          ) : (
            <span>最新価格では合計金額が上限を超えます。</span>
          )}
        </div>
      )}
      <div className="products">
        {products.map((p, index) => (
          <div
            className={`product product-${index}${draft.quantities[p.id] ? ' selected' : ''}`}
            key={p.id}
          >
            <div className="product-name">
              <strong>{p.name}</strong>
            </div>
            <div className="stepper">
              <button
                aria-label={`${p.name}を1本減らす`}
                disabled={!draft.quantities[p.id]}
                onClick={() => changeQuantity(p.id, draft.quantities[p.id] - 1)}
              >
                <Icon name="minus" />
              </button>
              <div className="quantity-input">
                <input
                  aria-label={`${p.name}の本数`}
                  type="number"
                  min="0"
                  max="999"
                  value={draft.quantities[p.id]}
                  onChange={(e) => changeQuantity(p.id, Number(e.target.value))}
                />
                <span>本</span>
              </div>
              <button
                className="increase"
                aria-label={`${p.name}を1本増やす`}
                disabled={draft.quantities[p.id] === 999}
                onClick={() => changeQuantity(p.id, draft.quantities[p.id] + 1)}
              >
                <Icon name="plus" />
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="checkout-total">
        <div>
          <span>
            合計 <b>{count(draft.quantities)}</b>本
          </span>
          {!!estimate?.bundles && (
            <small>
              {estimate.bundles}セット
              {estimate.singles > 0 ? ` ＋ 単品${estimate.singles}本` : ''}
            </small>
          )}
        </div>
        <strong data-testid="total">
          {estimate ? yen(estimate.total) : '上限超過'}
        </strong>
      </div>
      <button
        className="primary checkout-button wide"
        disabled={!estimate?.count || unresolved || !hasTicket}
        onClick={() =>
          shared.act(async () => {
            await shared.run({
              type: 'reserve',
              orderId: newId(),
              assignmentId: newId(),
              confirmOperationId: newId(),
              quantities: draft.quantities,
              price,
            });
            setDraft({ quantities: emptyQuantities(), price: null });
          })
        }
      >
        会計へ
        <Icon name="arrow" />
      </button>
      {!hasTicket && (
        <p className="notice">空き札がありません。札の回収を待ってください。</p>
      )}
    </section>
  );
}
function Payment({
  order,
  operation,
  store,
  act,
  context,
  run,
  resumed,
  onConfirmed,
  busy,
}: Shared & {
  order: Order;
  operation?: Operation;
  store: Cashier;
  resumed: boolean;
  onConfirmed: () => void;
}) {
  const [received, setReceived] = useState('');
  const receivedInput = useRef<HTMLInputElement>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);
  const focusedStage = useRef<string | null>(null);
  const target = { orderId: order.id, assignmentId: order.assignmentId };
  const staged =
    operation?.status === 'pending' && operation.command.type === 'pay';
  const amount =
    staged && operation.command.type === 'pay'
      ? operation.command.received
      : Number(received);
  useEffect(() => {
    const stage = staged ? 'confirm' : 'received';
    if (
      !busy &&
      focusedStage.current !== stage &&
      window.matchMedia('(pointer: fine)').matches
    ) {
      (staged ? confirmButton.current : receivedInput.current)?.focus({
        preventScroll: true,
      });
      focusedStage.current = stage;
    }
  }, [busy, staged]);
  return (
    <section className="payment" aria-label={`札${order.ticket}の入金`}>
      <div className="section-heading">
        <h2>
          <Icon name="cash" />
          お会計
        </h2>
        <span className="ticket-chip">
          <Icon name="ticket" />札 {order.ticket}
        </span>
      </div>
      {resumed && (
        <p className="notice">
          再開した会計です。現金を二度受け取らないよう確認してください。
        </p>
      )}
      <div className="receipt-items">
        {products
          .filter((p) => order.quantities[p.id])
          .map((p) => (
            <span key={p.id}>
              {p.name}
              <b>{order.quantities[p.id]}本</b>
            </span>
          ))}
      </div>
      <div className={`payment-total${staged ? ' settled-total' : ''}`}>
        <span>お会計</span>
        <strong data-testid="payment-total">{yen(order.quote.total)}</strong>
      </div>
      {!staged ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void act(() =>
              store.stage(order.confirmOperationId, context, {
                type: 'pay',
                ...target,
                received: Number(received),
              }),
            );
          }}
        >
          <label className="received-label">
            お預かり金額
            <div className="money-input">
              <span>￥</span>
              <input
                ref={receivedInput}
                type="number"
                min={order.quote.total}
                max="100000000"
                required
                value={received}
                onChange={(e) => setReceived(e.target.value)}
                inputMode="numeric"
                placeholder="0"
              />
            </div>
          </label>
          {received !== '' && amount < order.quote.total && (
            <p className="amount-error" role="status">
              {yen(order.quote.total - amount)} 足りません。
            </p>
          )}
          <div className="cash-buttons">
            {[order.quote.total, 1000, 2000, 5000, 10000]
              .filter(
                (v, i, arr) => v >= order.quote.total && arr.indexOf(v) === i,
              )
              .map((v, i) => (
                <button
                  type="button"
                  key={v}
                  className="secondary"
                  onClick={() => setReceived(String(v))}
                >
                  {i === 0 ? 'ちょうど' : yen(v)}
                </button>
              ))}
          </div>
          <button
            className="primary checkout-button wide"
            disabled={!received || amount < order.quote.total}
          >
            お釣りを確認
            <Icon name="arrow" />
          </button>
          <button
            type="button"
            className="link-button muted payment-back"
            onClick={() => {
              if (
                window.confirm(
                  '現金を受け取っていないことを確認して、この注文を取り消しますか？',
                )
              )
                void act(() =>
                  run({
                    type: 'cancel',
                    ...target,
                    reason: '未入金の保留取消',
                  }),
                );
            }}
          >
            この注文を取り消す
          </button>
        </form>
      ) : (
        <>
          <div className="received-summary">
            <span>お預かり</span>
            <strong>{yen(amount)}</strong>
          </div>
          <div className="change-display">
            <span>お釣り</span>
            <strong data-testid="change">
              {yen(amount - order.quote.total)}
            </strong>
          </div>
          <p className="payment-instruction">
            現金を受け取り、お釣りを渡してください。
          </p>
          <button
            ref={confirmButton}
            className="primary checkout-button wide"
            onClick={() =>
              act(async () => {
                await store.execute(order.confirmOperationId, context);
                onConfirmed();
              })
            }
          >
            <Icon name="check" />
            会計を確定
          </button>
          <button
            className="link-button muted payment-back"
            onClick={() => {
              if (
                window.confirm(
                  '現金を照合し、会計未確定であることを確認しましたか？入金額を入力し直します。',
                )
              )
                void act(() =>
                  store.dismiss(order.confirmOperationId, context),
                );
            }}
          >
            入金額を修正
          </button>
        </>
      )}
    </section>
  );
}
export type { Draft };
