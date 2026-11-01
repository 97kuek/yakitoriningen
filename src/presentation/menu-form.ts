import { createMenuDraft } from '../domain/catalog';
import { priceSchema, type Price, type MenuItem } from '../domain/model';

export type MenuForm = Omit<Price, 'items' | 'bundleSize' | 'bundlePrice'> & {
  items: (Omit<MenuItem, 'price' | 'discountPrice'> & {
    price: string;
    discountPrice: string;
  })[];
  bundleSize: string;
  bundlePrice: string;
};

export function menuForm(price: Price): MenuForm {
  const draft = createMenuDraft(price);
  return {
    ...draft,
    items: draft.items.map((item) => ({
      ...item,
      price: String(item.price),
      discountPrice: String(item.discountPrice),
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
    ...item,
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
