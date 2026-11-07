import { expect, it } from 'vitest';
import { normalPrice } from '../domain/model';
import { orderItems, orderLines, orderLineTotals, orderText } from './format';

const legacy = {
  quantities: { momo: 5, kawa: 2, negima: 0 },
  names: { momo: 'もも', kawa: 'かわ', negima: 'ねぎま' },
  price: normalPrice('price'),
};

it('味を保存していない注文の商品一覧と表示を変えない', () => {
  expect(orderText(legacy)).toBe('もも 5本 ／ かわ 2本');
  expect(orderLines(legacy)).toEqual(orderItems(legacy));
});

it('味別の行を表示し、商品別の集計本数を維持する', () => {
  const order = {
    ...legacy,
    flavors: { momo: { tare: 2, shio: 3 }, kawa: { shio: 2 } },
  };
  expect(orderText(order)).toBe(
    'もも（たれ） 2本 ／ もも（塩だれ） 3本 ／ かわ（塩だれ） 2本',
  );
  expect(orderItems(order)).toEqual(orderItems(legacy));
});

it('一部だけ味を指定した旧注文の残りを味指定なしと表示する', () => {
  expect(
    orderText({ ...legacy, flavors: { momo: { tare: 2, shio: 0 } } }),
  ).toBe(
    'もも（たれ） 2本 ／ もも（味指定なし） 3本 ／ かわ（味指定なし） 2本',
  );
});

it('後から味の名前が変わっても注文内の価格に保存した名前を表示する', () => {
  const order = {
    ...legacy,
    quantities: { momo: 2 },
    price: {
      ...legacy.price,
      flavors: [{ id: 'tare', name: '甘だれ' }],
    },
    flavors: { momo: { tare: 2 } },
  };
  expect(orderText(order)).toBe('もも（甘だれ） 2本');
  expect(
    orderLineTotals([
      order,
      {
        ...order,
        price: { ...order.price, flavors: [{ id: 'tare', name: 'たれ' }] },
      },
      {
        ...order,
        price: { ...order.price, flavors: [{ id: 'sweet', name: '甘だれ' }] },
        flavors: { momo: { sweet: 2 } },
      },
    ]).map(({ name, flavorName, quantity }) => ({
      name,
      flavorName,
      quantity,
    })),
  ).toEqual([
    { name: 'もも', flavorName: '甘だれ', quantity: 4 },
    { name: 'もも', flavorName: 'たれ', quantity: 2 },
  ]);
});

it('旧注文と味指定済み注文が混在しても本数を重複集計しない', () => {
  const totals = orderLineTotals([
    legacy,
    { ...legacy, flavors: { momo: { tare: 2 } } },
  ]);
  expect(totals.reduce((count, line) => count + line.quantity, 0)).toBe(14);
  expect(totals.find((line) => line.flavorName === 'たれ')?.quantity).toBe(2);
});
