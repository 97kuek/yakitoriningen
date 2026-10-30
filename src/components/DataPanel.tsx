import { useEffect, useId, useRef, useState } from 'react';
import { count } from '../domain/model';
import { yen } from '../presentation/format';

import type { Snapshot } from '../domain/model';
import type { ActionHandler } from '../ui';
import { canonical } from '../application/serialization';
import type { Cashier } from '../application/ports';
import { encodeBackup, ordersCsv, parseBackup } from '../application/backup';
import { Icon } from './Icon';
export function download(
  text: string,
  name: string,
  type = 'application/json',
) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
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
  onVerified,
  errorMessage,
}: {
  store: Cashier;
  snapshot: Snapshot | null;
  perform: ActionHandler;
  onRestored: () => void;
  onVerified: (s: Snapshot) => void;
  errorMessage: string;
}) {
  const [incoming, setIncoming] = useState<Snapshot | null>(null);
  const [archive, setArchive] = useState<Snapshot | null>(null);
  const [verified, setVerified] = useState(false);
  const [restoreConfirmed, setRestoreConfirmed] = useState(false);
  const [status, setStatus] = useState('');
  const [restoreOpen, setRestoreOpen] = useState(false);
  const restoreDialog = useRef<HTMLDialogElement>(null);
  const restoreHeading = useId();
  useEffect(() => {
    if (restoreOpen) restoreDialog.current?.showModal();
    else restoreDialog.current?.close();
  }, [restoreOpen]);
  return (
    <section className="data-panel" aria-labelledby="backup-heading">
      <h3 id="backup-heading">
        <Icon name="download" />
        記録の保存・引き継ぎ
      </h3>
      {snapshot && (
        <>
          <div className="actions">
            <button
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
                    '保存先のファイルを確認してください。USBなど別の場所にもコピーしましょう。',
                  );
                })
              }
            >
              <Icon name="download" />
              バックアップを保存
            </button>
            <button
              className="secondary"
              onClick={() =>
                perform(async () => {
                  const current = await store.read();
                  if (current)
                    download(
                      ordersCsv(current),
                      `焼き鳥人間_売上一覧_${current.meta.day}.csv`,
                      'text/csv;charset=utf-8',
                    );
                })
              }
            >
              <Icon name="chart" />
              売上一覧を保存
            </button>
          </div>
          <p className="hint">
            引き継ぎにはバックアップを使います。売上一覧は集計用です。
          </p>
          {archive && (
            <div className="archive-check">
              <label>
                保存したバックアップを確認
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    void perform(async () => {
                      const read = parseBackup(await fileText(file));
                      if (canonical(read) !== canonical(archive))
                        throw new Error(
                          '直前に保存した内容と違います。保存したファイルを選び直してください。',
                        );
                      setVerified(true);
                      onVerified(archive);
                      setStatus('');
                    });
                  }}
                />
              </label>
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
      <button
        type="button"
        className="secondary restore-trigger"
        onClick={() => setRestoreOpen(true)}
      >
        <Icon name="upload" />
        バックアップから戻す
      </button>
      <dialog
        ref={restoreDialog}
        className="restore-dialog"
        aria-labelledby={restoreHeading}
        onCancel={() => setRestoreOpen(false)}
      >
        <div className="section-heading">
          <h2 id={restoreHeading}>バックアップから戻す</h2>
          <button
            className="icon-button"
            aria-label="閉じる"
            title="閉じる"
            type="button"
            onClick={() => setRestoreOpen(false)}
          >
            <Icon name="close" />
          </button>
        </div>
        {errorMessage && (
          <p className="inline-error" role="alert">
            {errorMessage}
          </p>
        )}
        <div className="restore">
          <p>
            現在の記録を置き換えます。先にバックアップを保存し、ファイルを確認してください。
          </p>
          <label>
            戻すバックアップ
            <input
              type="file"
              accept=".json,application/json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                setIncoming(null);
                setRestoreConfirmed(false);
                void perform(async () =>
                  setIncoming(parseBackup(await fileText(file))),
                );
              }}
            />
          </label>
          {incoming && (
            <div className="restore-preview">
              <h4>戻す内容</h4>
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
                会計を止め、戻す内容と現在の記録の保存を確認しました
              </label>
              <button
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
                この内容に戻す
              </button>
              <p className="hint">
                保留の注文は、現金と札を確認してから再開してください。
              </p>
            </div>
          )}
        </div>
      </dialog>
    </section>
  );
}
