import { useEffect, useState } from 'react';
import { dateSchema, type Snapshot } from '../domain/model';
import type { Shared } from '../ui';
import type { Cashier } from '../application/ports';
import { DataPanel } from './DataPanel';
import { MenuSettings } from './MenuSettings';
import { Button } from './controls';
export function Settings({
  snapshot,
  store,
  onRestored,
  hasDraft,
  onDirtyChange,
  ...shared
}: Shared & {
  snapshot: Snapshot;
  store: Cashier;
  onRestored: () => void;
  hasDraft: boolean;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const active = snapshot.prices.find(
    (price) => price.id === snapshot.meta.activePriceId,
  )!;
  const [day, setDay] = useState(snapshot.meta.day);
  const [tickets, setTickets] = useState(String(snapshot.meta.ticketCount));
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [saved, setSaved] = useState('');
  const [menuDirty, setMenuDirty] = useState(false);
  const dirty =
    menuDirty ||
    day !== snapshot.meta.day ||
    tickets !== String(snapshot.meta.ticketCount);
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  return (
    <section className="panel settings">
      <h2>設定</h2>
      <div className="settings-content">
        <section aria-label="商品・価格">
          <h3>商品・価格</h3>
          <MenuSettings
            active={active}
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
            onRestored={onRestored}
            hasDraft={hasDraft}
          />
          <section className="operation-section">
            <h3>日付・番号札</h3>
            <form
              className="operation-form"
              onSubmit={(event) => {
                event.preventDefault();
                void shared.perform(async () => {
                  dateSchema.parse(day);
                  if (tickets !== String(snapshot.meta.ticketCount))
                    await shared.saveCommand({
                      type: 'tickets',
                      count: Number(tickets),
                    });
                  if (day !== snapshot.meta.day)
                    await shared.saveCommand({ type: 'day', day });
                  setTickets(String(Number(tickets)));
                  setSaved('保存しました。');
                });
              }}
            >
              <div className="operation-settings">
                <label>
                  会計に記録する日付
                  <input
                    type="date"
                    required
                    value={day}
                    onChange={(event) => setDay(event.target.value)}
                  />
                </label>
                <label>
                  番号札の枚数
                  <input
                    type="number"
                    min="1"
                    max="100"
                    required
                    value={tickets}
                    onChange={(event) => setTickets(event.target.value)}
                  />
                </label>
              </div>
              <div className="operation-save">
                {(day !== snapshot.meta.day ||
                  tickets !== String(snapshot.meta.ticketCount)) && (
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
              このPC内の自動削除を防ぎます。故障に備えるにはバックアップを保存してください。
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
