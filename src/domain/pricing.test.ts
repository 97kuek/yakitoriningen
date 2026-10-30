import { describe, expect, it } from 'vitest';
import { quote } from './pricing';
import { priceSchema, quantitySchema } from './model';
import * as catalog from './catalog';
const normal = {
  id: 'p1',
  label: '通常',
  unit: 150,
  bundleSize: 5,
  bundlePrice: 600,
  bundleEnabled: true,
  mix: true,
};
describe('価格計算', () => {
  it('混在5本600円と端数を計算する', () => {
    expect(quote({ momo: 3, kawa: 2, negima: 1 }, normal)).toMatchObject({
      total: 750,
      count: 6,
      bundles: 1,
      singles: 1,
    });
  });
  it('混在不可なら種類ごとにセット判定する', () => {
    expect(
      quote({ momo: 3, kawa: 2, negima: 1 }, { ...normal, mix: false }).total,
    ).toBe(900);
    expect(
      quote({ momo: 5, kawa: 6, negima: 0 }, { ...normal, mix: false }).total,
    ).toBe(1350);
  });
  it('単品より高いセットを適用しない', () => {
    expect(
      quote({ momo: 5, kawa: 0, negima: 0 }, { ...normal, unit: 50 }).total,
    ).toBe(250);
  });
  it('セット無効と0円を扱う', () => {
    expect(
      quote(
        { momo: 5, kawa: 0, negima: 0 },
        { ...normal, bundleEnabled: false },
      ).total,
    ).toBe(750);
    expect(
      quote({ momo: 5, kawa: 0, negima: 0 }, { ...normal, bundlePrice: 0 })
        .total,
    ).toBe(0);
  });
  it.each([-1, 1.5, NaN, Infinity, 10000])('不正な数量 %s を拒否する', (n) => {
    expect(() => quote({ momo: n, kawa: 0, negima: 0 }, normal)).toThrow();
  });
  it.each([
    { unit: -1 },
    { unit: 1.2 },
    { bundleSize: 0 },
    { unit: Number.MAX_SAFE_INTEGER },
  ])('不正な価格を拒否する', (p) => {
    expect(() =>
      quote({ momo: 1, kawa: 0, negima: 0 }, { ...normal, ...p }),
    ).toThrow();
  });
});

describe('メニュー編集用の下書き', () => {
  it('既知の旧値下げプリセットを通常へ戻せる形に展開する', () => {
    expect(catalog).toHaveProperty('createMenuDraft');
    const legacy = {
      ...normal,
      label: '値下げ',
      unit: 50,
      bundleEnabled: false,
    };
    const draft = catalog.createMenuDraft(legacy);
    expect(draft.discounted).toBe(true);
    expect(draft.items).toEqual([
      { id: 'momo', name: 'もも', price: 150, discountPrice: 50 },
      { id: 'kawa', name: 'かわ', price: 150, discountPrice: 50 },
      { id: 'negima', name: 'ねぎま', price: 150, discountPrice: 50 },
    ]);
    expect(draft.bundleItems).toEqual(['momo', 'kawa', 'negima']);
    expect(quote({ momo: 2 }, draft).total).toBe(100);
    expect(quote({ momo: 2 }, { ...draft, discounted: false }).total).toBe(300);
    expect(quote({ momo: 2 }, legacy).total).toBe(100);
    expect(Object.hasOwn(legacy, 'items')).toBe(false);
    expect(catalog.getMenu(legacy)[0].price).toBe(50);
  });
  it.each([
    { ...normal, label: 'カスタム', unit: 50, bundleEnabled: false },
    { ...normal, label: '値下げ', unit: 60, bundleEnabled: false },
    { ...normal, label: '値下げ', unit: 50, bundleEnabled: true },
  ])('任意の旧価格は値下げプリセットと推定しない', (price) => {
    expect(catalog).toHaveProperty('createMenuDraft');
    const draft = catalog.createMenuDraft(price);
    expect(draft.discounted).toBe(false);
    expect(draft.items[0].price).toBe(price.unit);
  });
  it('新形式は保存済みの設定を保持して編集用コピーを返す', () => {
    expect(catalog).toHaveProperty('createMenuDraft');
    const price = {
      ...normal,
      label: '値下げ',
      unit: 50,
      bundleEnabled: false,
      discounted: false,
      items: [{ id: 'tea', name: 'お茶', price: 120, discountPrice: 80 }],
      bundleItems: ['tea'],
    };
    const draft = catalog.createMenuDraft(price);
    expect(draft.discounted).toBe(false);
    expect(draft.items).toEqual([
      { id: 'tea', name: 'お茶', price: 120, discountPrice: 80 },
    ]);
    draft.items[0].price = 500;
    draft.bundleItems.length = 0;
    expect(price.items[0].price).toBe(120);
    expect(price.bundleItems).toEqual(['tea']);
  });
});

