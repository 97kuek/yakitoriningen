import { count, priceSchema, quantitySchema, quoteSchema } from './model';
import type { Price, Quantities } from './model';
import { getMenu, getUnitPrice } from './catalog';

export function quote(quantities: Quantities, price: Price) {
  const q = quantitySchema.parse(quantities);
  const p = priceSchema.parse(price);
  const menu = getMenu(p);
  const ids = new Set(menu.map((item) => item.id));
  if (Object.entries(q).some(([id, quantity]) => quantity > 0 && !ids.has(id)))
    throw new Error('メニューにない商品が含まれています。');
  const totalCount = count(q);
  let total = menu.reduce(
    (sum, item) => sum + (q[item.id] ?? 0) * getUnitPrice(item, p),
    0,
  );
  let bundles = 0;
  if (p.bundleEnabled && (!p.discounted || p.bundleDuringDiscount)) {
    const eligible = menu.filter(
      (item) => !p.bundleItems || p.bundleItems.includes(item.id),
    );
    const units = eligible.map((item) =>
      Array<number>(q[item.id] ?? 0).fill(getUnitPrice(item, p)),
    );
    const groups = p.mix ? [units.flat().sort((a, b) => b - a)] : units;
    // Largest unit prices yield the greatest saving for each fixed-size bundle.
    for (const group of groups)
      for (
        let start = 0;
        start + p.bundleSize <= group.length;
        start += p.bundleSize
      ) {
        const singleTotal = group
          .slice(start, start + p.bundleSize)
          .reduce((sum, unit) => sum + unit, 0);
        if (singleTotal <= p.bundlePrice) break;
        total -= singleTotal - p.bundlePrice;
        bundles++;
      }
  }
  const singles = totalCount - bundles * p.bundleSize;
  return quoteSchema.parse({
    total,
    count: totalCount,
    bundles,
    singles,
  });
}
