import { z } from 'zod';
import {
  logSchema,
  metaSchema,
  operationSchema,
  orderSchema,
  priceSchema,
  ticketSchema,
} from '../domain/model';
import type { Snapshot } from '../domain/model';
import { quote } from '../domain/pricing';
import { getMenu } from '../domain/catalog';
import { ownsTicket, releasesTicket } from '../domain/ticket';
import { validateOrderHistory } from './order-history';
import { canonical } from './serialization';

/** Identifiers of the backup file format. Changing them breaks existing backups. */
const BACKUP_FORMAT = 'yakitoriningen';
const BACKUP_VERSION = 1;
/** Largest backup file accepted, in bytes (characters for parsed text). */
export const MAX_BACKUP_BYTES = 50_000_000;

const dataSchema = z
  .object({
    meta: metaSchema,
    prices: z.array(priceSchema),
    orders: z.array(orderSchema),
    tickets: z.array(ticketSchema),
    operations: z.array(operationSchema),
    logs: z.array(logSchema),
  })
  .strict();
const countSchema = z
  .object({
    prices: z.number().int().nonnegative(),
    orders: z.number().int().nonnegative(),
    tickets: z.number().int().nonnegative(),
    operations: z.number().int().nonnegative(),
    logs: z.number().int().nonnegative(),
  })
  .strict();
const backupSchema = z
  .object({
    format: z.literal(BACKUP_FORMAT),
    version: z.literal(BACKUP_VERSION),
    exportedAt: z.iso.datetime(),
    counts: countSchema,
    data: dataSchema,
  })
  .strict();
