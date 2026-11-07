import { expect, it } from 'vitest';
import { normalPrice } from '../domain/model';
import type { Order } from '../domain/model';
import { ordersCsv } from './orders-csv';

const price = normalPrice('price');
const order: Order = {
  id: 'order',
  assignmentId: 'assignment',
  confirmOperationId: 'payment',
  event: '架空の祭り',
  day: '2026-11-07',
  ticket: 1,
  quantities: { momo: 5, kawa: 0, negima: 0 },
  names: { momo: 'もも', kawa: 'かわ', negima: 'ねぎま' },
  price,
  quote: { total: 600, count: 5, bundles: 1, singles: 0 },
  status: 'paid',
  received: 1000,
  change: 400,
  delivered: false,
  returned: false,
  refunded: 0,
  createdAt: '2026-11-07T01:00:00.000Z',
  paidAt: '2026-11-07T01:01:00.000Z',
  cancelReason: null,
};

it('CSVの既存列と商品別本数を保ち、末尾へ味別内訳を追加する', () => {
  const csv = ordersCsv({
    prices: [price],
    orders: [{ ...order, flavors: { momo: { tare: 2, shio: 3 } } }],
  });
  const [header, row] = csv
    .replace('\uFEFF', '')
    .split('\r\n')
    .map((line) => line.split(',').map((cell) => cell.slice(1, -1)));
  expect(header).toEqual([
    '注文ID',
    '営業名',
    '営業日',
    '注文時刻',
    '札番号',
    '状態',
    'もも',
    'かわ',
    'ねぎま',
    '会計額',
    '受領額',
    '釣銭',
    '返金額',
    '売上',
    '受渡済',
    '札回収済',
    '取消理由',
    '味別内訳',
  ]);
  expect(row[6]).toBe('5');
  expect(row[9]).toBe('600');
  expect(row.at(-1)).toBe('もも（たれ） 2本 ／ もも（塩だれ） 3本');
});

it('旧注文のCSVは味を推測せず、内訳欄を空欄にする', () => {
  const row = ordersCsv({ prices: [price], orders: [order] }).split('\r\n')[1];
  expect(row).toMatch(/,""$/);
  expect(row).not.toContain('たれ');
});

it('味別内訳は保存時の味名を使い、CSVの引用符をエスケープする', () => {
  const csv = ordersCsv({
    prices: [{ ...price, flavors: [{ id: 'tare', name: '新しい名前' }] }],
    orders: [
      {
        ...order,
        price: { ...price, flavors: [{ id: 'tare', name: '甘だれ,"特製"' }] },
        flavors: { momo: { tare: 2 } },
      },
    ],
  });
  expect(csv).toContain(
    '"もも（甘だれ,""特製""） 2本 ／ もも（味指定なし） 3本"',
  );
  expect(csv).not.toContain('新しい名前');
});
