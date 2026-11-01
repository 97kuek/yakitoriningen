import { expect, it } from 'vitest';
import { newEvent } from './new-event';
import { historyFixture } from '../../tests/e2e/fixtures';

it('記録を空にし、商品と札の設定を引き継ぐ', async () => {
  const previous = await historyFixture(1, { unit: 200 });
  const next = newEvent(
    previous,
    '早稲田祭 2027',
    '2027-11-06',
    () => 'new-id',
  );
  expect(next.meta).toMatchObject({
    event: '早稲田祭 2027',
    day: '2027-11-06',
    sequence: 0,
    expenseTotal: null,
    databaseId: 'new-id',
  });
  expect(next.orders).toEqual([]);
  expect(next.operations).toEqual([]);
  expect(next.logs).toEqual([]);
  expect(next.prices).toHaveLength(1);
  expect(next.prices[0].unit).toBe(200);
  expect(next.tickets.every((ticket) => ticket.orderId === null)).toBe(true);
});

it('未完了の会計や操作が残っていれば拒否する', async () => {
  const previous = await historyFixture(1);
  const occupied = {
    ...previous,
    tickets: previous.tickets.map((ticket, index) =>
      index ? ticket : { ...ticket, orderId: 'busy', assignmentId: 'a' },
    ),
  };
  expect(() =>
    newEvent(occupied, '次の祭', '2027-11-06', () => 'id'),
  ).toThrow();
  const pending = {
    ...previous,
    operations: [
      ...previous.operations,
      { ...previous.operations[0], status: 'pending' as const },
    ],
  };
  expect(() => newEvent(pending, '次の祭', '2027-11-06', () => 'id')).toThrow();
});

it('旧形式の値下げ価格では通常価格を勝手に決めず切り替えを止める', async () => {
  const previous = await historyFixture(0, {
    label: '値下げ',
    unit: 50,
    bundleEnabled: false,
  });
  expect(() => newEvent(previous, '次の祭', '2027-11-06', () => 'id')).toThrow(
    /通常価格へ戻し/,
  );
});
