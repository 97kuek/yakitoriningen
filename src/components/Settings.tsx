import { useEffect, useState } from 'react';
import { dateSchema, type Snapshot } from '../domain/model';
import { yen } from '../presentation/format';
import type { Shared } from '../ui';
import type { Cashier } from '../application/ports';
import { DataPanel } from './DataPanel';
import { MenuSettings } from './MenuSettings';
import { Button } from './controls';
export type SettingsSection = 'price' | 'expenses' | 'backup';
export function Settings({
  snapshot,
  store,
  onRestored,
  onVerified,
  section,
  onSectionChange,
  hasDraft,
  onDirtyChange,
  ...shared
}: Shared & {
  snapshot: Snapshot;
  store: Cashier;
  onRestored: () => void;
  onVerified: (snapshot: Snapshot) => void;
  section: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
  hasDraft: boolean;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const active = snapshot.prices.find(
    (price) => price.id === snapshot.meta.activePriceId,
  )!;
  const [day, setDay] = useState(snapshot.meta.day);
  const [tickets, setTickets] = useState(String(snapshot.meta.ticketCount));
  const [expense, setExpense] = useState(
    snapshot.meta.expenseTotal == null
      ? ''
      : String(snapshot.meta.expenseTotal),
  );
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [saved, setSaved] = useState('');
  const [menuDirty, setMenuDirty] = useState(false);
  const dirty =
    menuDirty ||
    day !== snapshot.meta.day ||
    tickets !== String(snapshot.meta.ticketCount) ||
    expense !==
      (snapshot.meta.expenseTotal == null
        ? ''
        : String(snapshot.meta.expenseTotal));
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  return (
    <section className="panel settings">
      <h2>設定</h2>
      <nav className="settings-nav" aria-label="設定の項目">
        {(
          [
            { key: 'price', label: '商品・価格' },
            { key: 'expenses', label: '経費' },
            { key: 'backup', label: '記録・その他' },
          ] as const
        ).map((item) => (
          <Button
            variant="plain"
            key={item.key}
            aria-pressed={section === item.key}
            className={section === item.key ? 'active' : ''}
            onClick={() => {
              onSectionChange(item.key);
              setSaved('');
            }}
          >
            {item.label}
          </Button>
        ))}
      </nav>
      <div className="settings-content">
        <section hidden={section !== 'price'}>
          <MenuSettings
            active={active}
            onDirtyChange={setMenuDirty}
            {...shared}
          />
        </section>
        <section hidden={section !== 'expenses'}>
          <h3>開催回全体の経費</h3>
          <p className="setting-current">
            仕入れ・備品など、この開催回で使った金額の合計です。
          </p>
          <form
            className="setting-form expense-form"
            onSubmit={(event) => {
              event.preventDefault();
              void shared.perform(async () => {
                await shared.saveCommand({
                  type: 'expense',
                  amount: Number(expense),
                });
                setExpense(String(Number(expense)));
                setSaved('経費を保存しました。');
              });
            }}
          >
            <label>
              開催回全体の経費（円）
              <input
                type="number"
                min="0"
                max="100000000"
                required
                value={expense}
                onChange={(event) => setExpense(event.target.value)}
                placeholder="未登録"
              />
            </label>
            <p className="hint">
              現在：
              {snapshot.meta.expenseTotal == null
                ? '未登録'
                : yen(snapshot.meta.expenseTotal)}
              。0円の場合も登録してください。
            </p>
            <Button variant="primary" type="submit" disabled={expense === ''}>
              経費を保存
            </Button>
          </form>
        </section>
        <section hidden={section !== 'backup'}>
          <DataPanel
            store={store}
            snapshot={snapshot}
            perform={shared.perform}
            errorMessage={shared.errorMessage}
            onRestored={onRestored}
            onVerified={onVerified}
            hasDraft={hasDraft}
          />
          <section className="operation-section">
            <h3>日付・番号札</h3>
            <form
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
              記録の自動削除を防ぐ
            </Button>
            {persisted !== null && (
              <p role="status">
                {persisted
                  ? '記録の保護が有効です。'
                  : '記録の保護は許可されませんでした。記録を保存してください。'}
              </p>
            )}
          </section>
        </section>
        <p className="settings-result" role="status">
          {saved}
        </p>
      </div>
    </section>
  );
}
