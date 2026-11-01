import { useState } from 'react';
import type { Snapshot } from '../domain/model';
import { TIME_SLOT_MINUTES } from '../domain/constants';
import {
  quantitiesByHalfHour,
  quantitiesByProduct,
  salesByHalfHour,
} from '../domain/sales';
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
// Products beyond the palette are grouped as "other"; exact values stay in the legend.
const NAMED_SLICES = colors.length - 1;
// Yen labels need wider columns than skewer counts.
const SALES_BAR_WIDTH_PX = 48;
const QUANTITY_BAR_WIDTH_PX = 40;
const OTHER = 'other';

type Segment = { key: string; color: string; value: number };
type Slot = {
  minute: number;
  value: number;
  /** Shown above the bar and read by screen readers. */
  text: string;
  detail?: string;
  segments: Segment[];
};

const slotName = (minute: number) =>
  `${clockText(minute)}〜${clockText(minute + TIME_SLOT_MINUTES)}`;

/** Bars on the shared half-hour axis. Columns touch so the axis runs through empty slots. */
function SlotBars({
  label,
  slots,
  scale,
  minBarWidth,
}: {
  label: string;
  slots: Slot[];
  scale: (value: number) => string;
  minBarWidth: number;
}) {
  const maximum = Math.max(1, ...slots.map((slot) => slot.value));
  return (
    <>
      <div className="bar-scale" aria-hidden="true">
        {scale(maximum)}
      </div>
      <div className="bar-scroll" tabIndex={0} aria-label={label}>
        <div
          className="sales-bars"
          style={{
            gridTemplateColumns: `repeat(${slots.length}, minmax(${minBarWidth}px, 1fr))`,
          }}
        >
          {slots.map((slot) => (
            <div className="sales-bar" key={slot.minute}>
              <div
                className="bar-track"
                tabIndex={0}
                aria-label={`${slotName(slot.minute)} ${slot.text}${slot.detail ? `（${slot.detail}）` : ''}`}
              >
                <div
                  className="bar-fill"
                  style={{ height: `${(slot.value / maximum) * 100}%` }}
                >
                  {slot.segments.map((segment) => (
                    <div
                      key={segment.key}
                      className="bar-segment"
                      style={{
                        flexGrow: segment.value,
                        background: segment.color,
                      }}
                    />
                  ))}
                </div>
                {slot.value > 0 && (
                  <span className="bar-value" aria-hidden="true">
                    {slot.text}
                  </span>
                )}
              </div>
              <span className="bar-time">{clockText(slot.minute)}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export function SalesCharts({ snapshot }: { snapshot: Snapshot }) {
  const [selectedDay, setDay] = useState(snapshot.meta.day);
  const days = festivalDays(snapshot);
  const day = days.includes(selectedDay) ? selectedDay : snapshot.meta.day;
  const orders = snapshot.orders.filter((order) => order.day === day);
  const products = quantitiesByProduct(orders);
  const total = products.reduce((sum, product) => sum + product.quantity, 0);
  const grouped = products.length > colors.length;
  const others = products.slice(NAMED_SLICES);
  const slices = grouped
    ? [
        ...products.slice(0, NAMED_SLICES),
        {
          id: OTHER,
          name: 'その他',
          quantity: others.reduce((sum, product) => sum + product.quantity, 0),
        },
      ]
    : products;
  const sliceOf = (productId: string) => {
    const index = slices.findIndex((slice) => slice.id === productId);
    return index === -1 ? slices.length - 1 : index;
  };
  const nameOf = (productId: string) =>
    products.find((product) => product.id === productId)?.name ?? '商品';

  const salesSlots: Slot[] = salesByHalfHour(orders).map((slot) => ({
    minute: slot.minute,
    value: slot.sales,
    text: yen(slot.sales),
    segments: [{ key: 'sales', color: 'var(--ink)', value: slot.sales }],
  }));
  const quantitySlots: Slot[] = quantitiesByHalfHour(orders).map((slot) => {
    const bySlice = slices.map(() => 0);
    for (const [id, quantity] of Object.entries(slot.quantities))
      bySlice[sliceOf(id)] += quantity;
    return {
      minute: slot.minute,
      value: slot.total,
      text: `${slot.total}本`,
      detail: Object.entries(slot.quantities)
        .map(([id, quantity]) => `${nameOf(id)} ${quantity}本`)
        .join('、'),
      // Stack from the bottom in legend order.
      segments: slices
        .map((slice, index) => ({
          key: slice.id,
          color: colors[index],
          value: bySlice[index],
        }))
        .filter((segment) => segment.value > 0)
        .reverse(),
    };
  });

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
        <figure className="chart-wide">
          <figcaption>{TIME_SLOT_MINUTES}分ごとの売上</figcaption>
          {salesSlots.length ? (
            <SlotBars
              label={`${TIME_SLOT_MINUTES}分ごとの売上グラフ`}
              slots={salesSlots}
              scale={yen}
              minBarWidth={SALES_BAR_WIDTH_PX}
            />
          ) : (
            <p className="chart-empty">売上はまだありません</p>
          )}
        </figure>
        <figure>
          <figcaption>
            {TIME_SLOT_MINUTES}分ごとの販売本数<span>商品別</span>
          </figcaption>
          {total ? (
            <SlotBars
              label={`${TIME_SLOT_MINUTES}分ごとの販売本数グラフ`}
              slots={quantitySlots}
              scale={(value) => `${value}本`}
              minBarWidth={QUANTITY_BAR_WIDTH_PX}
            />
          ) : (
            <p className="chart-empty">販売はまだありません</p>
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
