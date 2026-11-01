import { useState } from 'react';
import type { Snapshot } from '../domain/model';
import { MAX_EVENT_NAME_LENGTH, MAX_TICKETS } from '../domain/constants';
import { findActivePrice } from '../domain/catalog';
import { menuForm, menuPrice, type MenuForm } from '../presentation/menu-form';
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
import { newEvent } from '../application/new-event';
import { newId } from '../lib/id';
import { download } from '../presentation/download';
import { today, yen } from '../presentation/format';
import { Button, Dialog, FilePicker, InlineError } from './controls';
import { Icon } from './Icon';
import { eventNameExample } from '../presentation/festival';

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
  onRestored,
  errorMessage,
  hasDraft = false,
}: {
  store: Cashier;
  snapshot: Snapshot | null;
  perform: ActionHandler;
  onRestored: () => void;
  errorMessage: string;
  hasDraft?: boolean;
}) {
  const [incoming, setIncoming] = useState<Snapshot | null>(null);
  const [expected, setExpected] = useState<Snapshot | null>(null);
  const [eventBase, setEventBase] = useState<Snapshot | null>(null);
  const [restoreConfirmed, setRestoreConfirmed] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [newEventOpen, setNewEventOpen] = useState(false);
  const [eventName, setEventName] = useState('');
  const [eventDay, setEventDay] = useState(today());
  const [eventMenu, setEventMenu] = useState<MenuForm | null>(null);
  const [eventTickets, setEventTickets] = useState('');
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
                    const text = encodeBackup(current);
                    parseBackup(await new Blob([text]).text());
                    download(text, `${current.meta.day}-yakitori.json`);
                  })
                }
              >
                <Icon name="download" />
                バックアップを保存
              </Button>
              <p className="hint">注文・設定を戻すためのファイル（.json）</p>
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
            className="new-event-trigger"
            onClick={() =>
              void perform(async () => {
                const current = await store.read();
                if (!current) throw new Error('営業の記録がありません。');
                setEventBase(current);
                setEventMenu(menuForm(findActivePrice(current)!));
                setEventTickets(String(current.meta.ticketCount));
                setNewEventOpen(true);
              })
            }
          >
            新しい開催回を準備
          </Button>
        )}
      </div>
      {newEventOpen && (
        <Dialog
          open={newEventOpen}
          onClose={() => setNewEventOpen(false)}
          title="新しい開催回を準備"
          className="restore-dialog new-event-dialog"
        >
          <InlineError message={errorMessage} />
          <div className="restore">
            <p>
              新しい開催回に切り替えると、記録が削除されます。
              <br />
              記録を保存したい場合は、「バックアップを保存」を選択してください。
            </p>
            {hasDraft && (
              <p role="status">入力途中の注文を確認してください。</p>
            )}
            <form
              className="new-event-form"
              onSubmit={(event) => {
                event.preventDefault();
                if (!eventBase || !eventMenu || hasDraft) return;
                void perform(async () => {
                  const next = newEvent(eventBase, eventName, eventDay, newId, {
                    price: menuPrice({ ...eventMenu, mix: true }),
                    ticketCount: Number(eventTickets),
                  });
                  await store.restore(next, eventBase);
                  setNewEventOpen(false);
                  setEventBase(null);
                  onRestored();
                });
              }}
            >
              <label>
                開催回
                <input
                  value={eventName}
                  required
                  maxLength={MAX_EVENT_NAME_LENGTH}
                  placeholder={eventNameExample(1)}
                  onChange={(event) => setEventName(event.target.value)}
                />
              </label>
              <label>
                1日目の日付
                <input
                  type="date"
                  required
                  value={eventDay}
                  onChange={(event) => setEventDay(event.target.value)}
                />
              </label>
              <label>
                番号札の枚数
                <input
                  type="number"
                  min="1"
                  max={MAX_TICKETS}
                  required
                  value={eventTickets}
                  onChange={(event) => setEventTickets(event.target.value)}
                />
              </label>
              {eventMenu && (
                <div className="menu-pricing-settings">
                  <div className="menu-settings">
                    <MenuFields draft={eventMenu} onChange={setEventMenu} />
                  </div>
                </div>
              )}
              <Button
                type="submit"
                variant="danger"
                disabled={!eventBase || hasDraft || !eventName.trim()}
              >
                新しい開催回に切り替える
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
                    <th scope="row">開催回</th>
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
                    onRestored();
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
