import type { Order } from './model';

export type HistoryState = 'all' | 'waiting' | 'complete' | 'cancelled';
export type HistorySort = 'time' | 'ticket' | 'amount';
export type HistoryOptions = {
  from?: string;
  to?: string;
  sort?: HistorySort;
  direction?: 'asc' | 'desc';
};
const japanTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Tokyo',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function historyPage(
  orders: readonly Order[],
  ticket: string,
  state: HistoryState,
  requestedPage: number,
  size = 50,
  options: HistoryOptions = {},
) {
  const { from = '', to = '', sort = 'time', direction = 'desc' } = options;
  const matches = orders
    .filter(
      (order) =>
        (!ticket.trim() ||
          (/^\d+$/.test(ticket.trim()) && order.ticket === Number(ticket))) &&
        (state === 'all' ||
          (state === 'waiting' &&
            (order.status === 'pending' ||
              (order.status === 'paid' && !order.delivered))) ||
          (state === 'complete' &&
            order.status === 'paid' &&
            order.delivered) ||
          (state === 'cancelled' && order.status === 'cancelled')) &&
        (!from || japanTime.format(new Date(order.createdAt)) >= from) &&
        (!to || japanTime.format(new Date(order.createdAt)) <= to),
    )
    .sort((a, b) => {
      const value =
        sort === 'ticket'
          ? a.ticket - b.ticket
          : sort === 'amount'
            ? a.quote.total - b.quote.total
            : a.createdAt.localeCompare(b.createdAt);
      return (
        (direction === 'asc' ? value : -value) ||
        b.createdAt.localeCompare(a.createdAt) ||
        b.id.localeCompare(a.id)
      );
    });
  const pages = Math.max(1, Math.ceil(matches.length / size));
  const page = Math.min(Math.max(0, requestedPage), pages - 1);
  return {
    orders: matches.slice(page * size, (page + 1) * size),
    total: matches.length,
    page,
    pages,
  };
}
