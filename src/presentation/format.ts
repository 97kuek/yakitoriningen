export const yen = (value: number) =>
  new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(
    value,
  );
export const today = () =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(
    new Date(),
  );

export function orderItems(
  order: Pick<import('../domain/model').Order, 'quantities' | 'names'>,
) {
  return Object.entries(order.quantities)
    .filter(([, quantity]) => quantity > 0)
    .map(([id, quantity]) => ({
      id,
      name: order.names[id] ?? '商品',
      quantity,
    }));
}
export function orderText(
  order: Pick<import('../domain/model').Order, 'quantities' | 'names'>,
) {
  return orderItems(order)
    .map((item) => `${item.name} ${item.quantity}本`)
    .join(' ／ ');
}
export const timeText = (at: string) =>
  new Intl.DateTimeFormat('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Tokyo',
  }).format(new Date(at));
export const dayText = (day: string) =>
  new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    timeZone: 'Asia/Tokyo',
  }).format(new Date(`${day}T00:00:00+09:00`));
