import { useEffect, useState } from 'react';
import type { Snapshot } from '../domain/model';
import { findActivePrice } from '../domain/catalog';
import { MAX_TICKETS } from '../domain/constants';
import type { Shared } from '../ui';
import type { Cashier } from '../application/ports';
import { DataPanel } from './DataPanel';
import { MenuSettings } from './MenuSettings';
import { Button } from './controls';
export function Settings({
  snapshot,
  store,
  onRestart,
  hasDraft,
  onDirtyChange,
  ...shared
}: Shared & {
  snapshot: Snapshot;
  store: Cashier;
  onRestart: () => void;
  hasDraft: boolean;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const active = findActivePrice(snapshot)!;
  const [tickets, setTickets] = useState(String(snapshot.meta.ticketCount));
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [saved, setSaved] = useState('');
  const [menuDirty, setMenuDirty] = useState(false);
  const operationDirty = tickets !== String(snapshot.meta.ticketCount);
  const dirty = menuDirty || operationDirty;
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  return (
    <section className="panel settings">
      <h2>設定</h2>
      <div className="settings-content">
        <section aria-label="商品・価格">
          <h3>商品・価格</h3>
          <MenuSettings
            key={snapshot.meta.day}
            active={active}
            snapshot={snapshot}
            onDirtyChange={setMenuDirty}
            {...shared}
          />
        </section>
        <section aria-label="バックアップ・日付・番号札">
          <DataPanel
            store={store}
            snapshot={snapshot}
            perform={shared.perform}
            errorMessage={shared.errorMessage}
            onRestart={onRestart}
            hasDraft={hasDraft || dirty}
          />
          <section className="operation-section">
            <h3>番号札</h3>
            <form
              className="operation-form"
              onSubmit={(event) => {
                event.preventDefault();
                void shared.perform(async () => {
                  if (tickets !== String(snapshot.meta.ticketCount))
                    await shared.saveCommand({
                      type: 'tickets',
                      count: Number(tickets),
                    });
                  setTickets(String(Number(tickets)));
                  setSaved('保存しました。');
                });
              }}
            >
              <div className="operation-settings">
                <label>
                  番号札の枚数
                  <input
                    type="number"
                    min="1"
                    max={MAX_TICKETS}
                    required
                    value={tickets}
                    onChange={(event) => setTickets(event.target.value)}
                  />
                </label>
              </div>
              <div className="operation-save">
                {operationDirty && (
                  <Button
                    variant="primary"
                    type="submit"
                    disabled={shared.busy}
                  >
                    保存
                  </Button>
                )}
              </div>
            </form>
          </section>
          <section className="operation-section">
            <h3>記録の保護</h3>
            <p className="hint">
              空き容量が少なくなっても、注文の記録を残すための設定です。バックアップのように別のファイルを作る機能ではありません。
            </p>
            <Button
              onClick={() =>
                shared.perform(async () => {
                  if (!navigator.storage?.persist)
                    throw new Error(
                      'このブラウザでは記録の保護を設定できません。',
                    );
                  setPersisted(await navigator.storage.persist());
                })
              }
            >
              記録を保護する
            </Button>
            {persisted !== null && (
              <p role="status">
                {persisted
                  ? '記録の保護が有効です。'
                  : '記録の保護は許可されませんでした。バックアップを保存してください。'}
              </p>
            )}
          </section>
        </section>
        <p className="sr-only" role="status">
          {saved}
        </p>
      </div>
    </section>
  );
}
