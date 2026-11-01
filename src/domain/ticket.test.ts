import { expect, it } from 'vitest';
import {
  needsTicketReturn,
  releasesTicket,
  chooseTicket,
  freeTickets,
} from './ticket';
import type { Order } from './model';

it('手に持った空き札を指定し、未指定なら最小番号を選ぶ', () => {
  const tickets = freeTickets(20).reverse();
  expect(chooseTicket(tickets, 20, 12).number).toBe(12);
  expect(chooseTicket(tickets, 20).number).toBe(1);
  tickets.find((ticket) => ticket.number === 12)!.orderId = '使用中';
  expect(() => chooseTicket(tickets, 20, 12)).toThrow('使用中');
  expect(() => chooseTicket(tickets, 20, 21)).toThrow();
});

it('札は受け渡し済みか取消済みで、実物を回収したときだけ再利用できる', () => {
  const cases: [
    Pick<Order, 'status' | 'delivered' | 'returned'>,
    boolean,
    boolean,
  ][] = [
    // state, needsTicketReturn, releasesTicket
    [{ status: 'pending', delivered: false, returned: false }, false, false],
    [{ status: 'paid', delivered: false, returned: false }, false, false],
    [{ status: 'paid', delivered: false, returned: true }, false, false],
    [{ status: 'paid', delivered: true, returned: false }, true, false],
    [{ status: 'paid', delivered: true, returned: true }, false, true],
    [{ status: 'cancelled', delivered: false, returned: false }, true, false],
    [{ status: 'cancelled', delivered: false, returned: true }, false, true],
  ];
  for (const [state, needsReturn, releases] of cases) {
    expect(needsTicketReturn(state), JSON.stringify(state)).toBe(needsReturn);
    expect(releasesTicket(state), JSON.stringify(state)).toBe(releases);
  }
});
