import type { Command, Context } from './domain/model';
export type ActionHandler = (work: () => Promise<unknown>) => Promise<void>;
export type CommandSaver = (
  command: Command,
  operationId?: string,
) => Promise<string>;
export type Shared = {
  perform: ActionHandler;
  saveCommand: CommandSaver;
  context: Context;
  busy: boolean;
  errorMessage: string;
};
export const commandNames = {
  reserve: '札の確保',
  pay: '会計確定',
  deliver: '受け渡し',
  complete: '受け渡し・札回収',
  undoHandoff: '受け渡し完了の取り消し',
  return: '札の回収',
  cancel: '取消',
  price: '価格変更',
  expense: '経費の変更',
  day: '営業日変更',
  tickets: '札の範囲変更',
};
