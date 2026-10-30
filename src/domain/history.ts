import type { Order } from './model';

export function historyPage(
  orders: readonly Order[],
  ticket: string,
  waitingOnly: boolean,
  requestedPage: number,
  size = 50,
) {
  const matches = orders
    .filter(
      (order) =>
        (!ticket.trim() ||
          (/^\d+$/.test(ticket.trim()) && order.ticket === Number(ticket))) &&
        (!waitingOnly || (order.status === 'paid' && !order.delivered)),
    )
    .sort(
      (a, b) =>
        b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
    );
  const pages = Math.max(1, Math.ceil(matches.length / size));
  const page = Math.min(Math.max(0, requestedPage), pages - 1);
  return {
    orders: matches.slice(page * size, (page + 1) * size),
    total: matches.length,
    page,
    pages,
  };
}
