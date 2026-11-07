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
import { DigitsInput, IconButton } from './controls';
import { FlavorFields } from './FlavorFields';
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
              <DigitsInput
                aria-label={`${item.name || `商品${index + 1}`}の通常価格（円）`}
                min={0}
                max={MAX_MONEY}
                required
                value={item.price}
                onValueChange={(value) => updateItem(item.id, { price: value })}
              />
            </label>
            <label>
              <span className="mobile-field-label">値下げ価格</span>
              <DigitsInput
                aria-label={`${item.name || `商品${index + 1}`}の値下げ価格（円）`}
                min={0}
                max={MAX_MONEY}
                required
                value={item.discountPrice}
                onValueChange={(value) =>
                  updateItem(item.id, {
                    discountPrice: value,
                  })
                }
              />
            </label>
            <div className="menu-stock-field">
              <span className="mobile-field-label">在庫（任意）</span>
              <DigitsInput
                aria-label={`${item.name || `商品${index + 1}`}の在庫`}
                min={0}
                max={MAX_STOCK}
                placeholder="未登録"
                value={item.stock ?? ''}
                onValueChange={(value) => updateItem(item.id, { stock: value })}
              />
            </div>
          </div>
        ))}
      </div>
      <FlavorFields draft={draft} onChange={editDraft} />
      <BundleFields draft={draft} onChange={editDraft} />
    </>
  );
}

function BundleFields({
  draft,
  onChange: editDraft,
}: {
  draft: MenuForm;
  onChange: (next: MenuForm) => void;
}) {
  return (
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
            <DigitsInput
              aria-label="セットの本数"
              min={1}
              max={MAX_BUNDLE_SIZE}
              required
              value={draft.bundleSize}
              onValueChange={(value) =>
                editDraft({
                  ...draft,
                  bundleSize: value,
                })
              }
            />
          </label>
          <label>
            セットの価格
            <DigitsInput
              aria-label="セットの価格（円）"
              min={0}
              max={MAX_MONEY}
              required
              value={draft.bundlePrice}
              onValueChange={(value) =>
                editDraft({
                  ...draft,
                  bundlePrice: value,
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
  );
}
