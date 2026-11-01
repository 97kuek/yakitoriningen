import { useEffect, useState } from 'react';
import { createMenuDraft } from '../domain/catalog';
import { priceSchema } from '../domain/model';
import type { Price } from '../domain/model';
import { menuForm, menuPrice, type MenuForm } from '../presentation/menu-form';
import { newId } from '../lib/id';
import type { Shared } from '../ui';
import { Button, IconButton } from './controls';
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
  perform,
  saveCommand,
  busy,
  onDirtyChange,
}: { active: Price; onDirtyChange: (dirty: boolean) => void } & Pick<
  Shared,
  'perform' | 'saveCommand' | 'busy'
>) {
  const [draft, setDraft] = useState<MenuForm>(() => menuForm(active));
  const [savedContents, setSavedContents] = useState(() =>
    menuContents(menuForm(active)),
  );
  const [saved, setSaved] = useState('');
  const current = createMenuDraft(active);
  const dirty = menuContents(draft) !== savedContents;
  const items = draft.items!;
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
        label: discounted ? '値下げ' : '通常',
        unit: current.items[0].price,
      });
      await saveCommand({ type: 'price', price });
    });
  }
  function updateItem(id: string, change: Partial<MenuForm['items'][number]>) {
    editDraft({
      ...draft,
      items: items.map((item) =>
        item.id === id ? { ...item, ...change } : item,
      ),
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
              label: current.discounted ? '値下げ' : '通常',
              mix: true,
            });
            await saveCommand({ type: 'price', price });
            setSavedContents(menuContents(draft));
            setSaved('保存しました。');
          });
        }}
      >
        <div className="menu-editor-toolbar">
          <div className="menu-setting-heading">
            <h3>商品・セットの編集</h3>
            <div className="menu-editor-actions">
              <IconButton
                icon="plus"
                label="商品を追加"
                className="add-menu-item"
                disabled={items.length >= 30}
                onClick={() => {
                  editDraft({
                    ...draft,
                    items: [
                      ...items,
                      {
                        id: newId(),
                        name: '',
                        price: '150',
                        discountPrice: '50',
                      },
                    ],
                  });
                }}
              />
              <Button variant="primary" type="submit" disabled={busy || !dirty}>
                変更を保存
              </Button>
            </div>
          </div>
          <span className="sr-only" role="status">
            {dirty ? '未保存の変更があります。' : saved}
          </span>
        </div>
        <div className="menu-columns" aria-hidden="true">
          <span />
          <span>セット対象・商品名</span>
          <span>通常価格</span>
          <span>値下げ価格</span>
        </div>
        <div className="menu-rows">
          {items.map((item, index) => (
            <div className="menu-row" key={item.id}>
              <IconButton
                icon="minus"
                label={`${item.name || '商品'}を削除`}
                disabled={items.length <= 1}
                onClick={() => {
                  editDraft({
                    ...draft,
                    items: items.filter((other) => other.id !== item.id),
                    bundleItems: draft.bundleItems?.filter(
                      (id) => id !== item.id,
                    ),
                  });
                }}
              />
              <div className="menu-item-name">
                <input
                  type="checkbox"
                  aria-label={`${item.name || `商品${index + 1}`}をセット対象にする`}
                  checked={draft.bundleItems?.includes(item.id) ?? false}
                  onChange={(event) =>
                    editDraft({
                      ...draft,
                      bundleItems: event.target.checked
                        ? [...(draft.bundleItems ?? []), item.id]
                        : draft.bundleItems?.filter((id) => id !== item.id),
                    })
                  }
                />
                <input
                  aria-label={`商品${index + 1}の名前`}
                  value={item.name}
                  maxLength={40}
                  required
                  onChange={(event) =>
                    updateItem(item.id, { name: event.target.value })
                  }
                />
              </div>
              <label>
                <span className="mobile-field-label">通常価格</span>
                <input
                  aria-label={`${item.name || `商品${index + 1}`}の通常価格（円）`}
                  type="number"
                  min="0"
                  max="100000000"
                  required
                  value={item.price}
                  onChange={(event) =>
                    updateItem(item.id, { price: event.target.value })
                  }
                />
              </label>
              <label>
                <span className="mobile-field-label">値下げ価格</span>
                <input
                  aria-label={`${item.name || `商品${index + 1}`}の値下げ価格（円）`}
                  type="number"
                  min="0"
                  max="100000000"
                  required
                  value={item.discountPrice}
                  onChange={(event) =>
                    updateItem(item.id, {
                      discountPrice: event.target.value,
                    })
                  }
                />
              </label>
            </div>
          ))}
        </div>
        <section className="bundle-section">
          <h3>セット価格</h3>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={draft.bundleEnabled}
              onChange={(event) =>
                editDraft({ ...draft, bundleEnabled: event.target.checked })
              }
            />
            セット価格を使う
          </label>
          <fieldset className="bundle-settings" disabled={!draft.bundleEnabled}>
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
                    editDraft({
                      ...draft,
                      bundleSize: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                セットの価格
                <input
                  aria-label="セットの価格（円）"
                  type="number"
                  min="0"
                  max="100000000"
                  required
                  value={draft.bundlePrice}
                  onChange={(event) =>
                    editDraft({
                      ...draft,
                      bundlePrice: event.target.value,
                    })
                  }
                />
              </label>
            </div>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={draft.bundleDuringDiscount ?? false}
                onChange={(event) =>
                  editDraft({
                    ...draft,
                    bundleDuringDiscount: event.target.checked,
                  })
                }
              />
              値下げ中もセットを使う
            </label>
          </fieldset>
        </section>
      </form>
    </div>
  );
}
