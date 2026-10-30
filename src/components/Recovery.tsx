import { emptyQuantities, products } from '../domain/model';
import { yen } from '../presentation/format';

import type { Operation, Snapshot } from '../domain/model';
import { quote } from '../domain/pricing';
import { canonical } from '../application/serialization';
import type { Cashier } from '../application/ports';
import { commandNames } from '../ui';
import type { Shared } from '../ui';
import type { Draft } from './Checkout';
function details(op: Operation, snapshot: Snapshot): string {
  const c = op.command;
  if (c.type === 'reserve') {
    let total = '金額を確認してください';
    try {
      total = yen(quote(c.quantities, c.price).total);
    } catch {
      /* Invalid totals remain unresolved. */
    }
    return `${products.map((p) => `${p.name} ${c.quantities[p.id]}本`).join(' ／ ')} ／ ${total}`;
  }
  if ('orderId' in c) {
    const order = snapshot.orders.find((o) => o.id === c.orderId);
    return `札 ${order?.ticket ?? '不明'} ／ ${order ? yen(order.quote.total) : '金額不明'}${c.type === 'cancel' ? ` ／ 取消理由：${c.reason}` : ''}`;
  }
  if (c.type === 'price') return `${c.price.label} ／ 1本 ${yen(c.price.unit)}`;
  if (c.type === 'expense') return `開催回全体の経費 ${yen(c.amount)}`;
  if (c.type === 'day') return `営業日 ${c.day}`;
  return `番号札 1〜${c.count}`;
}
export function Recovery({
  operations,
  snapshot,
  store,
  perform,
  context,
  draft,
  setDraft,
}: Shared & {
  operations: Operation[];
  snapshot: Snapshot;
  store: Cashier;
  draft: Draft;
  setDraft: (d: Draft) => void;
}) {
  if (!operations.length) return null;
  return (
    <section className="recovery notice">
      <h2>確認が必要な記録</h2>
      <p>現金・商品・札を確認してから記録してください。</p>
      {operations.map((op) => (
        <div key={op.id}>
          <strong>{commandNames[op.command.type]}</strong>
          <span>{details(op, snapshot)}</span>
          <button
            className="secondary"
            disabled={op.context.generation !== context.generation}
            onClick={() => {
              if (
                op.command.type === 'cancel' &&
                !window.confirm(
                  `${details(op, snapshot)}。既に全額返金したことを現金と確認しましたか？確認できた場合だけ記録してください。`,
                )
              )
                return;
              void perform(async () => {
                await store.execute(op.id, context);
                if (
                  op.command.type === 'reserve' &&
                  canonical(op.command.quantities) ===
                    canonical(draft.quantities) &&
                  canonical(op.command.price) === canonical(draft.price)
                )
                  setDraft({ quantities: emptyQuantities(), price: null });
              });
            }}
          >
            確認して記録
          </button>
          <button
            className="secondary"
            onClick={() => {
              if (
                window.confirm(
                  `${details(op, snapshot)}。現金・商品・札・履歴を確認しましたか？まだ行っていない場合だけ取り消してください。`,
                )
              )
                void perform(() => store.discard(op.id, context));
            }}
          >
            実行していないので取り消す
          </button>
          {op.context.generation !== context.generation && (
            <small>データを戻す前の記録です。このまま記録はできません。</small>
          )}
        </div>
      ))}
    </section>
  );
}
