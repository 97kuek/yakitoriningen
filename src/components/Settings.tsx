import { useEffect, useState } from 'react';
import type { Snapshot } from '../domain/model';
import { findActivePrice } from '../domain/catalog';
import { MAX_TICKETS } from '../domain/constants';
import type { Shared, BackupExporter } from '../ui';
import type { Cashier } from '../application/ports';
import { DataPanel } from './DataPanel';
import { MenuSettings } from './MenuSettings';
import { Button, DigitsInput } from './controls';
import { StorageStatus } from './StorageStatus';
import type { StorageProtection } from '../hooks/useStorageProtection';

const protectionText: Record<StorageProtection, string> = {
  checking: '自動削除の防止を確認しています…',
  protected: '自動削除の防止：有効',
  denied:
    '自動削除の防止は許可されていません。バックアップを保存してください。',
  unavailable:
    '自動削除の防止を設定できません。バックアップを保存してください。',
};
export function Settings({
  protection,
  snapshot,
  store,
  onRestart,
  hasDraft,
  onDirtyChange,
  exportBackup,
  ...shared
}: Shared & {
  protection: StorageProtection;
  snapshot: Snapshot;
  store: Cashier;
  onRestart: () => void;
  hasDraft: boolean;
  onDirtyChange: (dirty: boolean) => void;
  exportBackup: BackupExporter;
}) {
  const active = findActivePrice(snapshot)!;
  const [tickets, setTickets] = useState(String(snapshot.meta.ticketCount));
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
            exportBackup={exportBackup}
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
                  <DigitsInput
                    min={1}
                    max={MAX_TICKETS}
                    required
                    value={tickets}
                    onValueChange={setTickets}
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
            <StorageStatus />
            <p role="status">{protectionText[protection]}</p>
          </section>
        </section>
        <p className="sr-only" role="status">
          {saved}
        </p>
      </div>
    </section>
  );
}
