import {
  BUSINESS_CLOSE_MINUTE,
  BUSINESS_OPEN_MINUTE,
  TIME_SLOT_MINUTES,
} from '../domain/constants';
import type { Snapshot } from '../domain/model';
import { clockText } from '../domain/time';

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

/** A history time filter: an empty value means every time. */
export type TimeSlot = { value: string; label: string; from?: number };

/** Every time, then each slot within business hours. */
export const timeSlotOptions: TimeSlot[] = [
  { value: '', label: 'すべての時間' },
  ...Array.from(
    {
      length:
        (BUSINESS_CLOSE_MINUTE - BUSINESS_OPEN_MINUTE) / TIME_SLOT_MINUTES,
    },
    (_, index) => {
      const from = BUSINESS_OPEN_MINUTE + index * TIME_SLOT_MINUTES;
      const to = from + TIME_SLOT_MINUTES;
      return {
        value: String(from),
        label: `${clockText(from)}–${clockText(to)}`,
        from,
      };
    },
  ),
];

/** Placeholder for an event name, e.g. `例：早稲田祭 2026`. */
export function eventNameExample(yearsAhead = 0): string {
  return yearsAhead
    ? `例：早稲田祭 ${new Date().getFullYear() + yearsAhead}`
    : '例：早稲田祭';
}
