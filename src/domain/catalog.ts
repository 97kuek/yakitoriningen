import { products } from './model';
import type { MenuItem, Price } from './model';

export function getMenu(price: Price): MenuItem[] {
  return (
    price.items ??
    products.map((product) => ({
      ...product,
      price: price.unit,
      discountPrice: 50,
    }))
  );
}

export function getUnitPrice(item: MenuItem, price: Price): number {
  return price.discounted ? item.discountPrice : item.price;
}

export function createMenuDraft(price: Price): Price & {
  items: MenuItem[];
  bundleItems: string[];
  discounted: boolean;
} {
  const legacyDiscount =
    !price.items &&
    price.label === '値下げ' &&
    price.unit === 50 &&
    !price.bundleEnabled;
  const items = getMenu(price).map((item) => ({
    ...item,
    price: legacyDiscount ? 150 : item.price,
  }));
  return {
    ...price,
    items,
    bundleItems: price.bundleItems
      ? [...price.bundleItems]
      : items.map((item) => item.id),
    discounted: legacyDiscount || (price.discounted ?? false),
  };
}
