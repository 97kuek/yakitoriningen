import type {
  Command,
  Context,
  Price,
  Quantities,
  Snapshot,
} from './domain/model';
export type BackupExporter = () => Promise<Snapshot>;

export type ActionHandler = (work: () => Promise<unknown>) => Promise<void>;
export type CommandSaver = (
  command: Command,
  operationId?: string,
) => Promise<string>;

/** Props every screen receives from App. */
export type Shared = {
  perform: ActionHandler;
  saveCommand: CommandSaver;
  context: Context;
  busy: boolean;
  errorMessage: string;
};

/** The order being entered. The price is fixed when the first skewer is added. */
export type Draft = { quantities: Quantities; price: Price | null };
export const emptyDraft = (): Draft => ({ quantities: {}, price: null });

/** The latest handoff, kept so it can be undone. */
export type Handoff = { orderId: string; completionId: string };

/** Operator-facing names of stored command types. */
export const commandNames: Record<Command['type'], string> = {
  reserve: '札の確保',
  pay: '会計確定',
  deliver: '受け渡し',
  complete: '受け渡し・札回収',
  undoHandoff: '受け渡し完了の取り消し',
  return: '札の回収',
  cancel: '取消',
  price: '価格変更',
  expense: '経費の変更',
  stock: '在庫の変更',
  adjustStock: '在庫の調整',
  resumeDay: '営業日の再開',
  catalog: '商品・価格・在庫の変更',
  startDay: '営業日の準備',
  day: '営業日変更',
  tickets: '札の範囲変更',
};
