import { useState } from 'react';
import type { Snapshot } from '../domain/model';
import { MAX_TICKETS } from '../domain/constants';
import { findActivePrice } from '../domain/catalog';
import {
  menuForm,
  menuPrice,
  menuStock,
  type MenuForm,
} from '../presentation/menu-form';
import { MenuFields } from './MenuFields';
import { summarizeSales } from '../domain/sales';
import { pendingOrders } from '../domain/snapshot';
import type { ActionHandler } from '../ui';
import type { Cashier } from '../application/ports';
import {
  encodeBackup,
  MAX_BACKUP_BYTES,
  parseBackup,
} from '../application/backup';
import { dailySnapshot } from '../application/daily-backup';
import { validateDaySetup } from '../domain/day';
import { contextOf } from '../domain/snapshot';
import { newId } from '../lib/id';
import { download } from '../presentation/download';
import { today, yen } from '../presentation/format';
import { Button, Dialog, FilePicker, InlineError } from './controls';
import { Icon } from './Icon';

async function fileText(file: File | undefined) {
  if (!file || file.size > MAX_BACKUP_BYTES)
    throw new Error(
      `保存したバックアップを選んでください。ファイルの上限は${MAX_BACKUP_BYTES / 1_000_000}MBです。`,
    );
  return file.text();
}
export function DataPanel({
  store,
  snapshot,
  perform,
  onRestart,
  errorMessage,
  hasDraft = false,
}: {
  store: Cashier;
  snapshot: Snapshot | null;
  perform: ActionHandler;
  onRestart: () => void;
  errorMessage: string;
  hasDraft?: boolean;
}) {
  const [incoming, setIncoming] = useState<Snapshot | null>(null);
  const [expected, setExpected] = useState<Snapshot | null>(null);
  const [dayBase, setDayBase] = useState<Snapshot | null>(null);
  const [restoreConfirmed, setRestoreConfirmed] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [dayOpen, setDayOpen] = useState(false);
  const [nextDay, setNextDay] = useState(today());
  const [dayMenu, setDayMenu] = useState<MenuForm | null>(null);
  const [dayTickets, setDayTickets] = useState('');
  const incomingSales = incoming ? summarizeSales(incoming.orders) : null;
  return (
    <section className="data-panel" aria-labelledby="backup-heading">
      <h3 id="backup-heading">
        <Icon name="download" />
        バックアップ
      </h3>
      {snapshot && (
        <>
          <div className="actions">
            <div className="data-action">
              <Button
                variant="secondary"
                type="button"
                className="secondary"
                onClick={() =>
                  perform(async () => {
                    const current = await store.read();
                    if (!current) throw new Error('営業の記録がありません。');
                    const text = encodeBackup(dailySnapshot(current));
                    parseBackup(await new Blob([text]).text());
                    download(text, `${current.meta.day}-yakitori.json`);
                  })
                }
              >
                <Icon name="download" />
                バックアップを保存
              </Button>
              <p className="hint">営業が終わったら、当日分を保存</p>
            </div>
          </div>
        </>
      )}
      <div className="data-secondary-actions">
        <Button
          variant="secondary"
          type="button"
          className="secondary restore-trigger"
          onClick={() => {
            setIncoming(null);
            setRestoreConfirmed(false);
            setRestoreOpen(true);
          }}
        >
          <Icon name="upload" />
          バックアップから復元
        </Button>
        {snapshot && (
          <Button
            variant="secondary"
            className="day-setup-trigger"
            onClick={() =>
              void perform(async () => {
                const current = await store.read();
                if (!current) throw new Error('営業の記録がありません。');
                setDayBase(current);
                const tomorrow = new Date(`${current.meta.day}T12:00:00Z`);
                tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
                setNextDay(tomorrow.toISOString().slice(0, 10));
                setDayMenu(menuForm(findActivePrice(current)!));
                setDayTickets(String(current.meta.ticketCount));
                setDayOpen(true);
              })
            }
          >
            別の日の営業を準備
          </Button>
        )}
      </div>
      {dayOpen && (
        <Dialog
          open={dayOpen}
          onClose={() => setDayOpen(false)}
          title="別の日の営業を準備"
          className="restore-dialog day-setup-dialog"
        >
          <InlineError message={errorMessage} />
          <div className="restore">
            <p>
              前の営業日の記録は残ります。商品・価格を引き継ぎ、当日の在庫を登録できます。
            </p>
            {hasDraft && (
              <p role="status">入力途中の注文や設定を先に保存してください。</p>
            )}
            <form
              className="day-setup-form"
              onSubmit={(event) => {
                event.preventDefault();
                if (!dayBase || !dayMenu || hasDraft) return;
                void perform(async () => {
                  const current = await store.read();
                  if (!current) throw new Error('営業の記録がありません。');
                  validateDaySetup(current, nextDay, dayBase.meta.sequence);
                  const operationId = newId();
                  const context = contextOf(dayBase.meta);
                  await store.prepare(operationId, context, {
                    type: 'startDay',
                    day: nextDay,
                    price: menuPrice({
                      ...dayMenu,
                      id: newId(),
                      mix: true,
                      discounted: false,
                      label: '通常',
                    }),
                    stock: menuStock(dayMenu),
                    ticketCount: Number(dayTickets),
                    expectedSequence: dayBase.meta.sequence,
                  });
                  await store.execute(operationId, context);
                  setDayOpen(false);
                  setDayBase(null);
                  onRestart();
                });
              }}
            >
              <label>
                営業日
                <input
                  type="date"
                  required
                  value={nextDay}
                  onChange={(event) => setNextDay(event.target.value)}
                />
              </label>
              <label>
                番号札の枚数
                <input
                  type="number"
                  min="1"
                  max={MAX_TICKETS}
                  required
                  value={dayTickets}
                  onChange={(event) => setDayTickets(event.target.value)}
                />
              </label>
              {dayMenu && (
                <div className="menu-pricing-settings">
                  <div className="menu-settings">
                    <MenuFields draft={dayMenu} onChange={setDayMenu} />
                  </div>
                </div>
              )}
              <Button
                type="submit"
                variant="danger"
                disabled={!dayBase || hasDraft || nextDay === dayBase.meta.day}
              >
                この営業日を準備
              </Button>
            </form>
          </div>
        </Dialog>
      )}
      <Dialog
        open={restoreOpen}
        onClose={() => setRestoreOpen(false)}
        title="バックアップから復元"
        className="restore-dialog"
      >
        <InlineError message={errorMessage} />
        <div className="restore">
          <p>
            バックアップを復元します。
            <br />
            保存したバックアップファイルを開いてください。
          </p>
          <FilePicker
            label="記録ファイル（.json）"
            accept=".json,application/json"
            onFile={(file) => {
              setIncoming(null);
              setRestoreConfirmed(false);
              void perform(async () => {
                const parsed = parseBackup(await fileText(file));
                const current = await store.read();
                setExpected(current);
                setIncoming(parsed);
              });
            }}
          />
          {incoming && (
            <div className="restore-preview">
              <h4>バックアップ内容</h4>
              <table className="backup-table" aria-label="バックアップ内容">
                <tbody>
                  <tr>
                    <th scope="row">営業名</th>
                    <td>{incoming.meta.event}</td>
                  </tr>
                  <tr>
                    <th scope="row">日付</th>
                    <td>{incoming.meta.day}</td>
                  </tr>
                  <tr>
                    <th scope="row">注文</th>
                    <td>{incoming.orders.length}件</td>
                  </tr>
                  <tr>
                    <th scope="row">売上</th>
                    <td>{yen(incomingSales!.sales)}</td>
                  </tr>
                  <tr>
                    <th scope="row">販売本数</th>
                    <td>{incomingSales!.count}本</td>
                  </tr>
                  <tr>
                    <th scope="row">保留の注文</th>
                    <td>{pendingOrders(incoming).length}件</td>
                  </tr>
                  <tr>
                    <th scope="row">確認待ちの記録</th>
                    <td>
                      {
                        incoming.operations.filter(
                          (op) => op.status === 'pending',
                        ).length
                      }
                      件
                    </td>
                  </tr>
                </tbody>
              </table>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={restoreConfirmed}
                  onChange={(e) => setRestoreConfirmed(e.target.checked)}
                />
                バックアップ内容を確認した
              </label>
              <Button
                variant="danger"
                type="button"
                className="danger"
                disabled={!restoreConfirmed || hasDraft}
                onClick={() =>
                  perform(async () => {
                    await store.restore(incoming, expected);
                    setIncoming(null);
                    setRestoreOpen(false);
                    setRestoreConfirmed(false);
                    onRestart();
                  })
                }
              >
                この内容で再開
              </Button>
            </div>
          )}
        </div>
      </Dialog>
    </section>
  );
}