const collectionKeys = [
  'prices',
  'orders',
  'tickets',
  'operations',
  'logs',
] as const;
const requireValid = (condition: unknown, message: string) => {
  if (!condition) throw new Error(`バックアップが不整合です：${message}`);
};
function validate(data: Snapshot): void {
  const prices = new Map(data.prices.map((p) => [p.id, p]));
  const orders = new Map(data.orders.map((o) => [o.id, o]));
  const tickets = new Map(data.tickets.map((t) => [t.number, t]));
  const ops = new Map(data.operations.map((op) => [op.id, op]));
  const logs = new Map(data.logs.map((log) => [log.operationId, log]));
  requireValid(
    prices.size === data.prices.length &&
      orders.size === data.orders.length &&
      tickets.size === data.tickets.length &&
      ops.size === data.operations.length &&
      logs.size === data.logs.length,
    'IDが重複しています',
  );
  requireValid(
    new Set(data.orders.map((o) => o.confirmOperationId)).size ===
      data.orders.length,
    '確定操作IDの重複',
  );
  requireValid(prices.has(data.meta.activePriceId), '適用価格がありません');
  requireValid(
    data.tickets.length === data.meta.ticketCount &&
      data.tickets.every((t) => t.number <= data.meta.ticketCount),
    '札の範囲',
  );
  for (let n = 1; n <= data.meta.ticketCount; n++)
    requireValid(tickets.has(n), '札の欠落');
  for (const order of data.orders) {
    requireValid(order.event === data.meta.event, '開催回が一致しません');
    requireValid(
      canonical(order.price) === canonical(prices.get(order.price.id)),
      '注文の価格版',
    );
    requireValid(
      canonical(order.names) ===
        canonical(
          Object.fromEntries(
            getMenu(order.price).map((item) => [item.id, item.name]),
          ),
        ),
      '注文の商品名',
    );
    requireValid(
      canonical(quote(order.quantities, order.price)) ===
        canonical(order.quote) && order.quote.count > 0,
      '注文の数量・金額',
    );
    if (order.status === 'pending')
      requireValid(
        order.received === null &&
          order.change === null &&
          order.paidAt === null &&
          !order.delivered &&
          !order.returned &&
          order.refunded === 0 &&
          order.cancelReason === null,
        '保留会計の状態',
      );
    if (order.status === 'paid' || order.received !== null)
      requireValid(
        order.received !== null &&
          order.received >= order.quote.total &&
          order.change === order.received - order.quote.total &&
          order.paidAt !== null,
        '入金とお釣り',
      );
    if (order.status === 'paid')
      requireValid(
        order.refunded === 0 && order.cancelReason === null,
        '会計済みの返金',
      );
    if (order.status === 'cancelled')
      requireValid(
        !!order.cancelReason &&
          order.refunded ===
            (order.received === null ? 0 : order.quote.total) &&
          (order.received !== null ||
            (!order.delivered &&
              order.returned &&
              order.change === null &&
              order.paidAt === null)),
        '取消・返金',
      );
    const ticket = tickets.get(order.ticket);
    if (!releasesTicket(order))
      requireValid(ownsTicket(ticket, order), '使用中の札と注文');
    else requireValid(ticket?.orderId !== order.id, '回収・完了済み札の所有権');
    const related = data.operations.filter(
      (op) =>
        op.status === 'done' &&
        'orderId' in op.command &&
        op.command.orderId === order.id,
    );
    const reservations = related.filter((op) => op.command.type === 'reserve');
    requireValid(reservations.length === 1, '注文の作成操作がありません');
    const reservation = reservations[0];
    if (reservation?.command.type === 'reserve') {
      requireValid(
        canonical(reservation.command.quantities) ===
          canonical(order.quantities) &&
          canonical(reservation.command.price) === canonical(order.price) &&
          reservation.event === order.event &&
          reservation.day === order.day &&
          reservation.command.assignmentId === order.assignmentId,
        '注文と作成操作の内容',
      );
    }
    const payments = related.filter((op) => op.command.type === 'pay');
    requireValid(
      payments.length === (order.received === null ? 0 : 1),
      '会計済み注文の確定操作',
    );
    if (order.received !== null)
      requireValid(
        payments[0]?.id === order.confirmOperationId,
        '会計確定の操作ID',
      );
    try {
      validateOrderHistory(order, related, data);
    } catch {
      requireValid(false, '注文と受け渡し・取消の記録');
    }
    const cancellations = related.filter((op) => op.command.type === 'cancel');
    requireValid(
      cancellations.length === (order.status === 'cancelled' ? 1 : 0),
      '取消の記録',
    );
    if (cancellations[0]?.command.type === 'cancel')
      requireValid(
        cancellations[0].command.reason === order.cancelReason,
        '取消理由',
      );
  }
  for (const ticket of data.tickets) {
    requireValid(
      (ticket.orderId === null) === (ticket.assignmentId === null),
      '札の割り当て',
    );
    if (ticket.orderId !== null) {
      const order = orders.get(ticket.orderId);
      requireValid(
        order &&
          order.ticket === ticket.number &&
          order.assignmentId === ticket.assignmentId,
        '札の所有者',
      );
    }
  }
  requireValid(data.logs.length === data.meta.sequence, 'ログの上限と件数');
  const sequences = new Set(data.logs.map((l) => l.sequence));
  requireValid(sequences.size === data.logs.length, 'ログ連番の重複');
  for (let i = 1; i <= data.meta.sequence; i++)
    requireValid(sequences.has(i), 'ログ連番の欠落');
  for (const op of data.operations) {
    const log = logs.get(op.id);
    requireValid(
      op.context.databaseId === data.meta.databaseId &&
        op.event === data.meta.event,
      '操作の保存先',
    );
    requireValid(
      op.status === 'pending' ? !log && op.result === null : !!log,
      '操作とログ',
    );
    if (op.status === 'done') {
      requireValid(
        log?.type === op.command.type && log.target === op.result,
        '操作結果',
      );
      if ('orderId' in op.command) {
        const order = orders.get(op.command.orderId);
        requireValid(
          order &&
            order.assignmentId === op.command.assignmentId &&
            op.result === order.id,
          '操作対象の注文',
        );
        if (op.command.type === 'pay')
          requireValid(
            order?.received === op.command.received &&
              order.status !== 'pending',
            '入金操作',
          );
        if (op.command.type === 'cancel')
          requireValid(order?.status === 'cancelled', '取消操作');
      }
      if (op.command.type === 'price')
        requireValid(
          canonical(prices.get(op.command.price.id)) ===
            canonical(op.command.price),
          '価格変更操作',
        );
    }
    if (op.status === 'dismissed')
      requireValid(log?.type === 'dismiss' && op.result === null, '破棄操作');
  }
  const expenses = data.operations
    .filter((op) => op.status === 'done' && op.command.type === 'expense')
    .sort(
      (a, b) =>
        (logs.get(a.id)?.sequence ?? 0) - (logs.get(b.id)?.sequence ?? 0),
    );
  const latestExpense = expenses.at(-1);
  const expectedExpense =
    latestExpense?.command.type === 'expense'
      ? latestExpense.command.amount
      : null;
  requireValid(data.meta.expenseTotal === expectedExpense, '経費と変更記録');
  for (const log of data.logs)
    requireValid(ops.has(log.operationId), 'ログに対応する操作がありません');
}
export function encodeBackup(snapshot: Snapshot): string {
  const data = dataSchema.parse(snapshot);
  validate(data);
  return JSON.stringify(
    {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      counts: Object.fromEntries(
        collectionKeys.map((key) => [key, data[key].length]),
      ),
      data,
    },
    null,
    2,
  );
}
export function parseBackup(text: string): Snapshot {
  if (text.length > MAX_BACKUP_BYTES)
    throw new Error(
      `ファイルが大きすぎます。${MAX_BACKUP_BYTES / 1_000_000}MB以下のJSONを選んでください。`,
    );
  const file = backupSchema.parse(JSON.parse(text));
  for (const key of collectionKeys)
    requireValid(file.counts[key] === file.data[key].length, `${key}の件数`);
  validate(file.data);
  return file.data;
}
export function validateSnapshot(snapshot: Snapshot): Snapshot {
  const parsed = dataSchema.parse(snapshot);
  validate(parsed);
  return parsed;
}
