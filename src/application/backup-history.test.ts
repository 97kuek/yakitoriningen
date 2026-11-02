import { expect, it } from 'vitest';
import { normalPrice } from '../domain/model';
import type { Command, Snapshot } from '../domain/model';
import { validateSnapshot } from './backup';

/** Two completed orders share a reused ticket; the first uses a legacy reservation. */
function history(): Snapshot {
  const price = normalPrice('price');
  const context = { databaseId: 'history-test', generation: 'generation' };
  const event = '架空の検証用開催回';
  const day = '2026-11-01';
  const at = '2026-11-01T02:00:00.000Z';
  const snapshot: Snapshot = {
    meta: {
      key: 'main',
      ...context,
      event,
      day,
      activePriceId: price.id,
      ticketCount: 2,
      sequence: 0,
      expenseTotal: null,
    },
    prices: [price],
    orders: [],
    tickets: [1, 2].map((number) => ({
      number,
      orderId: null,
      assignmentId: null,
    })),
    operations: [],
    logs: [],
  };
  for (const index of [0, 1]) {
    const target = {
      orderId: `order-${index}`,
      assignmentId: `assignment-${index}`,
    };
    const paymentId = `payment-${index}`;
    const quantities = { momo: 1 };
    snapshot.orders.push({
      id: target.orderId,
      assignmentId: target.assignmentId,
      confirmOperationId: paymentId,
      event,
      day,
      ticket: 2,
      quantities,
      names: { momo: 'もも', kawa: 'かわ', negima: 'ねぎま' },
      price,
      quote: { total: 150, count: 1, bundles: 0, singles: 1 },
      status: 'paid',
      received: 150,
      change: 0,
      delivered: true,
      returned: true,
      refunded: 0,
      createdAt: at,
      paidAt: at,
      cancelReason: null,
    });
    const commands: Command[] = [
      {
        type: 'reserve',
        ...target,
        confirmOperationId: paymentId,
        quantities,
        price,
        ...(index === 0 ? {} : { ticket: 2 }),
      },
      ...(index === 0
        ? [{ type: 'selectTicket' as const, ...target, from: 1, ticket: 2 }]
        : []),
      { type: 'pay', ...target, received: 150 },
      { type: 'complete', ...target },
    ];
    for (const command of commands) {
      const id =
        command.type === 'pay' ? paymentId : `${command.type}-${index}`;
      snapshot.operations.push({
        id,
        context,
        event,
        day,
        command,
        status: 'done',
        result: target.orderId,
        createdAt: at,
      });
      snapshot.logs.push({
        sequence: ++snapshot.meta.sequence,
        operationId: id,
        type: command.type,
        target: target.orderId,
        at,
      });
    }
  }
  snapshot.operations.reverse();
  snapshot.logs.reverse();
  return snapshot;
}

it('記録の配列順に依存せず、混在する注文と旧形式の札変更を検証する', () => {
  const snapshot = history();
  expect(validateSnapshot(snapshot)).toEqual(snapshot);
});

it('注文状態が一致していても会計前の受け渡し記録を拒否する', () => {
  const snapshot = history();
  const payment = snapshot.logs.find((log) => log.operationId === 'payment-0')!;
  const completion = snapshot.logs.find(
    (log) => log.operationId === 'complete-0',
  )!;
  [payment.sequence, completion.sequence] = [
    completion.sequence,
    payment.sequence,
  ];
  expect(() => validateSnapshot(snapshot)).toThrow(
    '注文と受け渡し・取消の記録',
  );
});

it('破棄済みの完了操作を注文の受け渡し履歴として採用しない', () => {
  const snapshot = history();
  const completion = snapshot.operations.find(
    (operation) => operation.id === 'complete-1',
  )!;
  completion.status = 'dismissed';
  completion.result = null;
  const log = snapshot.logs.find(
    (entry) => entry.operationId === completion.id,
  )!;
  log.type = 'dismiss';
  expect(() => validateSnapshot(snapshot)).toThrow(
    '注文と受け渡し・取消の記録',
  );
});
