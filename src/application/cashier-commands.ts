import {
  META_KEY,
  commandSchema,
  metaSchema,
  normalPrice,
  priceSchema,
  operationSchema,
} from '../domain/model';
import type {
  Command,
  Context,
  Meta,
  Operation,
  Order,
  Snapshot,
  Catalog,
} from '../domain/model';
import {
  availableStock,
  validateStock,
  adjustedStock,
} from '../domain/inventory';
import {
  validateDaySetup,
  validateDayChange,
  daySettings,
} from '../domain/day';
import { restoreDays } from './restore';
import { quote } from '../domain/pricing';
import { getMenu } from '../domain/catalog';
import { handoffUndoError } from '../domain/handoff';
import { applyOrderAction } from '../domain/order';
import { contextOf } from '../domain/snapshot';
import {
  freeTickets,
  ownsTicket,
  releasesTicket,
  chooseTicket,
} from '../domain/ticket';
import { validateSnapshot } from './backup';
import type { LedgerRepository, LedgerTransaction } from './ports';
import { canonical } from './serialization';

export function assertContext(
  meta: Meta | undefined,
  context: Context,
): asserts meta is Meta {
  if (
    !meta ||
    meta.databaseId !== context.databaseId ||
    meta.generation !== context.generation
  )
    throw new Error(
      '保存先または世代が変わりました。画面を再読み込みして記録を確認してください。',
    );
}

// Dexie can commit a transaction early when awaits are nested in several async
// helpers, so these helpers await the tables directly instead of calling each other.
async function isEmpty(tx: LedgerTransaction): Promise<boolean> {
  for (const table of Object.values(tx)) if (await table.count()) return false;
  return true;
}

async function readSnapshot(tx: LedgerTransaction): Promise<Snapshot | null> {
  const storedMeta = await tx.meta.get(META_KEY);
  if (!storedMeta) {
    for (const table of Object.values(tx))
      if (await table.count())
        throw new Error(
          '保存情報が不完全です。新規営業を始めず、バックアップを復元してください。',
        );
    return null;
  }
  return {
    meta: metaSchema.parse(storedMeta),
    prices: await tx.prices.toArray(),
    orders: await tx.orders.toArray(),
    tickets: await tx.tickets.toArray(),
    operations: await tx.operations.toArray(),
    logs: await tx.logs.toArray(),
  };
}

/** Use cases of the cashier. Every write validates the database generation and runs atomically. */
export class CashierCommands {
  constructor(
    private readonly repository: LedgerRepository,
    private readonly newId: () => string,
    private readonly now: () => string,
  ) {}

  read(): Promise<Snapshot | null> {
    return this.repository.read(readSnapshot);
  }

  async initialize(
    event: string,
    day: string,
    tickets: number,
    settings?: Catalog,
  ): Promise<Context> {
    const price = priceSchema.parse(
      settings?.price ?? normalPrice(this.newId()),
    );
    const opening = settings
      ? commandSchema.parse({
          type: 'startDay',
          day,
          price,
          stock: settings.stock,
          ticketCount: tickets,
          expectedSequence: 0,
        })
      : null;
    const meta = metaSchema.parse({
      key: META_KEY,
      databaseId: this.newId(),
      generation: this.newId(),
      event,
      day,
      activePriceId: price.id,
      ticketCount: tickets,
      sequence: 0,
    });
    await this.repository.write(async (tx) => {
      if (!(await isEmpty(tx)))
        throw new Error('既存データがあります。初期化できません。');
      await tx.meta.add(meta);
      await tx.prices.add(price);
      await tx.tickets.bulkAdd(freeTickets(tickets));
      if (opening) {
        const operation = operationSchema.parse({
          id: this.newId(),
          context: contextOf(meta),
          event: meta.event,
          day: meta.day,
          command: opening,
          status: 'done',
          result: '設定',
          createdAt: this.now(),
        });
        await tx.operations.add(operation);
        await this.appendLog(tx, meta, operation.id, opening.type, '設定');
      }
    });
    return contextOf(meta);
  }

  async prepare(
    id: string,
    context: Context,
    input: Command,
  ): Promise<Operation> {
    const command = commandSchema.parse(input);
    return this.repository.write(async (tx) => {
      const meta = await tx.meta.get(META_KEY);
      assertContext(meta, context);
      const prior = await tx.operations.get(id);
      if (prior) {
        if (
          canonical(prior.command) !== canonical(command) ||
          canonical(prior.context) !== canonical(context)
        )
          throw new Error('同じ操作IDで異なる入力は保存できません。');
        return prior;
      }
      const operation = operationSchema.parse({
        id,
        context,
        event: meta.event,
        day:
          command.type === 'startDay' || command.type === 'resumeDay'
            ? command.day
            : meta.day,
        command,
        status: 'pending',
        result: null,
        createdAt: this.now(),
      });
      await tx.operations.add(operation);
      return operation;
    });
  }

