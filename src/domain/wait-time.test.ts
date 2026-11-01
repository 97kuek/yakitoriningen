import { describe, expect, it } from 'vitest';
import type { Order, Operation, Snapshot } from './model';
import { waitTime } from './wait-time';

const now = Date.parse('2026-11-01T03:30:00Z');
function fixture(minutes: number[]): Snapshot {
  return {
    meta: { day: '2026-11-01' },
    orders: minutes.map((duration, index) => ({
      id: String(index),
      assignmentId: String(index),
      day: '2026-11-01',
      status: 'paid',
      delivered: true,
      returned: true,
      paidAt: new Date(now - (duration + index) * 60_000).toISOString(),
    })) as Order[],
    operations: minutes.map((_, index) => ({
      id: String(index),
      status: 'done',
      command: {
        type: 'complete',
        orderId: String(index),
        assignmentId: String(index),
      },
    })) as Operation[],
    logs: minutes.map((_, index) => ({
      sequence: index + 1,
      operationId: String(index),
      type: 'complete',
      target: String(index),
      at: new Date(now - index * 60_000).toISOString(),
    })),
  } as Snapshot;
}
describe('waitTime', () => {
  it('requires three actual completions and rounds their mean in minutes', () => {
    expect(waitTime(fixture([2, 4]), now)).toBeNull();
    expect(waitTime(fixture([2, 4, 9]), now)).toBe(5);
    expect(waitTime(fixture([0, 0, 0]), now)).toBe(1);
  });
  it('uses the latest ten completions, independent of storage order', () => {
    const snapshot = fixture([...Array<number>(10).fill(4), 100]);
    snapshot.logs.reverse();
    expect(waitTime(snapshot, now)).toBe(4);
  });
  it('excludes cancelled, undone, other-day, unmatched and failed operations', () => {
    const snapshot = fixture([5, 5, 5, 100, 100, 100, 100, 100]);
    snapshot.orders[3].status = 'cancelled';
    snapshot.orders[4].returned = false;
    snapshot.orders[5].day = '2026-10-31';
    snapshot.operations[6].status = 'pending';
    snapshot.orders[7].assignmentId = 'different';
    expect(waitTime(snapshot, now)).toBe(5);
  });
  it('ignores stale, future and invalid timestamps, and does not count a return twice', () => {
    const snapshot = fixture([5, 5, 5, 100, 100, 100]);
    snapshot.logs[3].at = new Date(now - 31 * 60_000).toISOString();
    snapshot.logs[4].at = new Date(now + 60_000).toISOString();
    snapshot.logs[5].at = 'invalid';
    snapshot.logs.push({ ...snapshot.logs[0], sequence: 20 });
    expect(waitTime(snapshot, now)).toBe(5);
    expect(waitTime(snapshot, now + 31 * 60_000)).toBeNull();
  });
  it('supports separately returned tickets', () => {
    const snapshot = fixture([3, 6, 9]);
    snapshot.operations.forEach((operation) => {
      operation.command = {
        type: 'return',
        orderId: operation.id,
        assignmentId: operation.id,
      };
    });
    expect(waitTime(snapshot, now)).toBe(6);
  });
});