describe('商品別メニュー', () => {
  const menu = {
    ...normal,
    items: [
      { id: 'premium', name: '特上', price: 300, discountPrice: 100 },
      { id: 'momo', name: 'もも', price: 150, discountPrice: 50 },
      { id: 'drink', name: 'お茶', price: 100, discountPrice: 80 },
    ],
    bundleSize: 3,
    bundlePrice: 500,
    bundleItems: ['premium', 'momo'],
  };
  it('対象商品を高い単価からまとめ、最安の組合せを選ぶ', () => {
    expect(quote({ premium: 2, momo: 2, drink: 1 }, menu)).toEqual({
      total: 750,
      count: 5,
      bundles: 1,
      singles: 2,
    });
  });
  it('値下げは商品別単価を使い、既定ではセットを止める', () => {
    expect(
      quote({ premium: 3, momo: 3 }, { ...menu, discounted: true }),
    ).toEqual({
      total: 450,
      count: 6,
      bundles: 0,
      singles: 6,
    });
  });
  it('値下げ中のセットを明示的に許可しても割高にはしない', () => {
    expect(
      quote(
        { premium: 3, momo: 3 },
        {
          ...menu,
          discounted: true,
          bundleDuringDiscount: true,
          bundlePrice: 200,
        },
      ),
    ).toEqual({ total: 350, count: 6, bundles: 1, singles: 3 });
  });
  it('セット未対象と単品より高い組合せを単品計算する', () => {
    expect(quote({ momo: 3, drink: 3 }, menu)).toEqual({
      total: 750,
      count: 6,
      bundles: 0,
      singles: 6,
    });
    expect(quote({ premium: 3 }, { ...menu, bundleItems: [] }).total).toBe(900);
  });
  it('削除済み・未知の商品は非ゼロ数量を拒否し、0は無視する', () => {
    expect(() => quote({ negima: 1 }, menu)).toThrow();
    expect(quote({ negima: 0, premium: 1 }, menu).total).toBe(300);
  });
  it('商品が増えても同種限定セットを維持する', () => {
    expect(quote({ premium: 2, momo: 2 }, { ...menu, mix: false }).total).toBe(
      900,
    );
  });
  it('商品IDの重複と危険なID・対象の欠落を拒否する', () => {
    expect(() =>
      priceSchema.parse({ ...menu, items: [...menu.items, menu.items[0]] }),
    ).toThrow();
    for (const id of [
      '__proto__',
      'constructor',
      'prototype',
      'toString',
      'valueOf',
    ]) {
      expect(() => quantitySchema.parse(JSON.parse(`{"${id}":1}`))).toThrow();
      expect(() =>
        priceSchema.parse({ ...menu, items: [{ ...menu.items[0], id }] }),
      ).toThrow();
    }
    expect(() =>
      priceSchema.parse({ ...menu, bundleItems: ['missing'] }),
    ).toThrow();
  });
  it('旧形式の価格でも値下げ時は既定3商品を50円にする', () => {
    expect(
      quote({ momo: 2, kawa: 2, negima: 2 }, { ...normal, discounted: true }),
    ).toEqual({
      total: 300,
      count: 6,
      bundles: 0,
      singles: 6,
    });
  });
  it('商品数・数量・単価の上限を検証する', () => {
    const items = Array.from({ length: 31 }, (_, n) => ({
      ...menu.items[0],
      id: `item${n}`,
    }));
    expect(() => priceSchema.parse({ ...menu, items })).toThrow();
    expect(() =>
      quantitySchema.parse(Object.fromEntries(items.map((p) => [p.id, 1]))),
    ).toThrow();
    expect(() => quote({ premium: 1000 }, menu)).toThrow();
    expect(() =>
      priceSchema.parse({
        ...menu,
        items: [{ ...menu.items[0], price: Number.MAX_SAFE_INTEGER + 1 }],
      }),
    ).toThrow();
  });
});
it('商品が0件の価格は保存しない', async () => {
  const { priceSchema } = await import('./model');
  expect(() => priceSchema.parse({ ...normal, items: [] })).toThrow();
});
