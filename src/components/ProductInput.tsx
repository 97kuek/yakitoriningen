import { useId } from 'react';
import type { Flavor, MenuItem, Price } from '../domain/model';
import { LOW_STOCK } from '../domain/constants';
import { getUnitPrice } from '../domain/catalog';
import { yen } from '../presentation/format';
import { IconButton } from './controls';

/** All flavor counts remain visible; keyboard shortcuts add the first flavor. */
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
        {choices.map((flavor, flavorIndex) => (
          <div
            className="flavor-counter"
            role="group"
            aria-label={`${product.name} ${flavor.name}`}
            key={flavor.id ?? 'unspecified'}
          >
            <span id={`${labelId}-${flavorIndex}`}>{flavor.name}</span>
            <div className="stepper">
              <IconButton
                variant="secondary"
                icon="minus"
                label={
                  flavorIndex === 0
                    ? `${product.name}を1本減らす`
                    : `${product.name}（${flavor.name}）を1本減らす`
                }
                disabled={!flavor.quantity}
                onClick={() => onChange(flavor.id, flavor.quantity - 1)}
              />
              <div className="quantity-input">
                <input
                  aria-label={
                    flavorIndex === 0
                      ? `${product.name}の本数`
                      : `${product.name}（${flavor.name}）の本数`
                  }
                  aria-describedby={`${labelId}-${flavorIndex}`}
                  type="number"
                  min={0}
                  max={available - total + flavor.quantity}
                  value={flavor.quantity}
                  onChange={(event) =>
                    onChange(flavor.id, Number(event.target.value))
                  }
                />
              </div>
              <IconButton
                variant="secondary"
                className="increase"
                icon="plus"
                label={
                  flavorIndex === 0
                    ? `${product.name}を1本増やす`
                    : `${product.name}（${flavor.name}）を1本増やす`
                }
                data-product-key={
                  flavor.id === flavors[0]?.id && index < 9
                    ? index + 1
                    : undefined
                }
                aria-keyshortcuts={
                  flavor.id === flavors[0]?.id && index < 9
                    ? String(index + 1)
                    : undefined
                }
                disabled={total >= available}
                onClick={() => onChange(flavor.id, flavor.quantity + 1)}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
