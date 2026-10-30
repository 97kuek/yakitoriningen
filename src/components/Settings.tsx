import { useState } from 'react';
import { normalPrice, priceSchema } from '../domain/model';
import type { Price, Snapshot } from '../domain/model';
import { newId } from '../lib/id';
import { yen } from '../presentation/format';
import type { Shared } from '../ui';
import type { Cashier } from '../application/ports';
import { DataPanel } from './DataPanel';
export type SettingsSection = 'price' | 'operation' | 'expenses' | 'backup';
export function Settings({
  snapshot,
  store,
  onRestored,
  onVerified,
  initialSection = 'price',
  ...shared
}: Shared & {
  snapshot: Snapshot;
  store: Cashier;
  onRestored: () => void;
  onVerified: (s: Snapshot) => void;
  initialSection?: SettingsSection;
}) {
  const active = snapshot.prices.find(
    (p) => p.id === snapshot.meta.activePriceId,
  )!;
  const [section, setSection] = useState<SettingsSection>(initialSection);
  const [mode, setMode] = useState<'normal' | 'clearance' | 'custom'>(
    active.unit === 150 &&
      active.bundleEnabled &&
      active.bundleSize === 5 &&
      active.bundlePrice === 600 &&
      active.mix
      ? 'normal'
      : active.unit === 50 && !active.bundleEnabled
        ? 'clearance'
        : 'custom',
  );
  const [custom, setCustom] = useState<Price>(active);
  const [day, setDay] = useState(snapshot.meta.day);
  const [tickets, setTickets] = useState(snapshot.meta.ticketCount);
  const [expense, setExpense] = useState(
    snapshot.meta.expenseTotal == null
      ? ''
      : String(snapshot.meta.expenseTotal),
  );
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [saved, setSaved] = useState('');
  const selected =
    mode === 'custom'
      ? custom
      : mode === 'normal'
        ? normalPrice('preview')
        : {
            ...normalPrice('preview'),
            label: '値下げ',
            unit: 50,
            bundleEnabled: false,
          };
  return (
    <section className="panel settings">
      <h2>設定</h2>
      <nav className="settings-nav" aria-label="設定の項目">
        {(
          [
            { key: 'price', label: '価格' },
            { key: 'operation', label: '営業日・札' },
            { key: 'expenses', label: '経費' },
            { key: 'backup', label: 'バックアップ' },
          ] as { key: SettingsSection; label: string }[]
        ).map((item) => (
          <button
            key={item.key}
            className={section === item.key ? 'active' : ''}
            aria-pressed={section === item.key}
            onClick={() => {
              setSection(item.key);
              setSaved('');
            }}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <div className="settings-content">
        <section hidden={section !== 'price'}>
          <h3>販売価格</h3>
          <p className="setting-current">
            使用中：{active.label} / 1本 {yen(active.unit)}
            {active.bundleEnabled &&
              `・${active.bundleSize}本 ${yen(active.bundlePrice)}`}
          </p>
          <div className="price-options">
            <button
              className="secondary"
              aria-pressed={mode === 'normal'}
              onClick={() => setMode('normal')}
            >
              通常 150円・5本600円
            </button>
            <button
              className="secondary"
              aria-pressed={mode === 'clearance'}
              onClick={() => setMode('clearance')}
            >
              値下げ 1本50円
            </button>
            <button
              className="secondary"
              aria-pressed={mode === 'custom'}
              onClick={() => setMode('custom')}
            >
              自由に設定
            </button>
          </div>
          <form
            className="setting-form"
            onSubmit={(e) => {
              e.preventDefault();
              void shared.act(async () => {
                await shared.run({
                  type: 'price',
                  price: priceSchema.parse({ ...selected, id: newId() }),
                });
                setSaved('価格を変更しました。');
              });
            }}
          >
            {mode === 'custom' && (
              <div className="custom-price-fields">
                <div className="form-row">
                  <label>
                    価格名
                    <input
                      required
                      maxLength={40}
                      value={custom.label}
                      onChange={(e) =>
                        setCustom({ ...custom, label: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    単品の価格（円）
                    <input
                      type="number"
                      min="0"
                      max="100000000"
                      required
                      value={custom.unit}
                      onChange={(e) =>
                        setCustom({ ...custom, unit: Number(e.target.value) })
                      }
                    />
                  </label>
                </div>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={custom.bundleEnabled}
                    onChange={(e) =>
                      setCustom({ ...custom, bundleEnabled: e.target.checked })
                    }
                  />
                  安くなる場合にセットを自動適用
                </label>
                <div className="form-row">
                  <label>
                    セット本数
                    <input
                      type="number"
                      min="1"
                      max="999"
                      required
                      value={custom.bundleSize}
                      onChange={(e) =>
                        setCustom({
                          ...custom,
                          bundleSize: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                  <label>
                    セット価格（円）
                    <input
                      type="number"
                      min="0"
                      max="100000000"
                      required
                      value={custom.bundlePrice}
                      onChange={(e) =>
                        setCustom({
                          ...custom,
                          bundlePrice: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                </div>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={custom.mix}
                    onChange={(e) =>
                      setCustom({ ...custom, mix: e.target.checked })
                    }
                  />
                  セット内で種類を混ぜられる
                </label>
              </div>
            )}
            <div className="price-preview">
              <span>これから使う価格</span>
              <strong>
                1本 {yen(selected.unit)}
                {selected.bundleEnabled &&
                  ` / ${selected.bundleSize}本 ${yen(selected.bundlePrice)}`}
              </strong>
            </div>
            <button className="primary">この価格を使う</button>
            <p className="hint">
              次の注文から適用します。入力中の金額は変えません。
            </p>
          </form>
        </section>
        <section hidden={section !== 'operation'}>
          <h3>営業日と番号札</h3>
          <div className="operation-settings">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void shared.act(async () => {
                  await shared.run({ type: 'day', day });
                  setSaved('営業日を変更しました。');
                });
              }}
            >
              <label>
                切り替え先の営業日
                <input
                  type="date"
                  required
                  value={day}
                  onChange={(e) => setDay(e.target.value)}
                />
              </label>
              <p className="hint">未完了注文と未回収札は引き継ぎます。</p>
              <button
                className="secondary"
                disabled={day === snapshot.meta.day}
              >
                営業日を切り替える
              </button>
            </form>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void shared.act(async () => {
                  await shared.run({ type: 'tickets', count: tickets });
                  setSaved('札の枚数を変更しました。');
                });
              }}
            >
              <label>
                番号札の枚数（1から連番）
                <input
                  type="number"
                  min="1"
                  max="100"
                  required
                  value={tickets}
                  onChange={(e) => setTickets(Number(e.target.value))}
                />
              </label>
              <p className="hint">使用中の札をなくす変更はできません。</p>
              <button
                className="secondary"
                disabled={tickets === snapshot.meta.ticketCount}
              >
                札の枚数を変更
              </button>
            </form>
          </div>
        </section>
        <section hidden={section !== 'expenses'}>
          <h3>開催回全体の経費</h3>
          <p className="setting-current">
            仕入れ・備品など、この開催回で使った金額の合計を登録します。
          </p>
          <form
            className="setting-form expense-form"
            onSubmit={(e) => {
              e.preventDefault();
              void shared.act(async () => {
                await shared.run({ type: 'expense', amount: Number(expense) });
                setSaved('経費を保存しました。売上画面に利益が表示されます。');
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
                onChange={(e) => setExpense(e.target.value)}
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
            <button className="primary" disabled={expense === ''}>
              経費を保存
            </button>
          </form>
        </section>
        <section hidden={section !== 'backup'}>
          <DataPanel
            store={store}
            snapshot={snapshot}
            act={shared.act}
            errorMessage={shared.errorMessage}
            onRestored={onRestored}
            onVerified={onVerified}
          />
          <details className="storage-settings">
            <summary>記録を消えにくくする設定</summary>
            <p className="hint">
              手動での削除やPC故障にはバックアップが必要です。
            </p>
            <button
              className="secondary"
              onClick={() =>
                shared.act(async () => {
                  if (!navigator.storage?.persist)
                    throw new Error(
                      'このブラウザでは記録の保護を設定できません。',
                    );
                  setPersisted(await navigator.storage.persist());
                })
              }
            >
              記録の保護を要求
            </button>
            {persisted !== null && (
              <p role="status">
                {persisted
                  ? '記録の保護が有効です。'
                  : '記録の保護は許可されませんでした。バックアップを保存してください。'}
              </p>
            )}
          </details>
        </section>
        <p className="settings-result" role="status">
          {saved}
        </p>
      </div>
    </section>
  );
}
