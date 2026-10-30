import { describe, expect, it } from 'vitest';
import { quote } from './pricing';
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
