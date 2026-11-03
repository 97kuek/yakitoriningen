import { count, priceSchema, quantitySchema, quoteSchema } from './model';
import type { Price, Quantities } from './model';
import { bundleApplies, getMenu, getUnitPrice } from './catalog';

export type Quote = ReturnType<typeof quote>;

type PricedQuantity = { unit: number; quantity: number };

/** Rows must be in descending unit-price order; no per-skewer array is needed. */
function bundleDiscount(rows: PricedQuantity[], size: number, price: number) {
  let bundles = 0;
  let saving = 0;
  let partialCount = 0;
  let partialTotal = 0;
  for (const { unit, quantity } of rows) {
    let left = quantity;
    if (partialCount) {
      const take = Math.min(left, size - partialCount);
      partialCount += take;
      partialTotal += take * unit;
      left -= take;
      if (partialCount < size) continue;
      if (partialTotal <= price) break;
      saving += partialTotal - price;
      bundles++;
      partialCount = 0;
      partialTotal = 0;
    }
    if (unit * size <= price) break;
    const whole = Math.floor(left / size);
    bundles += whole;
    saving += whole * (unit * size - price);
    partialCount = left % size;
    partialTotal = partialCount * unit;
  }
  return { bundles, saving };
}

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
  if (bundleApplies(p)) {
    const eligible = menu.filter(
      (item) => !p.bundleItems || p.bundleItems.includes(item.id),
    );
    const rows = eligible
      .map((item) => ({
        unit: getUnitPrice(item, p),
        quantity: q[item.id] ?? 0,
      }))
      .filter((row) => row.quantity > 0);
    const groups = p.mix
      ? [rows.sort((a, b) => b.unit - a.unit)]
      : rows.map((row) => [row]);
    // Largest unit prices yield the greatest saving for each fixed-size bundle.
    for (const group of groups) {
      const discount = bundleDiscount(group, p.bundleSize, p.bundlePrice);
      total -= discount.saving;
      bundles += discount.bundles;
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

/** A quote, or null when the quantities cannot be priced (for display only). */
export function tryQuote(quantities: Quantities, price: Price): Quote | null {
  try {
    return quote(quantities, price);
  } catch {
    return null;
  }
}
