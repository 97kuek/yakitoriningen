import { describe, expect, it } from 'vitest';
import type { Order, Operation, Snapshot } from './model';
import { waitTime, dailyWaitTime, elapsedWait } from './wait-time';

const now = Date.parse('2026-11-01T03:30:00Z');
it('経過時間は会計確定から数え、予約・回収済み・不正な時刻を除外する', () => {
  const order = {
    status: 'paid',
    paidAt: '2026-11-01T03:22:30Z',
    returned: false,
  } as Order;
  expect(elapsedWait(order, now)).toBe(7);
  expect(elapsedWait(order, now + 60_000)).toBe(8);
  expect(
    elapsedWait(
      { ...order, paidAt: new Date(now + 60_000).toISOString() },
      now,
    ),
  ).toBe(0);
  expect(
    elapsedWait({ ...order, status: 'pending', paidAt: null }, now),
  ).toBeNull();
  expect(elapsedWait({ ...order, returned: true }, now)).toBeNull();
  expect(elapsedWait({ ...order, paidAt: 'bad' }, now)).toBeNull();
});
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
  it('shows a mean after the first return and rounds minutes', () => {
    expect(waitTime(fixture([2]), now)).toBe(2);
    expect(waitTime(fixture([]), now)).toBeNull();
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
  it('keeps earlier returns, excludes future/invalid times and deduplicates returns', () => {
    const snapshot = fixture([5, 5, 5, 100, 100, 100]);
    snapshot.logs[3].at = new Date(now - 31 * 60_000).toISOString();
    snapshot.logs[4].at = new Date(now + 60_000).toISOString();
    snapshot.logs[5].at = 'invalid';
    snapshot.logs.push({ ...snapshot.logs[0], sequence: 20 });
    expect(waitTime(snapshot, now)).toBe(22);
    expect(waitTime(fixture([5]), now + 31 * 60_000)).toBe(5);
    expect(dailyWaitTime(fixture([5]), snapshot.meta.day)).toBe(5);
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
