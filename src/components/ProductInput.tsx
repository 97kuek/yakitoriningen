import { useId, useState } from 'react';
import type { Flavor, MenuItem, Price } from '../domain/model';
import { LOW_STOCK } from '../domain/constants';
import { getUnitPrice } from '../domain/catalog';
import { yen } from '../presentation/format';
import { IconButton, Select } from './controls';

/** One counter edits the selected flavor; the breakdown keeps other quantities visible. */
export function ProductInput({
  product,
  price,
  index,
  flavors,
  quantities,
  unspecified,
  remaining,
  inconsistent,
  available,
  onChange,
}: {
  product: MenuItem;
  price: Price;
  index: number;
  flavors: Flavor[];
  quantities: Record<string, number>;
  unspecified: number;
  remaining?: number;
  inconsistent: boolean;
  available: number;
  onChange: (flavorId: string | undefined, value: number) => void;
}) {
  const labelId = useId();
  const choices: { id?: string; name: string; quantity: number }[] = [
    ...(unspecified > 0 ? [{ name: '味指定なし', quantity: unspecified }] : []),
    ...flavors.map((flavor) => ({
      ...flavor,
      quantity: quantities[flavor.id] ?? 0,
    })),
  ];
  const [selectedId, setSelectedId] = useState(
    () => choices.find((choice) => choice.quantity > 0)?.id ?? choices[0]?.id,
  );
  const selected =
    choices.find((choice) => choice.id === selectedId) ?? choices[0];
  const total = choices.reduce((sum, choice) => sum + choice.quantity, 0);
  return (
    <div className={`product product-${index}`}>
      <div className="product-name">
        <div className="product-title">
          {index < 9 && <kbd className="product-key">{index + 1}</kbd>}
          <strong>{product.name}</strong>
          {remaining !== undefined && (
            <span
              className={`product-stock ${remaining <= LOW_STOCK ? 'stock-low' : ''}`}
            >
              残り {remaining}本{inconsistent ? '・在庫を確認' : ''}
            </span>
          )}
        </div>
        <small>{yen(getUnitPrice(product, price))}</small>
      </div>
      <div className="product-flavors">
        <Select
          label={`${product.name}の味`}
          value={selected.id ?? ''}
          options={choices.map((choice) => ({
            value: choice.id ?? '',
            label: choice.name,
          }))}
          onChange={(id) => setSelectedId(id || undefined)}
          floating
        />
        <div
          className="product-flavor-summary"
          aria-label={`${product.name}の味別本数`}
          tabIndex={total > 0 ? 0 : undefined}
        >
          {choices
            .filter((choice) => choice.quantity > 0)
            .map((choice) => (
              <span key={choice.id ?? 'unspecified'}>
                {choice.name} {choice.quantity}本
              </span>
            ))}
        </div>
        <div
          className="flavor-counter"
          role="group"
          aria-label={`${product.name} ${selected.name}`}
        >
          <span className="sr-only" id={labelId}>
            {selected.name}
          </span>
          <div className="stepper">
            <IconButton
              variant="secondary"
              icon="minus"
              label={`${product.name}を1本減らす`}
              disabled={!selected.quantity}
              onClick={() => onChange(selected.id, selected.quantity - 1)}
            />
            <div className="quantity-input">
              <input
                aria-label={`${product.name}の本数`}
                aria-describedby={labelId}
                type="number"
                min={0}
                max={available - total + selected.quantity}
                value={selected.quantity}
                onChange={(event) =>
                  onChange(selected.id, Number(event.target.value))
                }
              />
            </div>
            <IconButton
              variant="secondary"
              className="increase"
              icon="plus"
              label={`${product.name}を1本増やす`}
              data-product-key={index < 9 ? index + 1 : undefined}
              aria-keyshortcuts={index < 9 ? String(index + 1) : undefined}
              disabled={total >= available}
              onClick={() => onChange(selected.id, selected.quantity + 1)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
