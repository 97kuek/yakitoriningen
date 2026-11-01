import type { Snapshot } from '../domain/model';

export function festivalDays(snapshot: Snapshot): string[] {
  return [
    ...new Set([
      snapshot.meta.day,
      ...snapshot.orders.map((order) => order.day),
    ]),
  ].sort();
}

export function festivalTitle(snapshot: Snapshot): string {
  const [year, month, day] = snapshot.meta.day.split('-');
  return `${year}年度 早稲田祭　${Number(month)}月${Number(day)}日`;
}

export const hourOptions = [
  { value: '', label: 'すべての時間' },
  ...Array.from({ length: 24 }, (_, hour) => ({
    value: String(hour).padStart(2, '0'),
    label: `${String(hour).padStart(2, '0')}:00–${String(hour + 1).padStart(2, '0')}:00`,
  })),
];
