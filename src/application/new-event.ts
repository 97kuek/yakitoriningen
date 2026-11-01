import { metaSchema, priceSchema, type Snapshot } from '../domain/model';
import { createMenuDraft } from '../domain/catalog';

/** Prepare a clean ledger; the caller atomically replaces the unchanged previous ledger. */
export function newEvent(
  previous: Snapshot,
  event: string,
  day: string,
  newId: () => string,
): Snapshot {
  if (
    previous.orders.some((order) => order.status === 'pending') ||
    previous.operations.some((operation) => operation.status === 'pending') ||
    previous.tickets.some((ticket) => ticket.orderId !== null)
  )
    throw new Error('未完了の会計や未回収の札を先に確認してください。');
  const active = previous.prices.find(
    (price) => price.id === previous.meta.activePriceId,
  );
  if (!active) throw new Error('商品・価格を確認できません。');
  if (
    !active.items &&
    active.label === '値下げ' &&
    active.unit === 50 &&
    !active.bundleEnabled
  )
    throw new Error(
      '先に「商品・価格」で通常価格へ戻し、価格を確認してから記録を保存してください。',
    );
  const price = priceSchema.parse({
    ...createMenuDraft(active),
    id: newId(),
    discounted: false,
  });
  const meta = metaSchema.parse({
    key: 'main',
    databaseId: newId(),
    generation: newId(),
    event,
    day,
    activePriceId: price.id,
    ticketCount: previous.meta.ticketCount,
    sequence: 0,
    expenseTotal: null,
  });
  return {
    meta,
    prices: [price],
    orders: [],
    tickets: Array.from({ length: meta.ticketCount }, (_, index) => ({
      number: index + 1,
      orderId: null,
      assignmentId: null,
    })),
    operations: [],
    logs: [],
  };
}
