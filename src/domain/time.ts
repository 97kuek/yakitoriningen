export const JAPAN_TIME_ZONE = 'Asia/Tokyo';

// Japan has no daylight saving time, so a fixed offset is exact.
const JAPAN_UTC_OFFSET_MINUTES = 9 * 60;
const MINUTES_PER_DAY = 24 * 60;
const MILLISECONDS_PER_MINUTE = 60_000;

/** Minutes since midnight in Japan, or NaN for an invalid timestamp. */
export function japanMinuteOfDay(at: string): number {
  const minutes =
    Math.floor(new Date(at).getTime() / MILLISECONDS_PER_MINUTE) +
    JAPAN_UTC_OFFSET_MINUTES;
  return ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

/** `HH:MM` for minutes since midnight. 24:00 is allowed as an end of day. */
export function clockText(minute: number): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`;
}
