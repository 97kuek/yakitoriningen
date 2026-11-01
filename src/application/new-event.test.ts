import { expect, it } from 'vitest';
import { newEvent } from './new-event';
import { ledgerFixture } from '../../tests/e2e/helpers';
import { menuForm, menuPrice } from '../presentation/menu-form';

it('準備で編集した商品・セット・札枚数を新しい記録へまとめて反映する', async () => {
  const previous = await ledgerFixture({ orders: 1 });
  const original = structuredClone(previous);
  const draft = menuForm(previous.prices[0]);
  draft.items[0].name = 'つくね';
  draft.items[0].price = '180';
  draft.bundlePrice = '700';
  const next = newEvent(previous, '次の祭', '2027-11-06', () => 'id', {
    price: menuPrice(draft),
    ticketCount: 25,
  });
  expect(next.prices[0].items?.[0]).toMatchObject({
    name: 'つくね',
    price: 180,
  });
  expect(next.prices[0].bundlePrice).toBe(700);
  expect(next.meta.ticketCount).toBe(25);
  expect(next.tickets).toHaveLength(25);
  expect(previous).toEqual(original);
});

it('新しい設定に無効な札枚数があれば記録を作らない', async () => {
  const previous = await ledgerFixture();
  expect(() =>
    newEvent(previous, '次の祭', '2027-11-06', () => 'id', {
      price: previous.prices[0],
      ticketCount: 0,
    }),
  ).toThrow();
});

it('記録を空にし、商品と札の設定を引き継ぐ', async () => {
  const previous = await ledgerFixture({ orders: 1, price: { unit: 200 } });
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
  const previous = await ledgerFixture({ orders: 1 });
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
  const previous = await ledgerFixture({
    price: { label: '値下げ', unit: 50, bundleEnabled: false },
  });
  expect(() => newEvent(previous, '次の祭', '2027-11-06', () => 'id')).toThrow(
    /通常価格へ戻し/,
  );
});
