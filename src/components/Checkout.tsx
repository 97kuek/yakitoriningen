import { useEffect, useMemo, useRef, useState } from 'react';
import { IconButton, Button, EnterHint, preventKeyRepeat } from './controls';
import { count } from '../domain/model';
import type { Operation, Order, Snapshot } from '../domain/model';
import {
  bundleApplies,
  findActivePrice,
  getMenu,
  getFlavors,
} from '../domain/catalog';
import { MAX_MONEY, MAX_QUANTITY } from '../domain/constants';
import { tryQuote } from '../domain/pricing';
import { pendingOrders } from '../domain/snapshot';
import { newId } from '../lib/id';
import { orderLines, yen } from '../presentation/format';
import { stockLevels } from '../domain/inventory';
import { useCheckoutKeys } from '../hooks/useCheckoutKeys';
import { emptyDraft } from '../ui';
import type { Draft, Shared } from '../ui';
import type { Cashier } from '../application/ports';
import { Icon } from './Icon';
import { TicketPicker } from './TicketPicker';
import { ProductInput } from './ProductInput';
import { validateFlavorQuantities } from '../domain/flavors';

/** Amounts added for common notes and coins. */
const CASH_INCREMENTS = [100, 500, 1000, 5000, 10000];
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
  const activePrice = findActivePrice(snapshot)!;
  const price = draft.price ?? activePrice;
  const products = getMenu(price);
  const flavors = getFlavors(price);
  const { remaining, available, balance } = useMemo(
    () => stockLevels(snapshot),
    [snapshot],
  );
  const checkoutRoot = useRef<HTMLElement>(null);
  const nextButton = useRef<HTMLButtonElement>(null);
  useCheckoutKeys(checkoutRoot, nextButton);
  // An invalid total cannot be submitted; the draft stays editable.
  const estimate = tryQuote(draft.quantities, price);
  const latestEstimate =
    price === activePrice ? estimate : tryQuote(draft.quantities, activePrice);
  const pending = pendingOrders(snapshot);
  const unresolved = snapshot.operations.some((op) => op.status === 'pending');
  const tickets = snapshot.tickets.filter(
    (ticket) => ticket.number <= snapshot.meta.ticketCount,
  );
  const hasTicket = tickets.some((ticket) => ticket.orderId === null);
  const changeQuantity = (
    id: string,
    flavorId: string | undefined,
    value: number,
  ) => {
    const allocated = draft.flavors?.[id] ?? {};
    const selected = flavorId
      ? (allocated[flavorId] ?? 0)
      : (draft.quantities[id] ?? 0) -
        Object.values(allocated).reduce((sum, n) => sum + n, 0);
    const total = (draft.quantities[id] ?? 0) - selected + value;
    if (
      !Number.isInteger(value) ||
      value < 0 ||
      total > Math.min(MAX_QUANTITY, available[id] ?? MAX_QUANTITY)
    )
      return;
    setClearedDraft(null);
    const quantities = { ...draft.quantities, [id]: total };
    let nextFlavors = draft.flavors;
    if (flavorId) {
      const next = Object.fromEntries(
        Object.entries({ ...allocated, [flavorId]: value }).filter(
          ([, quantity]) => quantity > 0,
        ),
      );
      nextFlavors = { ...draft.flavors };
      if (Object.keys(next).length) nextFlavors[id] = next;
      else delete nextFlavors[id];
    }
    setDraft(
      count(quantities)
        ? {
            quantities,
            price,
            ...(nextFlavors ? { flavors: nextFlavors } : {}),
          }
        : emptyDraft(),
    );
  };
  let canUseLatest = !!latestEstimate;
  try {
    validateFlavorQuantities(draft.quantities, draft.flavors, activePrice);
  } catch {
    canUseLatest = false;
  }
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
                ...(order.flavors ? { flavors: order.flavors } : {}),
              })
            }
            resumed={resumeOrderIds.includes(order.id)}
            tickets={tickets}
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
          {canUseLatest && latestEstimate ? (
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
        {products.map((product, index) => {
          const allocated = draft.flavors?.[product.id] ?? {};
          const unspecified =
            (draft.quantities[product.id] ?? 0) -
            Object.values(allocated).reduce((sum, n) => sum + n, 0);
          return (
            <ProductInput
              key={product.id}
              product={product}
              price={price}
              index={index}
              flavors={flavors}
              quantities={allocated}
              unspecified={unspecified}
              remaining={remaining[product.id]}
              inconsistent={balance[product.id] < 0}
              available={Math.min(
                MAX_QUANTITY,
                available[product.id] ?? MAX_QUANTITY,
              )}
              onChange={(flavorId, value) =>
                changeQuantity(product.id, flavorId, value)
              }
            />
          );
        })}
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
              orderId: newId(),
              assignmentId: newId(),
              confirmOperationId: newId(),
              quantities: draft.quantities,
              ...(draft.flavors ? { flavors: draft.flavors } : {}),
              price,
            });
            setClearedDraft(null);
            setDraft(emptyDraft());
          })
        }
      >
        会計へ
        <Icon name="arrow" />
        <EnterHint />
      </Button>
      {!hasTicket && (
        <p className="notice">空き札がありません。札の回収を待ってください。</p>
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
  tickets,
  errorMessage,
}: Shared & {
  order: Order;
  operation?: Operation;
  store: Cashier;
  resumed: boolean;
  onEdit: () => void;
  tickets: Snapshot['tickets'];
}) {
  const [received, setReceived] = useState('');
  const [ticketOpen, setTicketOpen] = useState(false);
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
  const validAmount =
    Number.isSafeInteger(amount) && amount >= 0 && amount <= MAX_MONEY;
  const addReceivedCash = (value: number) => {
    if (receivedInput.current?.validity.badInput) return;
    setReceived((current) => {
      const next = Number(current) + value;
      if (
        !Number.isSafeInteger(next) ||
        Number(current) < 0 ||
        next > MAX_MONEY
      )
        return current;
      return String(next);
    });
  };
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
      </div>
      {resumed && (
        <p className="notice">
          再開した会計です。現金を二度受け取らないよう確認してください。
        </p>
      )}
      <div className="receipt-items">
        {orderLines(order).map((item, index) => (
          <span key={`${item.id}-${index}`}>
            {item.name}
            {item.flavorName && (
              <span className="order-flavor-name">{item.flavorName}</span>
            )}
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
            if (!received || !validAmount || amount < order.quote.total) return;
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
          <div className="cash-buttons">
            <Button
              type="button"
              onClick={() => setReceived(String(order.quote.total))}
            >
              ちょうど
            </Button>
            {CASH_INCREMENTS.map((value) => (
              <Button
                type="button"
                key={value}
                disabled={!validAmount || amount + value > MAX_MONEY}
                onClick={() => addReceivedCash(value)}
              >
                ＋{value.toLocaleString('ja-JP')}
              </Button>
            ))}
          </div>
          {received !== '' && amount < order.quote.total && (
            <p className="amount-error" role="status">
              {yen(order.quote.total - amount)} 足りません。
            </p>
          )}
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
              setTicketOpen(true);
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
            disabled={!received || !validAmount || amount < order.quote.total}
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
      {staged && ticketOpen && (
        <TicketPicker
          tickets={tickets.map((ticket) =>
            ticket.number === order.ticket
              ? { ...ticket, orderId: null, assignmentId: null }
              : ticket,
          )}
          value={order.ticket}
          busy={busy}
          errorMessage={errorMessage}
          focusAfterClose={confirmButton}
          onClose={() => setTicketOpen(false)}
          onConfirm={(ticket) =>
            perform(async () => {
              if (ticket !== order.ticket)
                await saveCommand({
                  type: 'selectTicket',
                  ...target,
                  from: order.ticket,
                  ticket,
                });
              await store.execute(order.confirmOperationId, context);
            })
          }
        />
      )}
    </section>
  );
}