  async execute(id: string, context: Context): Promise<string> {
    return this.repository.write(async (tx) => {
      const meta = await tx.meta.get(META_KEY);
      assertContext(meta, context);
      const op = await tx.operations.get(id);
      if (!op) throw new Error('照合する操作が見つかりません。');
      assertContext(meta, op.context);
      if (op.status === 'done') return op.result!;
      if (op.status !== 'pending') throw new Error('この操作は破棄済みです。');
      const command = commandSchema.parse(op.command);
      if (
        op.day !== meta.day &&
        (command.type === 'reserve' ||
          (!('orderId' in command) &&
            command.type !== 'startDay' &&
            command.type !== 'resumeDay' &&
            command.type !== 'day'))
      )
        throw new Error(
          '営業日が変わりました。元の営業日に戻して再試行するか、この操作を取り消してください。',
        );
      let result = '設定';
      if (command.type === 'reserve') {
        result = await this.reserve(tx, meta, op, command);
      } else if ('orderId' in command) {
        result = await this.changeOrder(tx, id, command);
      } else if (command.type === 'startDay' || command.type === 'resumeDay') {
        const snapshot = (await readSnapshot(tx))!;
        if (command.type === 'startDay') {
          validateDaySetup(snapshot, command.day, command.expectedSequence, id);
          if (await tx.prices.get(command.price.id))
            throw new Error('価格の版が既に使われています。');
        } else validateDayChange(snapshot, command.expectedSequence, id);
        const settings =
          command.type === 'startDay'
            ? command
            : daySettings(snapshot, command.day);
        const opening = this.captureTickets(meta, snapshot);
        if (opening) {
          await tx.operations.add(opening);
          await this.appendLog(tx, meta, opening.id, 'tickets', '設定');
        }
        if (command.type === 'startDay') await tx.prices.add(command.price);
        await this.resizeTickets(tx, settings.ticketCount, meta.sequence + 1);
        meta.activePriceId = settings.price.id;
        meta.ticketCount = settings.ticketCount;
        meta.day = command.day;
      } else if (command.type === 'price' || command.type === 'catalog') {
        if (command.type === 'catalog')
          validateStock((await readSnapshot(tx))!, command.stock);
        if (await tx.prices.get(command.price.id))
          throw new Error('価格の版が既に使われています。');
        await tx.prices.add(command.price);
        meta.activePriceId = command.price.id;
      } else if (command.type === 'stock') {
        validateStock((await readSnapshot(tx))!, command.quantities);
      } else if (command.type === 'adjustStock') {
        adjustedStock(
          (await readSnapshot(tx))!,
          command.productId,
          command.change,
        );
      } else if (command.type === 'expense') {
        meta.expenseTotal = command.amount;
      } else if (command.type === 'day') {
        meta.day = command.day;
      } else if (command.type === 'tickets') {
        await this.resizeTickets(tx, command.count, meta.sequence + 1);
        meta.ticketCount = command.count;
      }
      await this.appendLog(tx, meta, id, command.type, result);
      await tx.operations.put({ ...op, status: 'done', result });
      return result;
    });
  }

  /** Capture an unlogged legacy opening count before leaving that day. */
  private captureTickets(meta: Meta, snapshot: Snapshot): Operation | null {
    if (
      snapshot.operations.some(
        (op) =>
          op.day === meta.day &&
          op.status === 'done' &&
          (op.command.type === 'tickets' || op.command.type === 'startDay'),
      )
    )
      return null;
    return {
      id: this.newId(),
      context: contextOf(meta),
      event: meta.event,
      day: meta.day,
      command: { type: 'tickets', count: meta.ticketCount },
      status: 'done',
      result: '設定',
      createdAt: this.now(),
    };
  }

  async discard(id: string, context: Context): Promise<void> {
    await this.repository.write(async (tx) => {
      const meta = await tx.meta.get(META_KEY);
      assertContext(meta, context);
      const op = await tx.operations.get(id);
      if (!op || op.status !== 'pending')
        throw new Error('照合待ちの操作ではありません。');
      // Old restored intentions can only be dismissed, never re-executed.
      if (op.command.type === 'pay') {
        const order = await tx.orders.get(op.command.orderId);
        if (order?.status === 'pending' && order.confirmOperationId === op.id) {
          await tx.orders.put({ ...order, confirmOperationId: this.newId() });
        }
      }
      await this.appendLog(tx, meta, id, 'dismiss', '現金・現物を照合して破棄');
      await tx.operations.put({ ...op, status: 'dismissed' });
    });
  }

  /**
   * Restore the dates in a validated snapshot, preserving other days and changing generation.
   * `expected` is the ledger the operator previewed; any later change aborts the restore.
   */
  async restore(snapshot: Snapshot, expected: Snapshot | null): Promise<void> {
    const validated = validateSnapshot(snapshot);
    await this.repository.write(async (tx) => {
      const current = await readSnapshot(tx);
      if (canonical(current) !== canonical(expected))
        throw new Error(
          '確認中に記録が変更されました。画面を開き直してください。',
        );
      const incoming = restoreDays(validated, current);
      for (const table of Object.values(tx)) await table.clear();
      await tx.meta.add({ ...incoming.meta, generation: this.newId() });
      await tx.prices.bulkAdd(incoming.prices);
      // A staged payment from the old generation must not confirm a restored order.
      await tx.orders.bulkAdd(
        incoming.orders.map((order) =>
          order.status === 'pending'
            ? { ...order, confirmOperationId: this.newId() }
            : order,
        ),
      );
      await tx.tickets.bulkAdd(incoming.tickets);
      await tx.operations.bulkAdd(incoming.operations);
      await tx.logs.bulkAdd(incoming.logs);
    });
  }

