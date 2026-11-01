import { getMenu } from '../domain/catalog';
import type { Order, Snapshot } from '../domain/model';
import { JAPAN_TIME_ZONE } from '../domain/time';

// Excel needs a byte order mark to read UTF-8 CSV as Japanese text.
const UTF8_BOM = '﻿';
const CSV_LINE_BREAK = '\r\n';

const timeFormat = new Intl.DateTimeFormat('ja-JP', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
  timeZone: JAPAN_TIME_ZONE,
});
const statusLabels: Record<Order['status'], string> = {
  pending: '保留',
  paid: '会計済み',
  cancelled: '取消済み',
};

const escape = (value: string | number | null) =>
  `"${String(value ?? '').replaceAll('"', '""')}"`;

/** Spreadsheet export of orders. It is for totals only and cannot restore data. */
export function ordersCsv(
  snapshot: Pick<Snapshot, 'prices' | 'orders'>,
): string {
  const columns = new Map<string, string>();
  for (const price of snapshot.prices)
    for (const item of getMenu(price)) columns.set(item.id, item.name);
  for (const order of snapshot.orders)
    for (const [id, name] of Object.entries(order.names))
      if (!columns.has(id)) columns.set(id, name);
  const productIds = [...columns.keys()];
  const header = [
    '注文ID',
    '開催回',
    '営業日',
    '注文時刻',
    '札番号',
    '状態',
    ...columns.values(),
    '会計額',
    '受領額',
    '釣銭',
    '返金額',
    '売上',
    '受渡済',
    '札回収済',
    '取消理由',
  ];
  const rows = snapshot.orders.map((o) => [
    o.id,
    o.event,
    o.day,
    timeFormat.format(new Date(o.createdAt)),
    o.ticket,
    statusLabels[o.status],
    ...productIds.map((id) => o.quantities[id] ?? 0),
    o.quote.total,
    o.received,
    o.change,
    o.refunded,
    o.received === null ? 0 : o.quote.total - o.refunded,
    o.delivered ? '受け渡し済み' : '未受け渡し',
    o.returned ? '回収済み' : '未回収',
    o.cancelReason,
  ]);
  return (
    UTF8_BOM +
    [header, ...rows]
      .map((row) => row.map(escape).join(','))
      .join(CSV_LINE_BREAK)
  );
}
