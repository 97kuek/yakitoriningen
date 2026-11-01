import type { Order, Ticket } from './model';

type TicketState = Pick<Order, 'status' | 'delivered' | 'returned'>;

export function freeTickets(count: number): Ticket[] {
  return Array.from({ length: count }, (_, index) => ({
    number: index + 1,
    orderId: null,
    assignmentId: null,
  }));
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
