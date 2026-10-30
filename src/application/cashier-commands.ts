import {
  commandSchema,
  metaSchema,
  normalPrice,
  operationSchema,
  products,
} from '../domain/model';
import type {
  Command,
  Context,
  Meta,
  Operation,
  Order,
  Snapshot,
} from '../domain/model';
import { quote } from '../domain/pricing';
import { changeOrder } from '../domain/order';
import type { LedgerRepository } from './ports';
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
export class CashierCommands {
  constructor(
    private readonly repository: LedgerRepository,
    private readonly newId: () => string,
    private readonly now: () => string,
  ) {}
  async read(): Promise<Snapshot | null> {
    return this.repository.read(async (tx) => {
      const meta = await tx.meta.get('main');
      if (!meta) {
        for (const table of Object.values(tx))
          if (await table.count())
            throw new Error(
              '保存情報が不完全です。新規営業を始めず、バックアップを復元してください。',
            );
        return null;
      }
      return {
        meta,
        prices: await tx.prices.toArray(),
        orders: await tx.orders.toArray(),
        tickets: await tx.tickets.toArray(),
        operations: await tx.operations.toArray(),
        logs: await tx.logs.toArray(),
      };
    });
  }
  async initialize(
    event: string,
    day: string,
    tickets: number,
  ): Promise<Context> {
    const price = normalPrice(this.newId());
    const meta = metaSchema.parse({
      key: 'main',
      databaseId: this.newId(),
      generation: this.newId(),
      event,
      day,
      activePriceId: price.id,
      ticketCount: tickets,
      sequence: 0,
    });
    await this.repository.write(async (tx) => {
      for (const table of Object.values(tx))
        if (await table.count())
          throw new Error('既存データがあります。初期化できません。');
      await tx.meta.add(meta);
      await tx.prices.add(price);
      await tx.tickets.bulkAdd(
        Array.from({ length: tickets }, (_, i) => ({
          number: i + 1,
          orderId: null,
          assignmentId: null,
        })),
      );
    });
    return { databaseId: meta.databaseId, generation: meta.generation };
  }
  async stage(
    id: string,
    context: Context,
    input: Command,
  ): Promise<Operation> {
    const command = commandSchema.parse(input);
    return this.repository.write(async (tx) => {
      const meta = await tx.meta.get('main');
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
        day: meta.day,
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
      const meta = await tx.meta.get('main');
      assertContext(meta, context);
      const op = await tx.operations.get(id);
      if (!op) throw new Error('照合する操作が見つかりません。');
      assertContext(meta, op.context);
      if (op.status === 'done') return op.result!;
      if (op.status !== 'pending') throw new Error('この操作は破棄済みです。');
      const command = commandSchema.parse(op.command);
      let result = '設定';
      if (command.type === 'reserve') {
        const price = await tx.prices.get(command.price.id);
        if (!price || canonical(price) !== canonical(command.price))
          throw new Error('価格設定が一致しません。');
        const estimate = quote(command.quantities, price);
        if (estimate.count === 0)
          throw new Error('商品を1本以上入力してください。');
        if (
          command.confirmOperationId === id ||
          (await tx.operations.get(command.confirmOperationId))
        )
          throw new Error('確定操作IDが既に使用されています。');
        const ticket = (await tx.tickets.toArray()).find(
          (t) => t.orderId === null && t.number <= meta.ticketCount,
        );
        if (!ticket)
          throw new Error(
            '空き札がありません。現金を受け取らず、札の回収を待ってください。',
          );
        const order: Order = {
          id: command.orderId,
          assignmentId: command.assignmentId,
          confirmOperationId: command.confirmOperationId,
          event: op.event,
          day: op.day,
          ticket: ticket.number,
          quantities: command.quantities,
          names: Object.fromEntries(
            products.map((p) => [p.id, p.name]),
          ) as Order['names'],
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
        });
        result = order.id;
      } else if ('orderId' in command) {
        const current = await tx.orders.get(command.orderId);
        if (!current) throw new Error('注文と札の割り当てが一致しません。');
        const payment =
          command.type === 'cancel' && current.status === 'pending'
            ? await tx.operations.get(current.confirmOperationId)
            : undefined;
        const order = changeOrder(
          current,
          command,
          id,
          this.now(),
          payment?.status === 'pending',
        );
        const ticket = await tx.tickets.get(order.ticket);
        // A historical paid order can be cancelled after ticket reuse, without touching that ticket.
        const owns =
          ticket?.orderId === order.id &&
          ticket.assignmentId === order.assignmentId;
        if (command.type !== 'cancel' && !owns)
          throw new Error(
            '札の現在の所有者が異なります。古い操作は実行できません。',
          );
        if (
          owns &&
          order.returned &&
          (order.delivered || order.status === 'cancelled')
        )
          await tx.tickets.put({
            number: order.ticket,
            orderId: null,
            assignmentId: null,
          });
        await tx.orders.put(order);
        result = order.id;
      } else if (command.type === 'price') {
        if (await tx.prices.get(command.price.id))
          throw new Error('価格の版が既に使われています。');
        await tx.prices.add(command.price);
        meta.activePriceId = command.price.id;
      } else if (command.type === 'day') {
        meta.day = command.day;
      } else if (command.type === 'tickets') {
        const all = await tx.tickets.toArray();
        if (all.some((t) => t.number > command.count && t.orderId !== null))
          throw new Error('使用中の札を番号範囲から外すことはできません。');
        for (const t of all)
          if (t.number > command.count) await tx.tickets.delete(t.number);
        for (let number = 1; number <= command.count; number++)
          if (!all.some((t) => t.number === number))
            await tx.tickets.add({
              number,
              orderId: null,
              assignmentId: null,
            });
        meta.ticketCount = command.count;
      }
      meta.sequence++;
      await tx.logs.add({
        sequence: meta.sequence,
        operationId: id,
        type: command.type,
        target: result,
        at: this.now(),
      });
      await tx.meta.put(meta);
      await tx.operations.put({ ...op, status: 'done', result });
      return result;
    });
  }
  async dismiss(id: string, context: Context): Promise<void> {
    await this.repository.write(async (tx) => {
      const meta = await tx.meta.get('main');
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
      meta.sequence++;
      await tx.logs.add({
        sequence: meta.sequence,
        operationId: id,
        type: 'dismiss',
        target: '現金・現物を照合して破棄',
        at: this.now(),
      });
      await tx.operations.put({ ...op, status: 'dismissed' });
      await tx.meta.put(meta);
    });
  }
}
