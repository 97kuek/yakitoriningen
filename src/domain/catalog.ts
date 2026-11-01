import {
  DEFAULT_DISCOUNT_PRICE,
  DEFAULT_UNIT_PRICE,
  PRICE_LABELS,
} from './constants';
import { defaultProducts } from './model';
import type { MenuItem, Price, Snapshot } from './model';

export function getMenu(price: Price): MenuItem[] {
  return (
    price.items ??
    defaultProducts.map((product) => ({
      ...product,
      price: price.unit,
      discountPrice: DEFAULT_DISCOUNT_PRICE,
    }))
  );
}

export function getUnitPrice(item: MenuItem, price: Price): number {
  return price.discounted ? item.discountPrice : item.price;
}

/** Whether bundle pricing is used in the current selling mode. */
export function bundleApplies(price: Price): boolean {
  return (
    price.bundleEnabled && (!price.discounted || !!price.bundleDuringDiscount)
  );
}

export function priceLabel(discounted: boolean): string {
  return discounted ? PRICE_LABELS.discounted : PRICE_LABELS.normal;
}

/** The fixed 50-yen preset saved before per-product discount prices existed. */
export function isLegacyDiscountPrice(price: Price): boolean {
  return (
    !price.items &&
    price.label === PRICE_LABELS.discounted &&
    price.unit === DEFAULT_DISCOUNT_PRICE &&
    !price.bundleEnabled
  );
}

export function findActivePrice(
  snapshot: Pick<Snapshot, 'meta' | 'prices'>,
): Price | undefined {
  return snapshot.prices.find(
    (price) => price.id === snapshot.meta.activePriceId,
  );
}

export function createMenuDraft(price: Price): Price & {
  items: MenuItem[];
  bundleItems: string[];
  discounted: boolean;
} {
  const legacyDiscount = isLegacyDiscountPrice(price);
  const items = getMenu(price).map((item) => ({
    ...item,
    price: legacyDiscount ? DEFAULT_UNIT_PRICE : item.price,
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
