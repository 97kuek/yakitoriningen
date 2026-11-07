import { describe, expect, it } from 'vitest';
import * as catalog from './catalog';
import { normalPrice, priceSchema } from './model';

const defaults = [
  { id: 'tare', name: 'たれ' },
  { id: 'shio', name: '塩だれ' },
];

describe('味のメニュー', () => {
  it('旧価格は保存形式を変えず表示と編集時に既定の味を使う', () => {
    const legacy = normalPrice('legacy');
    expect(priceSchema.parse(legacy)).toEqual(legacy);
    expect(catalog).toHaveProperty('getFlavors');
    expect(catalog.getFlavors(legacy)).toEqual(defaults);
    const draft = catalog.createMenuDraft(legacy);
    expect(draft.flavors).toEqual(defaults);
    draft.flavors[0].name = '変更';
    expect(catalog.getFlavors(legacy)).toEqual(defaults);
    expect(Object.hasOwn(legacy, 'flavors')).toBe(false);
  });

  it('保存された味の名前を編集用にコピーする', () => {
    const price = {
      ...normalPrice('p'),
      flavors: [{ id: 'sauce', name: '甘口' }],
    };
    const parsed = priceSchema.parse(price);
    expect(catalog.getFlavors(parsed)).toEqual(price.flavors);
    const draft = catalog.createMenuDraft(parsed);
    draft.flavors[0].name = '辛口';
    expect(parsed.flavors).toEqual(price.flavors);
  });

  it.each(['たれ', ' たれ '])(
    '前後の空白を除くと同じ味名になる設定を拒否する: %s',
    (name) => {
      expect(() =>
        priceSchema.parse({
          ...normalPrice('p'),
          flavors: [
            { id: 'tare', name: 'たれ' },
            { id: 'other', name },
          ],
        }),
      ).toThrow('味の名前が重複しています');
    },
  );

  it.each(
    [
      [],
      [{ id: 'tare', name: '' }],
      [{ id: 'tare', name: '味'.repeat(21) }],
      [{ id: '__proto__', name: '味' }],
      [{ id: 'constructor', name: '味' }],
      [
        { id: 'tare', name: 'たれ' },
        { id: 'tare', name: '別名' },
      ],
      Array.from({ length: 11 }, (_, i) => ({ id: `f${i}`, name: '味' })),
    ].map((flavors) => [flavors]),
  )('不正な味の設定を拒否する: %j', (flavors) => {
    expect(() => priceSchema.parse({ ...normalPrice('p'), flavors })).toThrow();
  });
});
