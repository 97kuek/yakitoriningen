import { IconButton, Button, Dialog } from './controls';
import { useEffect, useRef, useState } from 'react';
import { count, emptyQuantities } from '../domain/model';
import { newId } from '../lib/id';
import { yen } from '../presentation/format';

import type {
  Operation,
  Order,
  Price,
  Quantities,
  Snapshot,
} from '../domain/model';
import { getMenu, getUnitPrice } from '../domain/catalog';
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
  const [clearedDraft, setClearedDraft] = useState<Draft | null>(null);
  const activePrice = snapshot.prices.find(
    (p) => p.id === snapshot.meta.activePriceId,
  )!;
  const price = draft.price ?? activePrice;
  const products = getMenu(price);
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
    setClearedDraft(null);
    const quantities = Object.fromEntries(
      products.map((product) => [
        product.id,
        product.id === id ? value : (draft.quantities[product.id] ?? 0),
      ]),
    );
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
            onEdit={() =>
              setDraft({
                quantities: { ...order.quantities },
                price: order.price,
              })
            }
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
        <IconButton
          variant="plain"
          type="button"
          className="icon-button muted"
          disabled={!count(draft.quantities)}
          onClick={() => {
            setClearedDraft(draft);
            setLastPaidTicket(null);
            setDraft({ quantities: emptyQuantities(), price: null });
          }}
          label="注文をクリア"
          icon="reset"
        />
      </div>
      <div
        className={`checkout-feedback${lastPaidTicket !== null ? ' success' : ''}`}
        role="status"
        data-testid="checkout-feedback"
      >
        {clearedDraft ? (
          <>
            <span>注文を消しました。</span>
            <Button
              variant="plain"
              className="link-button"
              onClick={() => {
                setDraft(clearedDraft);
                setClearedDraft(null);
              }}
            >
              元に戻す
            </Button>
          </>
        ) : lastPaidTicket !== null ? (
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
        <span>{price.discounted ? '値下げ価格' : '通常価格'}</span>
        {price.bundleEnabled &&
          (!price.discounted || price.bundleDuringDiscount) && (
            <span>
              {price.bundleSize}本 <b>{yen(price.bundlePrice)}</b>
              <small>
                {price.mix ? '対象商品の組合せ自由' : '同じ種類でセット'}
              </small>
            </span>
          )}
      </div>
      {draft.price && draft.price.id !== activePrice.id && (
        <div className="notice compact-notice">
          <span>この注文は変更前の価格です。</span>
          {latestEstimate ? (
            <Button
              variant="plain"
              type="button"
              className="link-button"
              onClick={() => setDraft({ ...draft, price: activePrice })}
            >
              {yen(latestEstimate.total)}に変更
            </Button>
          ) : (
            <span>
              最新の商品・価格には変更できません。この注文は元の内容で会計できます。
            </span>
          )}
        </div>
      )}
      <div className="products">
        {products.map((p, index) => (
          <div className={`product product-${index}`} key={p.id}>
            <div className="product-name">
              <strong>{p.name}</strong>
              <small>{yen(getUnitPrice(p, price))}</small>
            </div>
            <div className="stepper">
              <IconButton
                variant="secondary"
                type="button"
                disabled={!(draft.quantities[p.id] ?? 0)}
                onClick={() =>
                  changeQuantity(p.id, (draft.quantities[p.id] ?? 0) - 1)
                }
                label={`${p.name}を1本減らす`}
                icon="minus"
              />
              <div className="quantity-input">
                <input
                  aria-label={`${p.name}の本数`}
                  type="number"
                  min="0"
                  max="999"
                  value={draft.quantities[p.id] ?? 0}
                  onChange={(e) => changeQuantity(p.id, Number(e.target.value))}
                />
                <span>本</span>
              </div>
              <IconButton
                variant="secondary"
                type="button"
                className="increase"
                disabled={(draft.quantities[p.id] ?? 0) === 999}
                onClick={() =>
                  changeQuantity(p.id, (draft.quantities[p.id] ?? 0) + 1)
                }
                label={`${p.name}を1本増やす`}
                icon="plus"
              />
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
      <Button
        variant="primary"
        type="button"
        className="primary checkout-button wide"
        disabled={!estimate?.count || unresolved || !hasTicket}
        onClick={() =>
          shared.perform(async () => {
            await shared.saveCommand({
              type: 'reserve',
              orderId: newId(),
              assignmentId: newId(),
              confirmOperationId: newId(),
              quantities: draft.quantities,
              price,
            });
            setClearedDraft(null);
            setDraft({ quantities: emptyQuantities(), price: null });
          })
        }
      >
        会計へ
        <Icon name="arrow" />
      </Button>
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
  perform,
  context,
  saveCommand,
  resumed,
  onConfirmed,
  onEdit,
  busy,
}: Shared & {
  order: Order;
  operation?: Operation;
  store: Cashier;
  resumed: boolean;
  onConfirmed: () => void;
  onEdit: () => void;
}) {
  const products = getMenu(order.price);
  const [received, setReceived] = useState('');
  const [confirmAction, setConfirmAction] = useState<'edit' | 'cancel' | null>(
    null,
  );
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
            void perform(() =>
              store.prepare(order.confirmOperationId, context, {
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
                aria-label="お預かり金額"
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
                <Button
                  variant="secondary"
                  type="button"
                  key={v}
                  className="secondary"
                  onClick={() => setReceived(String(v))}
                >
                  {i === 0 ? 'ちょうど' : yen(v)}
                </Button>
              ))}
          </div>
          <Button
            variant="primary"
            type="submit"
            className="primary checkout-button wide"
            disabled={!received || amount < order.quote.total}
          >
            お釣りを確認
            <Icon name="arrow" />
          </Button>
          <Button
            variant="plain"
            type="button"
            className="link-button payment-edit"
            onClick={() =>
              void perform(async () => {
                await saveCommand({
                  type: 'cancel',
                  ...target,
                  reason: '入金前の本数修正',
                });
                onEdit();
              })
            }
          >
            本数を修正
          </Button>
          <Button
            variant="plain"
            type="button"
            className="link-button muted payment-back"
            onClick={() => setConfirmAction('cancel')}
          >
            この注文を取り消す
          </Button>
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
          <Button
            variant="primary"
            type="button"
            ref={confirmButton}
            className="primary checkout-button wide"
            onClick={() =>
              perform(async () => {
                await store.execute(order.confirmOperationId, context);
                onConfirmed();
              })
            }
          >
            <Icon name="check" />
            会計を確定
          </Button>
          <Button
            variant="plain"
            type="button"
            className="link-button muted payment-back"
            onClick={() => setConfirmAction('edit')}
          >
            入金額を修正
          </Button>
        </>
      )}
      {confirmAction && (
        <Dialog
          open
          title={
            confirmAction === 'cancel'
              ? 'この注文を取り消す'
              : 'お預かり金額を修正'
          }
          onClose={() => {
            if (!busy) setConfirmAction(null);
          }}
          footer={
            <>
              <Button disabled={busy} onClick={() => setConfirmAction(null)}>
                戻る
              </Button>
              <Button
                variant={confirmAction === 'cancel' ? 'danger' : 'primary'}
                disabled={busy}
                onClick={() =>
                  void perform(async () => {
                    if (confirmAction === 'edit') {
                      await store.discard(order.confirmOperationId, context);
                    } else if (confirmAction === 'cancel') {
                      await saveCommand({
                        type: 'cancel',
                        ...target,
                        reason: '未入金の保留取消',
                      });
                    }
                    setConfirmAction(null);
                  })
                }
              >
                {confirmAction === 'cancel' ? '注文を取り消す' : '入力し直す'}
              </Button>
            </>
          }
        >
          <p>
            札 {order.ticket} ／ お会計 {yen(order.quote.total)}
          </p>
          <p>
            {confirmAction === 'cancel'
              ? '現金を受け取っていないことを確認してから、注文を取り消してください。'
              : '受け取ったお金とお釣りを確認してから、金額を入力し直してください。まだ会計は確定しません。'}
          </p>
        </Dialog>
      )}
    </section>
  );
}
export type { Draft };
