import Dexie from 'dexie';
import type { Table } from 'dexie';
import type {
  Log,
  Meta,
  Operation,
  Order,
  Price,
  Ticket,
} from '../domain/model';

export class Database extends Dexie {
  meta!: Table<Meta, string>;
  prices!: Table<Price, string>;
  orders!: Table<Order, string>;
  tickets!: Table<Ticket, number>;
  operations!: Table<Operation, string>;
  logs!: Table<Log, number>;
  constructor(name = 'yakitoriningen-v1') {
    super(name, { cache: 'disabled', chromeTransactionDurability: 'strict' });
    this.version(1).stores({
      meta: 'key',
      prices: 'id',
      orders: 'id, &confirmOperationId, status, day',
      tickets: 'number',
      operations: 'id, status',
      logs: 'sequence, &operationId',
    });
  }
}
