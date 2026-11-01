import type { Snapshot } from './model';

/** Starting a new day preserves the ledger and requires the previous work to be settled. */
export function validateDaySetup(
  snapshot: Snapshot,
  day: string,
  expectedSequence: number,
  operationId?: string,
) {
  validateDayChange(snapshot, expectedSequence, operationId);
  if (day === snapshot.meta.day || businessDays(snapshot).includes(day))
    throw new Error(
      'この営業日の記録があります。保存済みの営業日から選んでください。',
    );
}

export function validateDayChange(
  snapshot: Snapshot,
  expectedSequence: number,
  operationId?: string,
) {
  if (snapshot.meta.sequence !== expectedSequence)
    throw new Error(
      '準備中に記録が変わりました。営業日の準備を開き直してください。',
    );
  if (
    snapshot.operations.some(
      (op) => op.id !== operationId && op.status === 'pending',
    ) ||
    snapshot.tickets.some((ticket) => ticket.orderId !== null)
  )
    throw new Error(
      '途中の会計と番号札の回収を終えてから、別の日を準備してください。',
    );
}

export function businessDays(snapshot: Snapshot): string[] {
  return [
    ...new Set([
      snapshot.meta.day,
      ...snapshot.orders.map((order) => order.day),
      ...snapshot.operations
        .filter((op) => op.status === 'done')
        .map((op) => op.day),
    ]),
  ].sort();
}

/** Reopen committed settings without creating a new catalog or rewriting historical records. */
export function daySettings(snapshot: Snapshot, day: string) {
  if (!businessDays(snapshot).includes(day))
    throw new Error('保存済みの営業日を選んでください。');
  const sequences = new Map(
    snapshot.logs.map((log) => [log.operationId, log.sequence]),
  );
  const commands = snapshot.operations
    .filter((op) => op.day === day && op.status === 'done')
    .sort((a, b) => (sequences.get(b.id) ?? 0) - (sequences.get(a.id) ?? 0))
    .map((op) => op.command);
  const catalog = commands.find(
    (command) => 'price' in command && command.type !== 'reserve',
  );
  const ticket = commands.find(
    (command) => command.type === 'tickets' || command.type === 'startDay',
  );
  return {
    price:
      catalog && 'price' in catalog
        ? catalog.price
        : (snapshot.orders.filter((order) => order.day === day).at(-1)?.price ??
          snapshot.prices[0]),
    ticketCount:
      ticket?.type === 'tickets'
        ? ticket.count
        : ticket?.type === 'startDay'
          ? ticket.ticketCount
          : snapshot.meta.ticketCount,
  };
}
