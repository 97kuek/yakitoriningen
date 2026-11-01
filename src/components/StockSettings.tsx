import { useEffect, useState } from 'react';
import type { Snapshot } from '../domain/model';
import { MAX_STOCK } from '../domain/constants';
import { findActivePrice, getMenu } from '../domain/catalog';
import { remainingStock, stockForDay } from '../domain/inventory';
import type { Shared } from '../ui';
import { Button } from './controls';

export function StockSettings({
  snapshot,
  onDirtyChange,
  ...shared
}: Shared & {
  snapshot: Snapshot;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const products = getMenu(findActivePrice(snapshot)!);
  const stock = stockForDay(snapshot);
  const remaining = remainingStock(snapshot);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      products.map((p) => [
        p.id,
        stock[p.id] === undefined ? '' : String(stock[p.id]),
      ]),
    ),
  );
  const dirty = products.some(
    (p) =>
      (values[p.id] ?? '') !==
      (stock[p.id] === undefined ? '' : String(stock[p.id])),
  );
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  return (
    <section className="stock-settings" aria-label="当日の在庫">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void shared.perform(() =>
            shared.saveCommand({
              type: 'stock',
              quantities: Object.fromEntries(
                products
                  .filter(
                    (p) => values[p.id] !== '' && values[p.id] !== undefined,
                  )
                  .map((p) => [p.id, Number(values[p.id])]),
              ),
            }),
          );
        }}
      >
        <div className="section-heading">
          <h3>当日の在庫</h3>
          <Button
            type="submit"
            variant="primary"
            disabled={!dirty || shared.busy}
          >
            在庫を保存
          </Button>
        </div>
        <table>
          <thead>
            <tr>
              <th>商品</th>
              <th>用意した本数</th>
              <th>残り</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <th>{p.name}</th>
                <td>
                  <input
                    type="number"
                    min="0"
                    max={MAX_STOCK}
                    placeholder="未登録"
                    aria-label={`${p.name}の在庫`}
                    value={values[p.id] ?? ''}
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        [p.id]: event.target.value,
                      }))
                    }
                  />
                </td>
                <td>
                  {remaining[p.id] === undefined ? '—' : `${remaining[p.id]}本`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="hint">
          追加・廃棄があったら本数を修正。返金では在庫は戻りません。
        </p>
      </form>
    </section>
  );
}
