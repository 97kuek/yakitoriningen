import type { Order } from '../domain/model';
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

type OrderLines = Pick<Order, 'quantities' | 'names'>;

export function orderItems(order: OrderLines) {
  return Object.entries(order.quantities)
    .filter(([, quantity]) => quantity > 0)
    .map(([id, quantity]) => ({
      id,
      name: order.names[id] ?? '商品',
      quantity,
    }));
}

export function orderText(order: OrderLines) {
  return orderItems(order)
    .map((item) => `${item.name} ${item.quantity}本`)
    .join(' ／ ');
}
