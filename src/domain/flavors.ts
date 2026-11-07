import { getFlavors, getMenu } from './catalog';
import { flavorQuantitiesSchema } from './model';
import type { FlavorQuantities, Price, Quantities } from './model';

/** Partial allocations preserve legacy unspecified quantities without changing totals. */
export function validateFlavorQuantities(
  quantities: Quantities,
  flavors: FlavorQuantities | undefined,
  price: Price,
): void {
  if (flavors === undefined) return;
  const parsed = flavorQuantitiesSchema.parse(flavors);
  const productIds = new Set(getMenu(price).map((product) => product.id));
  const flavorIds = new Set(getFlavors(price).map((flavor) => flavor.id));
  for (const [productId, allocations] of Object.entries(parsed)) {
    if (!productIds.has(productId))
      throw new Error('味別の本数に登録されていない商品があります。');
    if (Object.keys(allocations).some((flavorId) => !flavorIds.has(flavorId)))
      throw new Error('登録されていない味があります。');
    if (
      Object.values(allocations).reduce((sum, value) => sum + value, 0) >
      (quantities[productId] ?? 0)
    )
      throw new Error('味別の本数が商品の本数を超えています。');
  }
}
