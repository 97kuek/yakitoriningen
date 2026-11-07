import type { Order } from '../domain/model';
import { getFlavors } from '../domain/catalog';
import { JAPAN_TIME_ZONE } from '../domain/time';

const yenFormat = new Intl.NumberFormat('ja-JP', {
  style: 'currency',
  currency: 'JPY',
});
// Swedish formats dates as ISO yyyy-mm-dd, which <input type="date"> expects.
const isoDateFormat = new Intl.DateTimeFormat('sv-SE', {
  timeZone: JAPAN_TIME_ZONE,
});
const timeFormat = new Intl.DateTimeFormat('ja-JP', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: JAPAN_TIME_ZONE,
});
const dayFormat = new Intl.DateTimeFormat('ja-JP', {
  month: 'numeric',
  day: 'numeric',
  timeZone: JAPAN_TIME_ZONE,
});

export const yen = (value: number) => yenFormat.format(value);

/** Today's date in Japan as yyyy-mm-dd. */
export const today = () => isoDateFormat.format(new Date());

export const timeText = (at: string) => timeFormat.format(new Date(at));

/** `11/7` for a business day stored as yyyy-mm-dd. */
export const dayText = (day: string) =>
  dayFormat.format(new Date(`${day}T00:00:00+09:00`));

type OrderItems = Pick<Order, 'quantities' | 'names'>;
type OrderContents = OrderItems & Partial<Pick<Order, 'flavors' | 'price'>>;
type OrderLine = {
  id: string;
  name: string;
  quantity: number;
  flavorId?: string;
  flavorName?: string;
};

export function orderItems(order: OrderItems) {
  return Object.entries(order.quantities)
    .filter(([, quantity]) => quantity > 0)
    .map(([id, quantity]) => ({
      id,
      name: order.names[id] ?? '商品',
      quantity,
    }));
}

/** Historical orders without flavor quantities keep their original product lines. */
export function orderLines(order: OrderContents): OrderLine[] {
  const items = orderItems(order);
  if (order.flavors === undefined) return items;
  const flavors = order.price ? getFlavors(order.price) : [];
  return items.flatMap((item) => {
    const quantities = order.flavors?.[item.id] ?? {};
    const lines: OrderLine[] = flavors
      .filter((flavor) => (quantities[flavor.id] ?? 0) > 0)
      .map((flavor) => ({
        ...item,
        quantity: quantities[flavor.id],
        flavorId: flavor.id,
        flavorName: flavor.name,
      }));
    const unspecified =
      item.quantity - lines.reduce((sum, line) => sum + line.quantity, 0);
    if (unspecified > 0)
      lines.push({ ...item, quantity: unspecified, flavorName: '味指定なし' });
    return lines;
  });
}

/** Group cooking quantities by product and saved flavor name, including renamed flavors. */
export function orderLineTotals(orders: OrderContents[]): OrderLine[] {
  const totals = new Map<string, OrderLine>();
  for (const order of orders)
    for (const line of orderLines(order)) {
      const key = JSON.stringify([line.id, line.flavorName ?? null]);
      totals.set(key, {
        ...line,
        quantity: (totals.get(key)?.quantity ?? 0) + line.quantity,
      });
    }
  return [...totals.values()];
}

export function orderText(order: OrderContents) {
  return orderLines(order)
    .map(
      (item) =>
        `${item.name}${item.flavorName ? `（${item.flavorName}）` : ''} ${item.quantity}本`,
    )
    .join(' ／ ');
}
