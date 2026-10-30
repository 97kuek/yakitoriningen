import { useState } from 'react';
import { createMenuDraft } from '../domain/catalog';
import { priceSchema } from '../domain/model';
import type { Price, MenuItem } from '../domain/model';
import { newId } from '../lib/id';
import type { Shared } from '../ui';
import { Button, Disclosure, IconButton } from './controls';
import { Icon } from './Icon';

export function MenuSettings({
  active,
  perform,
  saveCommand,
}: { active: Price } & Pick<Shared, 'perform' | 'saveCommand'>) {
  const [draft, setDraft] = useState<Price>(() => createMenuDraft(active));
  const [saved, setSaved] = useState('');
  const items = draft.items!;
  function updateItem(id: string, change: Partial<MenuItem>) {
    setSaved('');
    setDraft({
      ...draft,
      items: items.map((item) =>
        item.id === id ? { ...item, ...change } : item,
      ),
    });
  }
  return (
    <form
      className="menu-settings"
      onSubmit={(event) => {
        event.preventDefault();
        void perform(async () => {
          const price = priceSchema.parse({
            ...draft,
            id: newId(),
            label: draft.discounted ? '値下げ' : '通常',
            unit: items[0].price,
            mix: true,
          });
          await saveCommand({ type: 'price', price });
          setSaved('商品と価格を保存しました。次の注文から使います。');
        });
      }}
    >
      <div className="menu-setting-heading">
        <h3>商品と価格</h3>
        <span className="muted">
          販売中：
          {active.discounted || (active.unit === 50 && !active.items)
            ? '値下げ価格'
            : '通常価格'}
        </span>
      </div>
      <div className="menu-columns" aria-hidden="true">
        <span>商品名</span>
        <span>通常価格（円）</span>
        <span>値下げ価格（円）</span>
        <span />
      </div>
      <div className="menu-rows">
        {items.map((item, index) => (
          <div className="menu-row" key={item.id}>
            <input
              aria-label={`商品${index + 1}の名前`}
              value={item.name}
              maxLength={40}
              required
              onChange={(event) =>
                updateItem(item.id, { name: event.target.value })
              }
            />
            <label>
              <span className="mobile-field-label">通常価格（円）</span>
              <input
                aria-label={`${item.name || `商品${index + 1}`}の通常価格（円）`}
                type="number"
                min="0"
                max="100000000"
                required
                value={item.price}
                onChange={(event) =>
                  updateItem(item.id, { price: Number(event.target.value) })
                }
              />
            </label>
            <label>
              <span className="mobile-field-label">値下げ価格（円）</span>
              <input
                aria-label={`${item.name || `商品${index + 1}`}の値下げ価格（円）`}
                type="number"
                min="0"
                max="100000000"
                required
                value={item.discountPrice}
                onChange={(event) =>
                  updateItem(item.id, {
                    discountPrice: Number(event.target.value),
                  })
                }
              />
            </label>
            <IconButton
              icon="minus"
              label={`${item.name || '商品'}を削除`}
              disabled={items.length <= 1}
              onClick={() => {
                setSaved('');
                setDraft({
                  ...draft,
                  items: items.filter((other) => other.id !== item.id),
                  bundleItems: draft.bundleItems?.filter(
                    (id) => id !== item.id,
                  ),
                });
              }}
            />
          </div>
        ))}
      </div>
      <Button
        className="add-menu-item"
        disabled={items.length >= 30}
        onClick={() => {
          setSaved('');
          setDraft({
            ...draft,
            items: [
              ...items,
              { id: newId(), name: '', price: 150, discountPrice: 50 },
            ],
          });
        }}
      >
        <Icon name="plus" />
        商品を追加
      </Button>
      <Disclosure title="セット価格">
        <label className="checkbox">
          <input
            type="checkbox"
            checked={draft.bundleEnabled}
            onChange={(event) =>
              setDraft({ ...draft, bundleEnabled: event.target.checked })
            }
          />
          セット価格を使う
        </label>
        <fieldset className="bundle-settings" disabled={!draft.bundleEnabled}>
          <legend>セットにできる商品</legend>
          <div className="bundle-item-options">
            {items.map((item) => (
              <label className="checkbox" key={item.id}>
                <input
                  type="checkbox"
                  checked={draft.bundleItems?.includes(item.id) ?? false}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      bundleItems: event.target.checked
                        ? [...(draft.bundleItems ?? []), item.id]
                        : draft.bundleItems?.filter((id) => id !== item.id),
                    })
                  }
                />
                {item.name || '名前未入力'}
              </label>
            ))}
          </div>
          <div className="form-row">
            <label>
              セットの本数
              <input
                aria-label="セットの本数"
                type="number"
                min="1"
                max="999"
                required
                value={draft.bundleSize}
                onChange={(event) =>
                  setDraft({ ...draft, bundleSize: Number(event.target.value) })
                }
              />
            </label>
            <label>
              セットの価格（円）
              <input
                type="number"
                min="0"
                max="100000000"
                required
                value={draft.bundlePrice}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    bundlePrice: Number(event.target.value),
                  })
                }
              />
            </label>
          </div>
          <p className="hint">
            選んだ商品から組合せ自由。単品より安くなる場合に使います。
          </p>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={draft.bundleDuringDiscount ?? false}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  bundleDuringDiscount: event.target.checked,
                })
              }
            />
            値下げ中もセットを使う
          </label>
        </fieldset>
      </Disclosure>
      <div className="selling-mode">
        <span>使う価格</span>
        <Button
          aria-pressed={!draft.discounted}
          onClick={() => setDraft({ ...draft, discounted: false })}
        >
          通常価格
        </Button>
        <Button
          aria-pressed={!!draft.discounted}
          onClick={() => setDraft({ ...draft, discounted: true })}
        >
          値下げ価格
        </Button>
      </div>
      <div className="setting-save">
        <Button variant="primary" type="submit">
          変更を保存
        </Button>
        <span className="hint">入力中・会計済みの注文は変わりません。</span>
      </div>
      <p role="status" className="settings-result">
        {saved}
      </p>
    </form>
  );
}
