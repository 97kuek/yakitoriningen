import type {
  Command,
  Context,
  Log,
  Meta,
  Operation,
  Order,
  Price,
  Catalog,
  Snapshot,
  Ticket,
} from '../domain/model';

/** Atomic access to the ledger. Implementations decide how records are persisted. */
export interface Records<T, K> {
  get(key: K): Promise<T | undefined>;
  add(value: T): Promise<unknown>;
  put(value: T): Promise<unknown>;
  delete(key: K): Promise<void>;
  bulkAdd(values: T[]): Promise<unknown>;
  clear(): Promise<void>;
  count(): Promise<number>;
  toArray(): Promise<T[]>;
}
export interface LedgerTransaction {
  meta: Records<Meta, string>;
  prices: Pick<
    Records<Price, string>,
    'get' | 'add' | 'bulkAdd' | 'clear' | 'count' | 'toArray'
  >;
  orders: Records<Order, string>;
  tickets: Records<Ticket, number>;
  operations: Records<Operation, string>;
  logs: Pick<
    Records<Log, number>,
    'add' | 'bulkAdd' | 'clear' | 'count' | 'toArray'
  >;
}
export interface LedgerRepository {
  read<T>(work: (tx: LedgerTransaction) => Promise<T>): Promise<T>;
  write<T>(work: (tx: LedgerTransaction) => Promise<T>): Promise<T>;
}
/** The application boundary consumed by the cashier screens. */
export interface Cashier {
  read(): Promise<Snapshot | null>;
  initialize(
    event: string,
    day: string,
    tickets: number,
    settings?: Catalog,
  ): Promise<Context>;
  prepare(id: string, context: Context, command: Command): Promise<Operation>;
  execute(id: string, context: Context): Promise<string>;
  discard(id: string, context: Context): Promise<void>;
  restore(snapshot: Snapshot, expected: Snapshot | null): Promise<void>;
  watch(observer: {
    next: (snapshot: Snapshot | null) => void;
    error: (error: unknown) => void;
  }): () => void;
}

/** Download reminders only; never evidence that a file reached a physical disk. */
export interface BackupHistory {
  lastSequence(meta: Meta): number | null;
  record(meta: Meta): void;
}
