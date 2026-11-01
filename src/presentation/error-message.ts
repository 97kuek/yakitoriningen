import { ZodError } from 'zod';

const STORAGE_ERROR_NAMES = new Set([
  'UnknownError',
  'OpenFailedError',
  'DatabaseClosedError',
  'InvalidStateError',
  'AbortError',
  'VersionError',
]);

// Internal terms in application errors, reworded for operators.
const WORDING: [string, string][] = [
  ['保存先または世代が変わりました。', '保存データが切り替わりました。'],
  [
    '同じ操作IDで異なる入力は保存できません。',
    '前回の記録と内容が異なります。画面を開き直して確認してください。',
  ],
  ['確定操作ID', '会計の確認番号'],
  ['世代', '保存データ'],
  ['DB', '記録'],
  ['価格の版', '価格設定'],
  ['照合', '確認'],
];

/** A message an operator can act on, without developer terms. */
export function errorMessage(error: unknown): string {
  if (error instanceof SyntaxError)
    return 'バックアップを読み取れません。保存したファイルを選び直してください。';
  if (error instanceof ZodError)
    return '入力内容かバックアップファイルを確認してください。';
  if (!(error instanceof Error))
    return '記録を確認できません。入力し直さず、保存状態を読み直してください。';
  if (error.name === 'QuotaExceededError')
    return '保存できる空き容量がありません。会計を止め、バックアップを確認してください。';
  if (STORAGE_ERROR_NAMES.has(error.name))
    return '記録を保存・確認できません。入力し直さず、保存状態を読み直してください。';
  if (error.message.startsWith('バックアップが不整合'))
    return 'バックアップの内容が一致しません。別のバックアップを選んでください。';
  return WORDING.reduce(
    (message, [from, to]) => message.replaceAll(from, to),
    error.message,
  );
}
