import {
  count,
  priceSchema,
  quantitySchema,
  quoteSchema,
  products,
} from './model';
import type { Price, Quantities } from './model';

export function quote(quantities: Quantities, price: Price) {
  const q = quantitySchema.parse(quantities);
  const p = priceSchema.parse(price);
  const totalCount = count(q);
  const canBundle = p.bundleEnabled && p.bundlePrice < p.unit * p.bundleSize;
  const groups = p.mix
    ? [totalCount]
    : products.map((product) => q[product.id]);
  const bundles = canBundle
    ? groups.reduce((n, size) => n + Math.floor(size / p.bundleSize), 0)
    : 0;
  const singles = totalCount - bundles * p.bundleSize;
  return quoteSchema.parse({
    total: bundles * p.bundlePrice + singles * p.unit,
    count: totalCount,
    bundles,
    singles,
  });
}
