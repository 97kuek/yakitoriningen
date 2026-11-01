import { expect, it } from 'vitest';
import { needsTicketReturn, releasesTicket } from './ticket';
import type { Order } from './model';

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
