import { useState } from 'react';
import { count } from '../domain/model';
import { yen } from '../presentation/format';

import type { Snapshot } from '../domain/model';
import type { ActionHandler } from '../ui';
import { canonical } from '../application/serialization';
import type { Cashier } from '../application/ports';
import { encodeBackup, parseBackup } from '../application/backup';
import { newEvent } from '../application/new-event';
import { newId } from '../lib/id';
import { today } from '../presentation/format';
import { Button, Dialog, FilePicker } from './controls';
import { Icon } from './Icon';
import { download } from '../presentation/download';
async function fileText(file: File | undefined) {
  if (!file || file.size > 50_000_000)
    throw new Error(
      '保存したバックアップを選んでください。ファイルの上限は50MBです。',
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
  const [archive, setArchive] = useState<Snapshot | null>(null);
  const [verified, setVerified] = useState(false);
  const [restoreConfirmed, setRestoreConfirmed] = useState(false);
  const [status, setStatus] = useState('');
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [newEventOpen, setNewEventOpen] = useState(false);
  const [eventName, setEventName] = useState('');
  const [eventDay, setEventDay] = useState(today());
  const [newEventConfirmed, setNewEventConfirmed] = useState(false);
  const archiveCurrent =
    !!snapshot &&
    !!archive &&
    verified &&
    canonical(snapshot) === canonical(archive);
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
                    download(
                      text,
                      `焼き鳥人間_バックアップ_${current.meta.day}_${new Date().toLocaleTimeString('sv-SE', { hour12: false }).replaceAll(':', '-')}.json`,
                    );
                    setArchive(current);
                    setVerified(false);
                    setStatus(
                      '保存したファイルを選んで確認し、USBなどにもコピーしてください。',
                    );
                  })
                }
              >
                <Icon name="download" />
                バックアップを保存
              </Button>
              <p className="hint">注文・設定を戻すためのファイル（.json）</p>
            </div>
          </div>
          {archive && (
            <div className="archive-check">
              <FilePicker
                label="保存したファイルを確認"
                accept=".json,application/json"
                onFile={(file) => {
                  setVerified(false);
                  void perform(async () => {
                    const read = parseBackup(await fileText(file));
                    if (canonical(read) !== canonical(archive))
                      throw new Error(
                        '直前に保存した内容と違います。保存したファイルを選び直してください。',
                      );
                    setVerified(true);
                    setStatus('');
                  });
                }}
              />
              <p>
                {verified ? (
                  <>
                    <Icon name="check" />
                    保存したファイルを確認済み
                  </>
                ) : (
                  '保存先のファイルを選んで、中身を確認してください。'
                )}
              </p>
              {verified && (
                <p className="hint">
                  USBなど別の場所へのコピーも確認してください。
                </p>
              )}
            </div>
          )}
        </>
      )}
      {status && (
        <p role="status" className="notice">
          {status}
        </p>
      )}
      <div className="data-secondary-actions">
        <Button
          variant="secondary"
          type="button"
          className="secondary restore-trigger"
          onClick={() => setRestoreOpen(true)}
        >
          <Icon name="upload" />
          バックアップから復元
        </Button>
        {snapshot && (
          <Button
            variant="secondary"
            className="new-event-trigger"
            onClick={() => setNewEventOpen(true)}
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
          className="restore-dialog"
        >
          {errorMessage && (
            <p className="inline-error" role="alert">
              {errorMessage}
            </p>
          )}
          <div className="restore">
            <p>
              現在の記録はこの画面から消えます。先に「バックアップを保存」し、保存したファイルを確認してください。
            </p>
            <p>
              {archiveCurrent
                ? '保存したファイルを確認済み'
                : '記録の保存とファイルの確認が必要です。'}
            </p>
            {hasDraft && (
              <p role="status">入力途中の注文を確認してください。</p>
            )}
            <form
              className="new-event-form"
              onSubmit={(event) => {
                event.preventDefault();
                if (!archive || !archiveCurrent || hasDraft) return;
                void perform(async () => {
                  const next = newEvent(archive, eventName, eventDay, newId);
                  await store.restore(next, archive, true);
                  setNewEventOpen(false);
                  setArchive(null);
                  setVerified(false);
                  setNewEventConfirmed(false);
                  onRestored();
                });
              }}
            >
              <label>
                開催回
                <input
                  value={eventName}
                  required
                  maxLength={80}
                  placeholder="例：早稲田祭 2027"
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
              <p className="hint">
                商品・価格と札の枚数を引き継ぎます。値下げは解除します。
              </p>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={newEventConfirmed}
                  onChange={(event) =>
                    setNewEventConfirmed(event.target.checked)
                  }
                />
                前年のバックアップを保存した
              </label>
              <Button
                type="submit"
                variant="danger"
                disabled={
                  !archiveCurrent ||
                  hasDraft ||
                  !newEventConfirmed ||
                  !eventName.trim()
                }
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
        {errorMessage && (
          <p className="inline-error" role="alert">
            {errorMessage}
          </p>
        )}
        <div className="restore">
          <p>
            {snapshot
              ? '会計を止めてから開いてください。現在の記録は置き換わります。先にバックアップを保存し、ファイルを確認してください。'
              : '保存したファイルを選び、内容を確認してください。'}
          </p>
          <FilePicker
            label="記録ファイル（.json）"
            accept=".json,application/json"
            onFile={(file) => {
              setIncoming(null);
              setRestoreConfirmed(false);
              void perform(async () =>
                setIncoming(parseBackup(await fileText(file))),
              );
            }}
          />
          {incoming && (
            <div className="restore-preview">
              <h4>開く内容</h4>
              <p>
                {incoming.meta.event} / {incoming.meta.day}
              </p>
              <dl>
                <dt>注文</dt>
                <dd>{incoming.orders.length}件</dd>
                <dt>売上</dt>
                <dd>
                  {yen(
                    incoming.orders
                      .filter((o) => o.status === 'paid')
                      .reduce((n, o) => n + o.quote.total, 0),
                  )}
                </dd>
                <dt>販売本数</dt>
                <dd>
                  {incoming.orders
                    .filter((o) => o.status === 'paid')
                    .reduce((n, o) => n + count(o.quantities), 0)}
                  本
                </dd>
                <dt>保留の注文</dt>
                <dd>
                  {incoming.orders.filter((o) => o.status === 'pending').length}
                  件
                </dd>
                <dt>確認待ちの記録</dt>
                <dd>
                  {
                    incoming.operations.filter((op) => op.status === 'pending')
                      .length
                  }
                  件
                </dd>
              </dl>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={restoreConfirmed}
                  onChange={(e) => setRestoreConfirmed(e.target.checked)}
                />
                開く内容と現在の記録の保存を確認した
              </label>
              <Button
                variant="danger"
                type="button"
                className="danger"
                disabled={!restoreConfirmed || (!!snapshot && !verified)}
                onClick={() =>
                  perform(async () => {
                    await store.restore(
                      incoming,
                      snapshot ? archive : null,
                      verified,
                    );
                    setIncoming(null);
                    setArchive(null);
                    setVerified(false);
                    setRestoreConfirmed(false);
                    onRestored();
                  })
                }
              >
                この記録に置き換える
              </Button>
              <p className="hint">
                保留の注文は、現金と札を確認してから再開してください。
              </p>
            </div>
          )}
        </div>
      </Dialog>
    </section>
  );
}
