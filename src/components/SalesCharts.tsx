import { useState } from 'react';
import type { Snapshot } from '../domain/model';
import { TIME_SLOT_MINUTES } from '../domain/constants';
import { quantitiesByProduct, salesByHalfHour } from '../domain/sales';
import { clockText } from '../domain/time';
import { festivalDays } from '../presentation/festival';
import { dayText, yen } from '../presentation/format';
import { Select } from './controls';
import './SalesCharts.css';

const colors = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
];
// Slices beyond the palette are grouped as "other"; exact values stay in the legend.
const NAMED_SLICES = colors.length - 1;
const MIN_BAR_WIDTH_PX = 48;

export function SalesCharts({ snapshot }: { snapshot: Snapshot }) {
  const [selectedDay, setDay] = useState(snapshot.meta.day);
  const days = festivalDays(snapshot);
  const day = days.includes(selectedDay) ? selectedDay : snapshot.meta.day;
  const orders = snapshot.orders.filter((order) => order.day === day);
  const slots = salesByHalfHour(orders);
  const maximum = Math.max(1, ...slots.map((slot) => slot.sales));
  const products = quantitiesByProduct(orders);
  const total = products.reduce((sum, product) => sum + product.quantity, 0);
  const grouped = products.length > colors.length;
  const others = products.slice(NAMED_SLICES);
  const slices = grouped
    ? [
        ...products.slice(0, NAMED_SLICES),
        {
          id: 'other',
          name: 'その他',
          quantity: others.reduce((sum, product) => sum + product.quantity, 0),
        },
      ]
    : products;
  let offset = 0;
  const gradient = slices
    .map((item, index) => {
      const from = offset;
      offset += (item.quantity / total) * 100;
      return `${colors[index]} ${from}% ${offset}%`;
    })
    .join(',');
  return (
    <section className="sales-charts" aria-label="日別のグラフ">
      <div className="chart-heading">
        <h3>日別のグラフ</h3>
        <Select
          label="グラフの日付"
          value={day}
          onChange={setDay}
          options={days.map((day) => ({
            value: day,
            label: dayText(day),
          }))}
        />
      </div>
      <div className="chart-grid">
        <figure>
          <figcaption>{TIME_SLOT_MINUTES}分ごとの売上</figcaption>
          {slots.length ? (
            <>
              <div className="bar-scale" aria-hidden="true">
                {yen(maximum)}
              </div>
              <div
                className="bar-scroll"
                tabIndex={0}
                aria-label={`${TIME_SLOT_MINUTES}分ごとの売上グラフ`}
              >
                <div
                  className="sales-bars"
                  style={{
                    gridTemplateColumns: `repeat(${slots.length}, minmax(${MIN_BAR_WIDTH_PX}px, 1fr))`,
                  }}
                >
                  {slots.map((slot) => (
                    <div className="sales-bar" key={slot.minute}>
                      <div
                        className="bar-track"
                        tabIndex={0}
                        aria-label={`${clockText(slot.minute)}〜${clockText(slot.minute + TIME_SLOT_MINUTES)} ${yen(slot.sales)}`}
                      >
                        <div
                          className="bar-fill"
                          style={{ height: `${(slot.sales / maximum) * 100}%` }}
                        />
                        <span className="bar-value">{yen(slot.sales)}</span>
                      </div>
                      <span className="bar-time">{clockText(slot.minute)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <p className="chart-empty">売上はまだありません</p>
          )}
        </figure>
        <figure>
          <figcaption>
            商品の内訳<span>販売本数</span>
          </figcaption>
          {total ? (
            <div className="product-chart">
              <div
                className="quantity-pie"
                role="img"
                aria-label={slices
                  .map((item) => `${item.name} ${item.quantity}本`)
                  .join('、')}
                style={{ background: `conic-gradient(${gradient})` }}
              />
              <ul className="chart-legend">
                {slices.map((item, index) => (
                  <li key={item.id}>
                    <span
                      className="chart-key"
                      style={{ background: colors[index] }}
                    />
                    <span>{item.name}</span>
                    <strong>{item.quantity}本</strong>
                    <span>{Math.round((item.quantity / total) * 100)}%</span>
                  </li>
                ))}
              </ul>
              {grouped && (
                <p className="other-products">
                  その他：
                  {others
                    .map((item) => `${item.name} ${item.quantity}本`)
                    .join(' ／ ')}
                </p>
              )}
            </div>
          ) : (
            <p className="chart-empty">販売はまだありません</p>
          )}
        </figure>
      </div>
    </section>
  );
}
