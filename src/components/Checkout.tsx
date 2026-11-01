import { useEffect, useRef, useState } from 'react';
import { IconButton, Button, EnterHint, preventKeyRepeat } from './controls';
import { count } from '../domain/model';
import type { Operation, Order, Quantities, Snapshot } from '../domain/model';
import {
  bundleApplies,
  findActivePrice,
  getMenu,
  getUnitPrice,
} from '../domain/catalog';
import { MAX_MONEY, MAX_QUANTITY, LOW_STOCK } from '../domain/constants';
import { tryQuote } from '../domain/pricing';
import { pendingOrders } from '../domain/snapshot';
import { newId } from '../lib/id';
import { orderItems, yen } from '../presentation/format';
import {
  remainingStock,
  availableStock,
  stockBalance,
} from '../domain/inventory';
import { useCheckoutKeys } from '../hooks/useCheckoutKeys';
import { emptyDraft } from '../ui';
import type { Draft, Shared } from '../ui';
import type { Cashier } from '../application/ports';
import { Icon } from './Icon';
import { Ticket } from './Ticket';
import { TicketPicker } from './TicketPicker';

/** Quick amounts for common notes and coins. */
const CASH_SHORTCUTS = [500, 1000, 2000, 5000, 10000];
/** Delay before the confirm button accepts a click, so a double click cannot confirm. */
const CONFIRM_READY_DELAY_MS = 500;

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
  const [clearedDraft, setClearedDraft] = useState<Draft | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<number | null>(null);
  const activePrice = findActivePrice(snapshot)!;
  const price = draft.price ?? activePrice;
  const products = getMenu(price);
  const remaining = remainingStock(snapshot);
  const available = availableStock(snapshot);
  const balance = stockBalance(snapshot);
  const checkoutRoot = useRef<HTMLElement>(null);
  const nextButton = useRef<HTMLButtonElement>(null);
  useCheckoutKeys(checkoutRoot, nextButton);
  // An invalid total cannot be submitted; the draft stays editable.
  const estimate = tryQuote(draft.quantities, price);
  const latestEstimate = tryQuote(draft.quantities, activePrice);
  const pending = pendingOrders(snapshot);
  const unresolved = snapshot.operations.some((op) => op.status === 'pending');
  const tickets = snapshot.tickets.filter(
    (ticket) => ticket.number <= snapshot.meta.ticketCount,
  );
  const chosenTicket =
    selectedTicket ??
    [...tickets]
      .filter((ticket) => ticket.orderId === null)
      .sort((a, b) => a.number - b.number)[0]?.number ??
    null;
  const hasTicket = tickets.some(
    (ticket) => ticket.number === chosenTicket && ticket.orderId === null,
  );
  useEffect(() => {
    if (selectedTicket !== null)
      nextButton.current?.focus({ preventScroll: true });
  }, [selectedTicket]);
  const changeQuantity = (id: keyof Quantities, value: number) => {
    if (
      !Number.isInteger(value) ||
      value < 0 ||
      value > Math.min(MAX_QUANTITY, available[id] ?? MAX_QUANTITY)
    )
      return;
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
    <section
      ref={checkoutRoot}
      className="checkout panel"
      aria-labelledby="checkout-title"
    >
      <div className="section-heading">
        <h2 id="checkout-title">注文</h2>
        <TicketPicker
          tickets={tickets}
          value={chosenTicket}
          onChange={setSelectedTicket}
        />
        <div
          className="checkout-feedback"
          role="status"
          data-testid="checkout-feedback"
        >
          {clearedDraft ? (
            <>
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
          ) : null}
        </div>
        <IconButton
          variant="plain"
          type="button"
          className="icon-button muted"
          disabled={!count(draft.quantities)}
          onClick={() => {
            setClearedDraft(draft);
            setDraft(emptyDraft());
          }}
          label="注文をクリア"
          icon="close"
        />
      </div>
      <div className="price-strip">
        <span className="price-label">
          {price.discounted ? '値下げ価格' : '通常価格'}
        </span>
        {bundleApplies(price) && (
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
              <div className="product-title">
                {index < 9 && (
                  <kbd className="product-key" aria-hidden="true">
                    {index + 1}
                  </kbd>
                )}
                <strong>{p.name}</strong>
                {remaining[p.id] !== undefined && (
                  <span
                    className={`product-stock ${remaining[p.id] <= LOW_STOCK ? 'stock-low' : ''}`}
                  >
                    残り {remaining[p.id]}本
                    {balance[p.id] < 0 ? '・在庫を確認' : ''}
                  </span>
                )}
              </div>
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
                  max={Math.min(MAX_QUANTITY, available[p.id] ?? MAX_QUANTITY)}
                  value={draft.quantities[p.id] ?? 0}
                  onChange={(e) => changeQuantity(p.id, Number(e.target.value))}
                />
              </div>
              <IconButton
                variant="secondary"
                type="button"
                className="increase"
                data-product-key={index < 9 ? index + 1 : undefined}
                aria-keyshortcuts={index < 9 ? String(index + 1) : undefined}
                disabled={
                  (draft.quantities[p.id] ?? 0) >=
                  Math.min(MAX_QUANTITY, available[p.id] ?? MAX_QUANTITY)
                }
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
        ref={nextButton}
        className="primary checkout-button wide"
        disabled={
          !estimate?.count ||
          unresolved ||
          !hasTicket ||
          Object.entries(draft.quantities).some(
            ([id, value]) =>
              available[id] !== undefined && value > available[id],
          )
        }
        onClick={() =>
          shared.perform(async () => {
            await shared.saveCommand({
              type: 'reserve',
              ticket: chosenTicket!,
              orderId: newId(),
              assignmentId: newId(),
              confirmOperationId: newId(),
              quantities: draft.quantities,
              price,
            });
            setClearedDraft(null);
            setSelectedTicket(null);
            setDraft(emptyDraft());
          })
        }
      >
        会計へ
        <Icon name="arrow" />
        <EnterHint />
      </Button>
      {!hasTicket && (
        <p className="notice">
          {chosenTicket === null
            ? '空き札がありません。札の回収を待ってください。'
            : '選んだ札は使用中です。別の札を選んでください。'}
        </p>
      )}
    </section>
  );
}
/** A row label with a fixed slot for the sign, so the names line up. */
function CashLabel({ sign = '', name }: { sign?: string; name: string }) {
  return (
    <span className="cash-label">
      <span className="cash-sign">{sign}</span>
      <span className="cash-name">{name}</span>
    </span>
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
  onEdit,
  busy,
}: Shared & {
  order: Order;
  operation?: Operation;
  store: Cashier;
  resumed: boolean;
  onEdit: () => void;
}) {
  const [received, setReceived] = useState('');
  const [confirmReady, setConfirmReady] = useState(true);
  const paymentRoot = useRef<HTMLElement>(null);
  const primaryButton = useRef<HTMLButtonElement>(null);
  useCheckoutKeys(paymentRoot, primaryButton);
  const receivedInput = useRef<HTMLInputElement>(null);
  const confirmButton = primaryButton;
  const focusedStage = useRef<string | null>(null);
  const target = { orderId: order.id, assignmentId: order.assignmentId };
  const staged =
    operation?.status === 'pending' && operation.command.type === 'pay';
  const amount =
    staged && operation.command.type === 'pay'
      ? operation.command.received
      : Number(received);
  useEffect(() => {
    if (!staged || confirmReady) return;
    const timer = window.setTimeout(
      () => setConfirmReady(true),
      CONFIRM_READY_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [staged, confirmReady]);
  useEffect(() => {
    const stage = staged ? 'confirm' : 'received';
    if (
      !busy &&
      (!staged || confirmReady) &&
      focusedStage.current !== stage &&
      window.matchMedia('(pointer: fine)').matches
    ) {
      (staged ? confirmButton.current : receivedInput.current)?.focus({
        preventScroll: true,
      });
      focusedStage.current = stage;
    }
  }, [busy, staged, confirmReady]);
  return (
    <section
      ref={paymentRoot}
      className="payment"
      aria-label={`札${order.ticket}の入金`}
    >
      <div className="section-heading">
        <h2>
          <Icon name="cash" />
          お会計
        </h2>
        <Ticket number={order.ticket} />
      </div>
      {resumed && (
        <p className="notice">
          再開した会計です。現金を二度受け取らないよう確認してください。
        </p>
      )}
      <div className="receipt-items">
        {orderItems(order).map((item) => (
          <span key={item.id}>
            {item.name}
            <b>{item.quantity}本</b>
          </span>
        ))}
      </div>
      {!staged && (
        <div className="payment-total">
          <span>お会計</span>
          <strong data-testid="payment-total">{yen(order.quote.total)}</strong>
        </div>
      )}
      {!staged ? (
        <form
          id={`payment-${order.id}`}
          onSubmit={(e) => {
            e.preventDefault();
            setConfirmReady(false);
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
                max={MAX_MONEY}
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
            <Button
              type="button"
              onClick={() => setReceived(String(order.quote.total))}
            >
              ちょうど
            </Button>
            {CASH_SHORTCUTS.map((value) => (
              <Button
                type="button"
                key={value}
                disabled={value < order.quote.total}
                onClick={() => setReceived(String(value))}
              >
                {yen(value)}
              </Button>
            ))}
          </div>
        </form>
      ) : (
        <div className="cash-calculation" aria-label="お釣りの計算">
          <div>
            <CashLabel name="お預かり" />
            <strong>{yen(amount)}</strong>
          </div>
          <div>
            <CashLabel sign="−" name="お会計" />
            <strong data-testid="payment-total">
              {yen(order.quote.total)}
            </strong>
          </div>
          <div className="cash-change">
            <CashLabel name="お釣り" />
            <strong data-testid="change">
              {yen(amount - order.quote.total)}
            </strong>
          </div>
        </div>
      )}
      <div className="payment-controls">
        {staged ? (
          <Button
            variant="primary"
            ref={confirmButton}
            className="checkout-button wide"
            disabled={!confirmReady}
            onKeyDown={preventKeyRepeat}
            onClick={(event) => {
              if (event.detail > 1) return;
              void perform(async () => {
                await store.execute(order.confirmOperationId, context);
              });
            }}
          >
            <Icon name="check" />
            会計を確定
            <EnterHint />
          </Button>
        ) : (
          <Button
            variant="primary"
            type="submit"
            ref={primaryButton}
            form={`payment-${order.id}`}
            className="checkout-button wide"
            disabled={!received || amount < order.quote.total}
          >
            お釣りを確認
            <Icon name="arrow" />
            <EnterHint />
          </Button>
        )}
        <div className="payment-secondary">
          {staged ? (
            <Button
              variant="plain"
              className="link-button"
              onClick={() =>
                void perform(() =>
                  store.discard(order.confirmOperationId, context),
                )
              }
            >
              入金額を修正
            </Button>
          ) : (
            <>
              <Button
                variant="plain"
                className="link-button"
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
                戻る
              </Button>
              <Button
                variant="plain"
                className="link-button muted"
                onClick={() =>
                  void perform(() =>
                    saveCommand({
                      type: 'cancel',
                      ...target,
                      reason: '未入金の保留取消',
                    }),
                  )
                }
              >
                注文を取り消す
              </Button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
