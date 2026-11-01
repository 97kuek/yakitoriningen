import { useState } from 'react';
import { createMenuDraft, getUnitPrice } from '../domain/catalog';
import { priceSchema } from '../domain/model';
import type { Price, MenuItem } from '../domain/model';
import { newId } from '../lib/id';
import type { Shared } from '../ui';
import { yen } from '../presentation/format';
import { Button, Disclosure, IconButton } from './controls';
import { Icon } from './Icon';
import './MenuSettings.css';

function menuContents(price: Price) {
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
}: { active: Price } & Pick<Shared, 'perform' | 'saveCommand' | 'busy'>) {
  const [draft, setDraft] = useState<Price>(() => createMenuDraft(active));
  const [savedContents, setSavedContents] = useState(() =>
    menuContents(createMenuDraft(active)),
  );
  const [saved, setSaved] = useState('');
  const [modeSaved, setModeSaved] = useState('');
  const current = createMenuDraft(active);
  const dirty = menuContents(draft) !== savedContents;
  const items = draft.items!;
  function editDraft(next: Price) {
    setSaved('');
    setDraft(next);
  }
  function switchMode(discounted: boolean) {
    setModeSaved('');
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
      setModeSaved('切り替えました。');
    });
  }
  function updateItem(id: string, change: Partial<MenuItem>) {
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
        <p className="menu-selling-current">
          販売中：{current.discounted ? '値下げ価格' : '通常価格'}
        </p>
        <ul className="menu-selling-prices" aria-label="販売中の単価">
          {current.items.map((item) => (
            <li key={item.id}>
              {item.name} {yen(getUnitPrice(item, current))}
            </li>
          ))}
        </ul>
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
        <p className="hint menu-selling-note">次の注文から適用します。</p>
        <p className="menu-mode-result" role="status">
          {modeSaved}
        </p>
      </section>
      <form
        className="menu-settings"
        onSubmit={(event) => {
          event.preventDefault();
          void perform(async () => {
            const price = priceSchema.parse({
              ...draft,
              id: newId(),
              discounted: current.discounted,
              label: current.discounted ? '値下げ' : '通常',
              unit: items[0].price,
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
            <Button variant="primary" type="submit" disabled={busy || !dirty}>
              変更を保存
            </Button>
          </div>
          <p className="menu-draft-status" role="status">
            {dirty ? '未保存の変更があります。' : ''}
          </p>
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
                  editDraft({
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
            editDraft({
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
                editDraft({ ...draft, bundleEnabled: event.target.checked })
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
                      editDraft({
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
                    editDraft({
                      ...draft,
                      bundleSize: Number(event.target.value),
                    })
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
                    editDraft({
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
                  editDraft({
                    ...draft,
                    bundleDuringDiscount: event.target.checked,
                  })
                }
              />
              値下げ中もセットを使う
            </label>
          </fieldset>
        </Disclosure>
        <p className="hint">入力中・会計済みの注文は変わりません。</p>
        <p role="status" className="settings-result">
          {saved}
        </p>
      </form>
    </div>
  );
}
