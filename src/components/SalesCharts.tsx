import { useId } from 'react';
import type { Order } from '../domain/model';
import { products } from '../domain/model';
import { salesByDay, salesByHour, summarizeSales } from '../domain/sales';
import { yen } from '../presentation/format';
function Bars({
  title,
  rows,
  money,
}: {
  title: string;
  rows: { label: string; value: number }[];
  money: boolean;
}) {
  const heading = useId(),
    max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <figure className="sales-chart" aria-labelledby={heading}>
      <figcaption id={heading}>{title}</figcaption>
      {rows.length ? (
        <div className="chart-bars">
          {rows.map((row) => (
            <div className="chart-row" key={row.label}>
              <span>{row.label}</span>
              <div className="chart-track">
                <span style={{ width: `${(row.value / max) * 100}%` }} />
              </div>
              <strong>{money ? yen(row.value) : `${row.value}本`}</strong>
            </div>
          ))}
        </div>
      ) : (
        <p className="chart-empty">会計が入ると表示されます。</p>
      )}
    </figure>
  );
}
export function SalesCharts({
  orders,
  scope,
}: {
  orders: readonly Order[];
  scope: 'day' | 'event';
}) {
  const summary = summarizeSales(orders);
  const revenue =
    scope === 'event'
      ? salesByDay(orders).map((row) => ({
          label: new Intl.DateTimeFormat('ja-JP', {
            month: 'numeric',
            day: 'numeric',
            timeZone: 'Asia/Tokyo',
          }).format(new Date(`${row.day}T00:00:00+09:00`)),
          value: row.sales,
        }))
      : salesByHour(orders).map((row) => ({
          label: `${row.hour}時`,
          value: row.sales,
        }));
  return (
    <div className="sales-charts">
      <Bars
        title={scope === 'event' ? '日別の売上' : '時刻別の売上'}
        rows={revenue}
        money
      />
      <Bars
        title="種類別の販売本数"
        rows={products.map((p) => ({
          label: p.name,
          value: summary.quantities[p.id],
        }))}
        money={false}
      />
    </div>
  );
}
