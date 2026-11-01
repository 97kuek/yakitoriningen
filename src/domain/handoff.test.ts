import { describe, expect, it } from 'vitest';
import { needsTicketReturn } from './handoff';

describe('needsTicketReturn', () => {
  it('shows only cancelled or delivered orders with tickets still outstanding', () => {
    expect(
      needsTicketReturn({
        status: 'pending',
        delivered: false,
        returned: false,
      }),
    ).toBe(false);
    expect(
      needsTicketReturn({ status: 'paid', delivered: false, returned: false }),
    ).toBe(false);
    expect(
      needsTicketReturn({ status: 'paid', delivered: true, returned: false }),
    ).toBe(true);
    expect(
      needsTicketReturn({
        status: 'cancelled',
        delivered: false,
        returned: false,
      }),
    ).toBe(true);
    expect(
      needsTicketReturn({
        status: 'cancelled',
        delivered: true,
        returned: true,
      }),
    ).toBe(false);
  });
});
