import type { Snapshot } from './model';

const MAX_SAMPLES = 10;
type WaitRecords = Pick<Snapshot, 'orders' | 'operations' | 'logs'>;

/** Recent paid-to-ticket-return durations; this is observed service time, not a queue prediction. */
function samples(snapshot: WaitRecords, day: string, now: number) {
  const orders = new Map(
    snapshot.orders
      .filter(
        (order) =>
          order.day === day &&
          order.status === 'paid' &&
          order.delivered &&
          order.returned &&
          order.paidAt,
      )
      .map((order) => [order.id, order]),
  );
  const operations = new Map(
    snapshot.operations.map((operation) => [operation.id, operation]),
  );
  const completions = new Map<
    string,
    { sequence: number; at: number; duration: number }
  >();
  for (const log of snapshot.logs) {
    const operation = operations.get(log.operationId);
    if (!operation || operation.status !== 'done') continue;
    const command = operation.command;
    if (command.type !== 'complete' && command.type !== 'return') continue;
    const order = orders.get(command.orderId);
    if (!order || command.assignmentId !== order.assignmentId) continue;
    const at = Date.parse(log.at);
    const duration = at - Date.parse(order.paidAt!);
    if (
      !Number.isFinite(at) ||
      !Number.isFinite(duration) ||
      duration < 0 ||
      at > now
    )
      continue;
    if ((completions.get(order.id)?.sequence ?? -1) < log.sequence)
      completions.set(order.id, { sequence: log.sequence, at, duration });
  }
  return [...completions.values()].sort((a, b) => b.at - a.at);
}
function mean(durations: { duration: number }[]): number | null {
  if (!durations.length) return null;
  return Math.max(
    1,
    Math.round(
      durations.reduce((sum, sample) => sum + sample.duration, 0) /
        durations.length /
        60_000,
    ),
  );
}
/** Mean of the latest ten ticket returns on the current business day. */
export function waitTime(snapshot: Snapshot, now: number): number | null {
  return mean(samples(snapshot, snapshot.meta.day, now).slice(0, MAX_SAMPLES));
}
/** Daily reports derive the mean from persisted payment and ticket-return logs. */
export function dailyWaitTime(
  snapshot: WaitRecords,
  day: string,
): number | null {
  return mean(samples(snapshot, day, Number.POSITIVE_INFINITY));
}
