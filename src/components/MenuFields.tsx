import type { ReactNode } from 'react';
import {
  DEFAULT_DISCOUNT_PRICE,
  DEFAULT_UNIT_PRICE,
  MAX_BUNDLE_SIZE,
  MAX_MONEY,
  MAX_PRODUCT_NAME_LENGTH,
  MAX_PRODUCTS,
  MAX_STOCK,
} from '../domain/constants';
import type { MenuForm } from '../presentation/menu-form';
import { newId } from '../lib/id';
import { IconButton } from './controls';
import './MenuSettings.css';

/** Shared fields for editing the live menu or preparing the next event. */
export function MenuFields({
  draft,
  onChange: editDraft,
  actions,
}: {
  draft: MenuForm;
  onChange: (next: MenuForm) => void;
  actions?: ReactNode;
}) {
  const items = draft.items;
  function updateItem(id: string, change: Partial<MenuForm['items'][number]>) {
    editDraft({
      ...draft,
      items: items.map((item) =>
        item.id === id ? { ...item, ...change } : item,
      ),
    });
  }
  return (
    <>
      <div className="menu-editor-toolbar">
        <div className="menu-setting-heading">
          <h3>商品・価格・在庫</h3>
          <div className="menu-editor-actions">
            <IconButton
              icon="plus"
              label="商品を追加"
              className="add-menu-item"
              disabled={items.length >= MAX_PRODUCTS}
              onClick={() => {
                editDraft({
                  ...draft,
                  items: [
                    ...items,
                    {
                      id: newId(),
                      name: '',
                      price: String(DEFAULT_UNIT_PRICE),
                      discountPrice: String(DEFAULT_DISCOUNT_PRICE),
                      stock: '',
                    },
                  ],
                });
              }}
            />
            {actions}
          </div>
        </div>
      </div>
      <div className="menu-columns" aria-hidden="true">
        <span />
        <span className="menu-name-headings">
          <span>セット対象</span>
          <span>商品名</span>
        </span>
        <span>通常価格</span>
        <span>値下げ価格</span>
        <span>在庫数</span>
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
                maxLength={MAX_PRODUCT_NAME_LENGTH}
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
                max={MAX_MONEY}
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
                max={MAX_MONEY}
                required
                value={item.discountPrice}
                onChange={(event) =>
                  updateItem(item.id, {
                    discountPrice: event.target.value,
                  })
                }
              />
            </label>
            <div className="menu-stock-field">
              <span className="mobile-field-label">在庫（任意）</span>
              <input
                aria-label={`${item.name || `商品${index + 1}`}の在庫`}
                type="number"
                min="0"
                max={MAX_STOCK}
                placeholder="未登録"
                value={item.stock ?? ''}
                onChange={(event) =>
                  updateItem(item.id, { stock: event.target.value })
                }
              />
            </div>
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
                max={MAX_BUNDLE_SIZE}
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
                max={MAX_MONEY}
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
    </>
  );
}
