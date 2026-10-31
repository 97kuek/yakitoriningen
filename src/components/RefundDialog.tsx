import { useId, useState } from 'react';
import type { Order, Snapshot } from '../domain/model';
import type { Cashier } from '../application/ports';
import type { Shared } from '../ui';
import { newId } from '../lib/id';
import { yen } from '../presentation/format';
import { Button, Dialog } from './controls';
import { OrderDetails } from './OrderDetails';

export function RefundDialog({
  order,
  snapshot,
  onClose,
  store,
  perform,
  context,
  errorMessage,
  busy,
}: Shared & {
  order: Order;
  snapshot: Snapshot;
  onClose: () => void;
  store: Cashier;
}) {
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const formId = useId();
  const pending = snapshot.operations.find(
    (operation) =>
      operation.status === 'pending' &&
      operation.command.type === 'cancel' &&
      operation.command.orderId === order.id &&
      operation.context.generation === context.generation,
  );
  const prepared = pending?.command.type === 'cancel' ? pending.command : null;
  return (
    <Dialog
      open
      title="全額返金"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            戻る
          </Button>
          <Button
            variant={prepared ? 'danger' : 'primary'}
            type="submit"
            form={formId}
            disabled={busy || (prepared ? !confirmed : !reason.trim())}
          >
            {prepared ? '返金を記録' : '返金を始める'}
          </Button>
        </>
      }
    >
      {errorMessage && (
        <p className="inline-error" role="alert">
          {errorMessage}
        </p>
      )}
      <form
        id={formId}
        onSubmit={(event) => {
          event.preventDefault();
          void perform(async () => {
            if (!pending)
              await store.prepare(newId(), context, {
                type: 'cancel',
                orderId: order.id,
                assignmentId: order.assignmentId,
                reason,
              });
            else {
              if (!confirmed) return;
              await store.execute(pending.id, context);
              onClose();
            }
          });
        }}
      >
        <div className="refund-amount">
          <span>札 {order.ticket} の返金</span>
          <strong>{yen(order.quote.total)}</strong>
        </div>
        <OrderDetails order={order} snapshot={snapshot} />
        {!prepared ? (
          <>
            <p className="hint">
              理由を入力して準備を保存してから、現金を返します。
            </p>
            <label>
              取消理由
              <input
                required
                maxLength={200}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
          </>
        ) : (
          <>
            <p className="hint">取消理由：{prepared.reason}</p>
            <p className="notice">
              <strong>返金の準備ができました。</strong>
              <br />
              返金済みか確認し、未返金なら {yen(order.quote.total)}{' '}
              を返金してください。
            </p>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
              全額返金し、現金を確認しました
            </label>
          </>
        )}
      </form>
    </Dialog>
  );
}
