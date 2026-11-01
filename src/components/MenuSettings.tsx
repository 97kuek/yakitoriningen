import { useEffect, useState } from 'react';
import { createMenuDraft, priceLabel } from '../domain/catalog';
import { priceSchema } from '../domain/model';
import type { Price, Snapshot } from '../domain/model';
import {
  menuForm,
  menuPrice,
  menuStock,
  type MenuForm,
} from '../presentation/menu-form';
import {
  stockForDay,
  remainingStock,
  adjustedStock,
} from '../domain/inventory';
import { MAX_STOCK } from '../domain/constants';
import { newId } from '../lib/id';
import type { Shared } from '../ui';
import { Button, Dialog, InlineError } from './controls';
import { MenuFields } from './MenuFields';
import './MenuSettings.css';

function menuContents(price: MenuForm) {
  return JSON.stringify({
    items: price.items,
    bundleEnabled: price.bundleEnabled,
    bundleItems: price.bundleItems,
    bundleSize: price.bundleSize,
    bundlePrice: price.bundlePrice,
    bundleDuringDiscount: price.bundleDuringDiscount ?? false,
  });
}

export function MenuSettings({
  active,
  snapshot,
  perform,
  saveCommand,
  busy,
  onDirtyChange,
  errorMessage,
}: {
  active: Price;
  snapshot: Snapshot;
  onDirtyChange: (dirty: boolean) => void;
} & Pick<Shared, 'perform' | 'saveCommand' | 'busy' | 'errorMessage'>) {
  const [draft, setDraft] = useState<MenuForm>(() =>
    menuForm(active, stockForDay(snapshot)),
  );
  const [savedContents, setSavedContents] = useState(() =>
    menuContents(menuForm(active, stockForDay(snapshot))),
  );
  const [saved, setSaved] = useState('');
  const [adjusting, setAdjusting] = useState<string | null>(null);
  const [direction, setDirection] = useState<'add' | 'discard'>('add');
  const [quantity, setQuantity] = useState('');
  const current = createMenuDraft(active);
  const dirty = menuContents(draft) !== savedContents;
  const storedContents = menuContents(menuForm(active, stockForDay(snapshot)));
  useEffect(() => {
    if (!dirty) {
      setDraft(menuForm(active, stockForDay(snapshot)));
      setSavedContents(storedContents);
    }
  }, [storedContents]);
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  function editDraft(next: MenuForm) {
    setSaved('');
    setDraft(next);
  }
  function switchMode(discounted: boolean) {
    void perform(async () => {
      // Only the committed catalog belongs to a selling-mode change.
      const price = priceSchema.parse({
        ...current,
        id: newId(),
        discounted,
        label: priceLabel(discounted),
        unit: current.items[0].price,
      });
      await saveCommand({ type: 'price', price });
    });
  }
  return (
    <div className="menu-pricing-settings">
      <section
        className="menu-selling-settings"
        aria-label="販売価格の切り替え"
      >
        <div className="menu-selling-actions">
          <Button
            disabled={busy || !current.discounted}
            aria-pressed={!current.discounted}
            aria-label="通常価格に切り替える"
            onClick={() => switchMode(false)}
          >
            通常価格
          </Button>
          <Button
            disabled={busy || current.discounted}
            aria-pressed={current.discounted}
            aria-label="値下げ価格に切り替える"
            onClick={() => switchMode(true)}
          >
            値下げ価格
          </Button>
        </div>
      </section>
      <form
        className="menu-settings"
        onSubmit={(event) => {
          event.preventDefault();
          void perform(async () => {
            const price = menuPrice({
              ...draft,
              id: newId(),
              discounted: current.discounted,
              label: priceLabel(current.discounted),
              mix: true,
            });
            await saveCommand({
              type: 'catalog',
              price,
              stock: menuStock(draft),
            });
            setSavedContents(menuContents(draft));
            setSaved('保存しました。');
          });
        }}
      >
        <MenuFields
          draft={draft}
          onChange={editDraft}
          onAdjustStock={(id) => {
            if (dirty) {
              void perform(async () => {
                throw new Error('先に入力中の商品・在庫を保存してください。');
              });
              return;
            }
            setAdjusting(id);
            setDirection('add');
            setQuantity('');
          }}
          actions={
            <Button variant="primary" type="submit" disabled={busy || !dirty}>
              変更を保存
            </Button>
          }
        />
        <span className="sr-only" role="status">
          {dirty ? '未保存の変更があります。' : saved}
        </span>
      </form>
      <Dialog
        open={adjusting !== null}
        onClose={() => setAdjusting(null)}
        title={`${draft.items.find((item) => item.id === adjusting)?.name ?? '商品'}の在庫を調整`}
      >
        <InlineError message={errorMessage} />
        <form
          className="stock-adjustment"
          onSubmit={(event) => {
            event.preventDefault();
            if (!adjusting || dirty) return;
            void perform(async () => {
              const change = Number(quantity) * (direction === 'add' ? 1 : -1);
              adjustedStock(snapshot, adjusting, change);
              await saveCommand({
                type: 'adjustStock',
                productId: adjusting,
                change,
              });
              setAdjusting(null);
            });
          }}
        >
          <p>現在 {adjusting ? remainingStock(snapshot)[adjusting] : 0}本</p>
          <div className="stock-direction" role="group" aria-label="調整方法">
            <Button
              aria-pressed={direction === 'add'}
              onClick={() => setDirection('add')}
            >
              追加
            </Button>
            <Button
              aria-pressed={direction === 'discard'}
              onClick={() => setDirection('discard')}
            >
              廃棄
            </Button>
          </div>
          <label>
            調整する本数
            <input
              type="number"
              min="1"
              max={MAX_STOCK}
              required
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              inputMode="numeric"
            />
          </label>
          <Button type="submit" variant="primary" disabled={busy || !quantity}>
            調整を記録
          </Button>
        </form>
      </Dialog>
    </div>
  );
}
