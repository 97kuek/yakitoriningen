import type { Snapshot } from '../domain/model';
import { clockText } from '../domain/time';

const HOURS_PER_DAY = 24;

/** Business days with orders, plus the current day, in order. */
export function festivalDays(
  snapshot: Pick<Snapshot, 'meta' | 'orders'>,
): string[] {
  return [
    ...new Set([
      snapshot.meta.day,
      ...snapshot.orders.map((order) => order.day),
    ]),
  ].sort();
}

export function festivalTitle(snapshot: Pick<Snapshot, 'meta'>): string {
  const [year, month, day] = snapshot.meta.day.split('-');
  return `${year}年度 早稲田祭　${Number(month)}月${Number(day)}日`;
}

export const hourOptions = [
  { value: '', label: 'すべての時間' },
  ...Array.from({ length: HOURS_PER_DAY }, (_, hour) => ({
    value: String(hour).padStart(2, '0'),
    label: `${clockText(hour * 60)}–${clockText((hour + 1) * 60)}`,
  })),
];

/** Placeholder for an event name, e.g. `例：早稲田祭 2026`. */
export function eventNameExample(yearsAhead = 0): string {
  return `例：早稲田祭 ${new Date().getFullYear() + yearsAhead}`;
}
