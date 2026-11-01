import { useState } from 'react';
import type { Snapshot } from '../domain/model';
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
import { restoreDays } from '../application/restore';
import { download } from '../presentation/download';
import { yen } from '../presentation/format';
import { Button, Dialog, FilePicker, InlineError, Select } from './controls';
import { Icon } from './Icon';
import { DaySetup } from './DaySetup';

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
  const [restoreConfirmed, setRestoreConfirmed] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
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
          <DaySetup
            store={store}
            perform={perform}
            errorMessage={errorMessage}
            onRestart={onRestart}
            hasDraft={hasDraft}
          />
        )}
      </div>

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
                restoreDays(parsed, current);
                setExpected(current);
                setIncoming(parsed);
              });
            }}
          />
          {incoming && (
            <div className="restore-preview">
              <h4>バックアップ内容</h4>
              <p className="hint">
                この日付の記録を復元します。他の日の記録は残ります。
              </p>
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
