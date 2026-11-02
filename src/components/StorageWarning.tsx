import { useEffect, useRef, useState } from 'react';
import { Button, Dialog, InlineError } from './controls';

const WARNING_RATIO = 0.9;
const REARM_RATIO = 0.85;
const ESTIMATE_INTERVAL_MS = 60_000;

export function StorageWarning({
  blocked,
  busy = false,
  errorMessage = '',
  onBackup,
}: {
  blocked: boolean;
  busy?: boolean;
  errorMessage?: string;
  onBackup?: () => Promise<void> | void;
}) {
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState(false);
  const notified = useRef(false);

  useEffect(() => {
    let active = true;
    let checking = false;
    async function checkCapacity() {
      if (checking || !navigator.storage?.estimate) return;
      checking = true;
      try {
        const { usage, quota } = await navigator.storage.estimate();
        if (
          !active ||
          usage === undefined ||
          quota === undefined ||
          !Number.isFinite(usage) ||
          !Number.isFinite(quota) ||
          usage < 0 ||
          quota <= 0
        )
          return;
        const ratio = usage / quota;
        if (ratio < REARM_RATIO) {
          notified.current = false;
          setPending(false);
        } else if (ratio >= WARNING_RATIO && !notified.current) {
          setPending(true);
        }
      } catch {
        // The estimate is optional; inability to obtain one is not a warning.
      } finally {
        checking = false;
      }
    }
    void checkCapacity();
    const onFocus = () => void checkCapacity();
    window.addEventListener('focus', onFocus);
    const timer = window.setInterval(onFocus, ESTIMATE_INTERVAL_MS);
    return () => {
      active = false;
      window.removeEventListener('focus', onFocus);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!pending || blocked || busy || open) return;
    notified.current = true;
    setPending(false);
    setOpen(true);
  }, [pending, blocked, busy, open]);

  if (!open) return null;
  return (
    <Dialog
      open
      title="保存容量が少なくなっています"
      onClose={() => {
        if (!busy) setOpen(false);
      }}
      footer={
        <>
          <Button disabled={busy} onClick={() => setOpen(false)}>
            閉じる
          </Button>
          {onBackup && (
            <Button
              variant="primary"
              disabled={busy}
              onClick={() => void onBackup()}
            >
              バックアップを保存
            </Button>
          )}
        </>
      }
    >
      <InlineError message={errorMessage} />
      <p>このブラウザで使える保存容量の90%以上を使用しています。</p>
      <p>
        記録を守るため、バックアップを保存して別の場所にも保管してください。
      </p>
    </Dialog>
  );
}