  private async reserve(
    tx: LedgerTransaction,
    meta: Meta,
    op: Operation,
    command: Extract<Command, { type: 'reserve' }>,
  ): Promise<string> {
    const price = await tx.prices.get(command.price.id);
    if (!price || canonical(price) !== canonical(command.price))
      throw new Error('価格設定が一致しません。');
    const available = availableStock((await readSnapshot(tx))!);
    for (const [id, value] of Object.entries(command.quantities))
      if (available[id] !== undefined && value > available[id])
        throw new Error('在庫が足りません。本数か在庫を確認してください。');
    const estimate = quote(command.quantities, price);
    if (estimate.count === 0)
      throw new Error('商品を1本以上入力してください。');
    if (
      command.confirmOperationId === op.id ||
      (await tx.operations.get(command.confirmOperationId))
    )
      throw new Error('確定操作IDが既に使用されています。');
    const ticket = chooseTicket(
      await tx.tickets.toArray(),
      meta.ticketCount,
      command.ticket,
    );
    const order: Order = {
      id: command.orderId,
      assignmentId: command.assignmentId,
      confirmOperationId: command.confirmOperationId,
      event: op.event,
      day: op.day,
      ticket: ticket.number,
      quantities: command.quantities,
      names: Object.fromEntries(getMenu(price).map((p) => [p.id, p.name])),
      price,
      quote: estimate,
      status: 'pending',
      received: null,
      change: null,
      delivered: false,
      returned: false,
      refunded: 0,
      createdAt: op.createdAt,
      paidAt: null,
      cancelReason: null,
    };
    await tx.orders.add(order);
    await tx.tickets.put({
      ...ticket,
      orderId: order.id,
      assignmentId: order.assignmentId,
      reuseSequence: meta.sequence + 1,
    });
    return order.id;
  }

  private async changeOrder(
    tx: LedgerTransaction,
    operationId: string,
    command: Extract<Command, { orderId: string }>,
  ): Promise<string> {
    const current = await tx.orders.get(command.orderId);
    if (!current) throw new Error('注文と札の割り当てが一致しません。');
    if (command.type === 'reserve') throw new Error('注文は作成済みです。');
    const payment =
      command.type === 'cancel' && current.status === 'pending'
        ? await tx.operations.get(current.confirmOperationId)
        : undefined;
    const order = applyOrderAction(
      current,
      command,
      operationId,
      this.now(),
      payment?.status === 'pending',
    );
    const ticket = await tx.tickets.get(order.ticket);
    // A historical paid order can be cancelled after ticket reuse, without touching that ticket.
    const owns = ownsTicket(ticket, order);
    if (command.type === 'undoHandoff') {
      const error = handoffUndoError(
        current,
        command.completionId,
        {
          orders: await tx.orders.toArray(),
          operations: await tx.operations.toArray(),
          logs: await tx.logs.toArray(),
        },
        ticket,
      );
      if (error) throw new Error(error);
      await tx.tickets.put({
        ...ticket,
        number: order.ticket,
        orderId: order.id,
        assignmentId: order.assignmentId,
      });
    }
    if (command.type !== 'cancel' && command.type !== 'undoHandoff' && !owns)
      throw new Error(
        '札の現在の所有者が異なります。古い操作は実行できません。',
      );
    if (owns && releasesTicket(order))
      await tx.tickets.put({
        ...ticket,
        number: order.ticket,
        orderId: null,
        assignmentId: null,
      });
    await tx.orders.put(order);
    return order.id;
  }

  private async resizeTickets(
    tx: LedgerTransaction,
    count: number,
    sequence: number,
  ) {
    const all = await tx.tickets.toArray();
    if (all.some((t) => t.number > count && t.orderId !== null))
      throw new Error('使用中の札を番号範囲から外すことはできません。');
    for (const t of all)
      if (t.number > count) await tx.tickets.delete(t.number);
    const existing = new Set(all.map((t) => t.number));
    for (const ticket of freeTickets(count))
      if (!existing.has(ticket.number))
        // Reintroduced numbers must not revive an old completion's undo action.
        await tx.tickets.add({ ...ticket, reuseSequence: sequence });
  }

  /** Every committed change gets the next sequence number in the same transaction. */
  private async appendLog(
    tx: LedgerTransaction,
    meta: Meta,
    operationId: string,
    type: string,
    target: string,
  ) {
    meta.sequence++;
    await tx.logs.add({
      sequence: meta.sequence,
      operationId,
      type,
      target,
      at: this.now(),
    });
    await tx.meta.put(meta);
  }
}
