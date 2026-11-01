import { expect, it } from 'vitest';
import { festivalDays, festivalTitle, timeSlotOptions } from './festival';
import type { Snapshot } from '../domain/model';

it('準備日や訂正履歴を開催日数として数えず年度と日付を示す', () => {
  const snapshot = {
    meta: { day: '2026-11-07' },
    orders: [],
    operations: [
      {
        status: 'done',
        day: '2026-11-06',
        command: { type: 'day', day: '2026-11-07' },
      },
    ],
  } as unknown as Snapshot;
  expect(festivalTitle(snapshot)).toBe('2026年度 早稲田祭　11月7日');
  expect(festivalDays(snapshot)).toEqual(['2026-11-07']);
});

it('注文日と現在の日付だけを重複なく並べる', () => {
  expect(
    festivalDays({
      meta: { day: '2026-11-08' },
      orders: [{ day: '2026-11-07' }, { day: '2026-11-07' }],
    } as Snapshot),
  ).toEqual(['2026-11-07', '2026-11-08']);
});

it('時間帯は全時間と、営業時間10:00〜17:00の30分ごとの14枠を用意する', () => {
  expect(timeSlotOptions).toHaveLength(15);
  expect(timeSlotOptions[0]).toEqual({ value: '', label: 'すべての時間' });
  expect(timeSlotOptions[1]).toEqual({
    value: '600',
    label: '10:00–10:30',
    from: 600,
  });
  expect(timeSlotOptions.at(-1)).toEqual({
    value: '990',
    label: '16:30–17:00',
    from: 990,
  });
});
