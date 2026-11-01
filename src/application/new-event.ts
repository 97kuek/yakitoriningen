import {
  META_KEY,
  metaSchema,
  priceSchema,
  type Price,
  type Snapshot,
} from '../domain/model';
import {
  createMenuDraft,
  findActivePrice,
  isLegacyDiscountPrice,
} from '../domain/catalog';
import { freeTickets } from '../domain/ticket';

/** Prepare a clean ledger; the caller atomically replaces the unchanged previous ledger. */
export function newEvent(
  previous: Snapshot,
  event: string,
  day: string,
  newId: () => string,
  settings?: { price: Price; ticketCount: number },
): Snapshot {
  if (
    previous.orders.some((order) => order.status === 'pending') ||
    previous.operations.some((operation) => operation.status === 'pending') ||
    previous.tickets.some((ticket) => ticket.orderId !== null)
  )
    throw new Error('未完了の会計や未回収の札を先に確認してください。');
  const active = findActivePrice(previous);
  if (!active) throw new Error('商品・価格を確認できません。');
  if (isLegacyDiscountPrice(active))
    throw new Error(
      '先に「商品・価格」で通常価格へ戻し、価格を確認してから記録を保存してください。',
    );
  const price = priceSchema.parse({
    ...createMenuDraft(settings?.price ?? active),
    id: newId(),
    discounted: false,
    label: '通常',
  });
  const meta = metaSchema.parse({
    key: META_KEY,
    databaseId: newId(),
    generation: newId(),
    event,
    day,
    activePriceId: price.id,
    ticketCount: settings?.ticketCount ?? previous.meta.ticketCount,
    sequence: 0,
    expenseTotal: null,
  });
  return {
    meta,
    prices: [price],
    orders: [],
    tickets: freeTickets(meta.ticketCount),
    operations: [],
    logs: [],
  };
}
