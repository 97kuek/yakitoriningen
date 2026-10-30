import { useState } from 'react';
import { normalPrice, priceSchema } from '../domain/model';
import { newId } from '../lib/id';
import { yen } from '../presentation/format';

import type { Price, Snapshot } from '../domain/model';
import type { Shared } from '../ui';
import type { Cashier } from '../application/ports';
import { DataPanel } from './DataPanel';
import { Icon } from './Icon';
export function Settings({
  snapshot,
  store,
  onRestored,
  onVerified,
  ...shared
}: Shared & {
  snapshot: Snapshot;
  store: Cashier;
  onRestored: () => void;
  onVerified: (s: Snapshot) => void;
}) {
  const active = snapshot.prices.find(
    (p) => p.id === snapshot.meta.activePriceId,
  )!;
  const [price, setPrice] = useState<Price>(active);
  const [day, setDay] = useState(snapshot.meta.day);
  const [tickets, setTickets] = useState(snapshot.meta.ticketCount);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  return (
    <section className="panel settings">
      <h2>
        <Icon name="settings" />
        設定
      </h2>
      <div className="settings-grid">
        <section>
          <h3>価格</h3>
          <p>
            適用中：{active.label} / 1本{yen(active.unit)}
          </p>
          <div className="actions">
            <button
              className="secondary"
              onClick={() => setPrice(normalPrice(newId()))}
            >
              通常 150円・5本600円
            </button>
            <button
              className="secondary"
              onClick={() =>
                setPrice({
                  ...normalPrice(newId()),
                  label: '値下げ',
                  unit: 50,
                  bundleEnabled: false,
                })
              }
            >
              値下げ 1本50円
            </button>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void shared.act(() =>
                shared.run({
                  type: 'price',
                  price: priceSchema.parse({ ...price, id: newId() }),
                }),
              );
            }}
          >
            <label>
              価格名
              <input
                required
                maxLength={40}
                value={price.label}
                onChange={(e) => setPrice({ ...price, label: e.target.value })}
              />
            </label>
            <label>
              単品の価格（円）
              <input
                type="number"
                min="0"
                max="100000000"
                required
                value={price.unit}
                onChange={(e) =>
                  setPrice({ ...price, unit: Number(e.target.value) })
                }
              />
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={price.bundleEnabled}
                onChange={(e) =>
                  setPrice({ ...price, bundleEnabled: e.target.checked })
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
                  value={price.bundleSize}
                  onChange={(e) =>
                    setPrice({ ...price, bundleSize: Number(e.target.value) })
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
                  value={price.bundlePrice}
                  onChange={(e) =>
                    setPrice({ ...price, bundlePrice: Number(e.target.value) })
                  }
                />
              </label>
            </div>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={price.mix}
                onChange={(e) => setPrice({ ...price, mix: e.target.checked })}
              />
              セット内で種類を混ぜられる
            </label>
            <button className="primary">
              <Icon name="check" />
              価格を保存する
            </button>
            <p className="hint">次の注文から適用します。</p>
          </form>
        </section>
        <section>
          <h3>営業日・番号札</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void shared.act(() => shared.run({ type: 'day', day }));
            }}
          >
            <label>
              切り替え先の営業日
              <input
                type="date"
                value={day}
                required
                onChange={(e) => setDay(e.target.value)}
              />
            </label>
            <p className="hint">未完了注文と未回収札は引き継ぎます。</p>
            <button className="secondary" disabled={day === snapshot.meta.day}>
              営業日を切り替える
            </button>
          </form>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void shared.act(() =>
                shared.run({ type: 'tickets', count: tickets }),
              );
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
            <button
              className="secondary"
              disabled={tickets === snapshot.meta.ticketCount}
            >
              札の範囲を保存する
            </button>
          </form>
          <details className="storage-settings">
            <summary>
              <Icon name="shield" />
              保存先の設定
            </summary>
            <p>
              ブラウザの自動削除から保存データを保護するよう要求します。手動削除やPC故障にはバックアップが必要です。
            </p>
            <button
              className="secondary"
              onClick={() =>
                shared.act(async () => {
                  if (!navigator.storage?.persist)
                    throw new Error(
                      'このブラウザでは記録の保護を設定できません。バックアップを保存してください。',
                    );
                  setPersisted(await navigator.storage.persist());
                })
              }
            >
              保存データの保護を要求
            </button>
            {persisted !== null && (
              <p role="status">
                {persisted
                  ? '記録を消えにくくする設定が有効です。'
                  : '記録の保護が許可されませんでした。'}{' '}
                バックアップは必要です。
              </p>
            )}
          </details>
        </section>
      </div>
      <DataPanel
        store={store}
        snapshot={snapshot}
        act={shared.act}
        errorMessage={shared.errorMessage}
        onRestored={onRestored}
        onVerified={onVerified}
      />
    </section>
  );
}
