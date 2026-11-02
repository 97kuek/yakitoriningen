import { useEffect, useState } from 'react';
import type { Snapshot } from '../domain/model';
import { BUSINESS_CLOSE_MINUTE } from '../domain/constants';
import { japanMinuteOfDay } from '../domain/time';
import type { Cashier } from '../application/ports';
import type { Shared, BackupExporter } from '../ui';
import { today } from '../presentation/format';
import { Button, Dialog, InlineError } from './controls';

export function CloseDay({
  snapshot,
  lastBackupSequence,
  blocked,
  exported,
  onConfirmBackup,
  onFinish,
  store,
  perform,
  exportBackup,
  errorMessage,
  busy,
}: Pick<Shared, 'perform' | 'errorMessage' | 'busy'> & {
  exportBackup: BackupExporter;
  snapshot: Snapshot;
  lastBackupSequence: number | null;
  blocked: boolean;
  exported: Snapshot['meta'] | null;
  onConfirmBackup: (meta: Snapshot['meta']) => void;
  onFinish: () => void;
  store: Cashier;
}) {
  const [open, setOpen] = useState(false);
  const unreturned = snapshot.tickets.filter(
    (ticket) => ticket.orderId !== null,
  );
  const [now, setNow] = useState(() => new Date().toISOString());
  useEffect(() => {
    const timer = window.setInterval(
      () => setNow(new Date().toISOString()),
      30_000,
    );
    return () => window.clearInterval(timer);
  }, []);
  const reminder =
    snapshot.meta.day === today() &&
    japanMinuteOfDay(now) >= BUSINESS_CLOSE_MINUTE &&
    snapshot.meta.sequence > 0 &&
    lastBackupSequence !== snapshot.meta.sequence;
  const ready =
    exported?.databaseId === snapshot.meta.databaseId &&
    exported?.generation === snapshot.meta.generation &&
    exported?.day === snapshot.meta.day &&
    exported?.sequence === snapshot.meta.sequence;
  return (
    <>
      {reminder && (
        <span className="backup-reminder" role="status">
          本日のバックアップを保存してください。
        </span>
      )}
      <Button
        onClick={() => {
          setOpen(true);
        }}
        disabled={busy}
      >
        今日の営業を終了
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="今日の営業を終了"
        footer={
          <>
            <Button
              disabled={busy || blocked}
              onClick={() =>
                void perform(async () => {
                  await exportBackup();
                })
              }
            >
              バックアップを保存
            </Button>
            <Button
              variant="primary"
              disabled={busy || blocked || !ready || unreturned.length > 0}
              onClick={() =>
                void perform(async () => {
                  const current = await store.read();
                  if (
                    !current ||
                    !exported ||
                    current.meta.databaseId !== exported.databaseId ||
                    current.meta.day !== exported.day ||
                    current.meta.sequence !== exported.sequence ||
                    current.meta.generation !== exported.generation ||
                    current.orders.some(
                      (order) => order.status === 'pending',
                    ) ||
                    current.tickets.some((ticket) => ticket.orderId !== null) ||
                    current.operations.some(
                      (operation) => operation.status === 'pending',
                    )
                  )
                    throw new Error(
                      '記録が変わりました。もう一度バックアップを保存してください。',
                    );
                  onConfirmBackup(current.meta);
                  setOpen(false);
                  onFinish();
                })
              }
            >
              保存を確認して終了
            </Button>
          </>
        }
      >
        <InlineError message={errorMessage} />
        <p>{snapshot.meta.day}</p>
        {unreturned.length > 0 && (
          <p role="status">
            未回収の札：{unreturned.map((ticket) => ticket.number).join('、')}
          </p>
        )}
        {blocked && <p>会計や設定の変更を終えてから終了してください。</p>}
      </Dialog>
    </>
  );
}
