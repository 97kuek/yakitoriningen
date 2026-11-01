import { MAX_TICKETS } from './constants';
import type { Order } from './model';
import { isAwaitingHandoff } from './order';
import { japanMinuteOfDay } from './time';

export const HISTORY_PAGE_SIZE = 50;
/** Longest ticket-number query worth typing. */
export const TICKET_SEARCH_MAX_LENGTH = String(MAX_TICKETS).length;

export type HistoryState = 'all' | 'waiting' | 'complete' | 'cancelled';
export type HistorySort = 'time' | 'ticket' | 'amount';
export type SortDirection = 'asc' | 'desc';
export type HistoryOptions = {
  /** Order time range in Japan as minutes since midnight: `from` inclusive, `to` exclusive. */
  from?: number;
  to?: number;
  sort?: HistorySort;
  direction?: SortDirection;
};

/** Exact ticket-number match. An empty query matches every order. */
export function matchesTicket(order: Pick<Order, 'ticket'>, query: string) {
  const ticket = query.trim();
  if (!ticket) return true;
  return /^\d+$/.test(ticket) && order.ticket === Number(ticket);
}

function matchesState(order: Order, state: HistoryState): boolean {
  switch (state) {
    case 'all':
      return true;
    case 'waiting':
      return order.status === 'pending' || isAwaitingHandoff(order);
    case 'complete':
      return order.status === 'paid' && order.delivered;
    case 'cancelled':
      return order.status === 'cancelled';
  }
}

/** Every matching order in display order, before pagination. */
export function filterHistory(
  orders: readonly Order[],
  ticket: string,
  state: HistoryState,
  options: HistoryOptions = {},
): Order[] {
  const { from, to, sort = 'time', direction = 'desc' } = options;
  return orders
    .filter((order) => {
      if (!matchesTicket(order, ticket) || !matchesState(order, state))
        return false;
      if (from === undefined && to === undefined) return true;
      const minute = japanMinuteOfDay(order.createdAt);
      return (
        (from === undefined || minute >= from) &&
        (to === undefined || minute < to)
      );
    })
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
}

export function historyPage(
  orders: readonly Order[],
  ticket: string,
  state: HistoryState,
  requestedPage: number,
  size = HISTORY_PAGE_SIZE,
  options: HistoryOptions = {},
) {
  const matches = filterHistory(orders, ticket, state, options);
  const pages = Math.max(1, Math.ceil(matches.length / size));
  const page = Math.min(Math.max(0, requestedPage), pages - 1);
  return {
    orders: matches.slice(page * size, (page + 1) * size),
    total: matches.length,
    page,
    pages,
    size,
  };
}
