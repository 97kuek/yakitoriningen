import { useEffect, useState } from 'react';
import { createMenuDraft, priceLabel } from '../domain/catalog';
import { priceSchema } from '../domain/model';
import type { Price } from '../domain/model';
import { menuForm, menuPrice, type MenuForm } from '../presentation/menu-form';
import { newId } from '../lib/id';
import type { Shared } from '../ui';
import { Button } from './controls';
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
            await saveCommand({ type: 'price', price });
            setSavedContents(menuContents(draft));
            setSaved('保存しました。');
          });
        }}
      >
        <MenuFields
          draft={draft}
          onChange={editDraft}
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
    </div>
  );
}
