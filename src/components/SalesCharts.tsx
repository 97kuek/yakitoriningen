import { useState } from 'react';
import type { Snapshot } from '../domain/model';
import { quantitiesByProduct, salesByHalfHour } from '../domain/sales';
import { festivalDays } from '../presentation/festival';
import { dayText, yen } from '../presentation/format';
import { Select } from './controls';
import './SalesCharts.css';

const colors = ['var(--yellow)', 'var(--ink)', '#96968c', '#d5d5ca'];
const clock = (minute: number) =>
  `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;

export function SalesCharts({ snapshot }: { snapshot: Snapshot }) {
  const [selectedDay, setDay] = useState(snapshot.meta.day);
  const days = festivalDays(snapshot);
  const day = days.includes(selectedDay) ? selectedDay : snapshot.meta.day;
  const orders = snapshot.orders.filter((order) => order.day === day);
  const slots = salesByHalfHour(orders);
  const maximum = Math.max(1, ...slots.map((slot) => slot.sales));
  const products = quantitiesByProduct(orders);
  const total = products.reduce((sum, product) => sum + product.quantity, 0);
  // Keep the chart readable with a large menu, with exact values in the legend.
  const slices =
    products.length <= 4
      ? products
      : [
          ...products.slice(0, 3),
          {
            id: 'other',
            name: 'その他',
            quantity: products
              .slice(3)
              .reduce((sum, product) => sum + product.quantity, 0),
          },
        ];
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
          <figcaption>30分ごとの売上</figcaption>
          {slots.length ? (
            <>
              <div className="bar-scale" aria-hidden="true">
                {yen(maximum)}
              </div>
              <div
                className="bar-scroll"
                tabIndex={0}
                aria-label="30分ごとの売上グラフ"
              >
                <div
                  className="sales-bars"
                  style={{
                    gridTemplateColumns: `repeat(${slots.length}, minmax(48px, 1fr))`,
                  }}
                >
                  {slots.map((slot) => (
                    <div className="sales-bar" key={slot.minute}>
                      <div
                        className="bar-track"
                        tabIndex={0}
                        aria-label={`${clock(slot.minute)}〜${clock(slot.minute + 30)} ${yen(slot.sales)}`}
                      >
                        <div
                          className="bar-fill"
                          style={{ height: `${(slot.sales / maximum) * 100}%` }}
                        />
                        <span className="bar-value">{yen(slot.sales)}</span>
                      </div>
                      <span className="bar-time">{clock(slot.minute)}</span>
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
              {products.length > 4 && (
                <p className="other-products">
                  その他：
                  {products
                    .slice(3)
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
