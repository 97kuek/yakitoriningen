import { createMenuDraft } from '../domain/catalog';
import {
  priceSchema,
  stockSchema,
  type Price,
  type MenuItem,
} from '../domain/model';

export type MenuForm = Omit<Price, 'items' | 'bundleSize' | 'bundlePrice'> & {
  items: (Omit<MenuItem, 'price' | 'discountPrice'> & {
    price: string;
    discountPrice: string;
    stock: string;
  })[];
  bundleSize: string;
  bundlePrice: string;
};

export function menuForm(
  price: Price,
  stock: Record<string, number> = {},
): MenuForm {
  const draft = createMenuDraft(price);
  return {
    ...draft,
    items: draft.items.map((item) => ({
      ...item,
      price: String(item.price),
      discountPrice: String(item.discountPrice),
      stock: stock[item.id] === undefined ? '' : String(stock[item.id]),
    })),
    bundleSize: String(draft.bundleSize),
    bundlePrice: String(draft.bundlePrice),
  };
}

export function menuPrice(form: MenuForm): Price {
  const number = (value: string, label: string) => {
    if (!value.trim()) throw new Error(`${label}を入力してください。`);
    return Number(value);
  };
  const items = form.items.map((item) => ({
    id: item.id,
    name: item.name,
    price: number(item.price, `${item.name}の通常価格`),
    discountPrice: number(item.discountPrice, `${item.name}の値下げ価格`),
  }));
  return priceSchema.parse({
    ...form,
    items,
    unit: items[0].price,
    bundleSize: number(form.bundleSize, 'セットの本数'),
    bundlePrice: number(form.bundlePrice, 'セットの価格'),
  });
}

export function menuStock(form: MenuForm): Record<string, number> {
  return stockSchema.parse(
    Object.fromEntries(
      form.items
        .filter((item) => item.stock?.trim())
        .map((item) => [item.id, Number(item.stock)]),
    ),
  );
}
