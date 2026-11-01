import type { Order, Ticket } from './model';

type TicketState = Pick<Order, 'status' | 'delivered' | 'returned'>;

export function freeTickets(count: number): Ticket[] {
  return Array.from({ length: count }, (_, index) => ({
    number: index + 1,
    orderId: null,
    assignmentId: null,
  }));
}

/** Honor a chosen physical ticket; never substitute a different number when it is busy. */
export function chooseTicket(
  tickets: Ticket[],
  count: number,
  requested?: number,
): Ticket {
  const ticket =
    requested === undefined
      ? [...tickets]
          .filter((ticket) => ticket.orderId === null && ticket.number <= count)
          .sort((a, b) => a.number - b.number)[0]
      : tickets.find(
          (ticket) => ticket.number === requested && ticket.number <= count,
        );
  if (requested !== undefined && (!ticket || ticket.orderId !== null))
    throw new Error(
      '選んだ札は使用中か利用できません。空いている札を選び直してください。',
    );
  if (!ticket)
    throw new Error(
      '空き札がありません。現金を受け取らず、札の回収を待ってください。',
    );
  return ticket;
}

/** The order is finished and its physical ticket is back, so the number can be reused. */
export function releasesTicket(order: TicketState): boolean {
  return order.returned && (order.delivered || order.status === 'cancelled');
}

/** The order is finished but its physical ticket has not been collected yet. */
export function needsTicketReturn(order: TicketState): boolean {
  return !order.returned && (order.delivered || order.status === 'cancelled');
}

export function ownsTicket(
  ticket: Ticket | undefined,
  order: Pick<Order, 'id' | 'assignmentId'>,
): boolean {
  return (
    ticket?.orderId === order.id && ticket.assignmentId === order.assignmentId
  );
}
