import { useEffect, useRef } from 'react';
import { Icon } from './Icon';
export function Help({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);
  return (
    <dialog ref={dialog} onCancel={onClose} className="help-dialog">
      <div className="section-heading">
        <h2>使い方</h2>
        <button
          className="icon-button"
          aria-label="閉じる"
          title="閉じる"
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </div>
      <ol className="help-steps">
        <li>
          <strong>本数を選ぶ</strong>
          <p>
            合計を確認して「会計へ」。札を確保・保存してから支払いに進みます。
          </p>
        </li>
        <li>
          <strong>現金を受け取る</strong>
          <p>
            お預かり金額を入力し「お釣りを確認」。現金とお釣りをやりとりして「会計を確定」。
          </p>
        </li>
        <li>
          <strong>商品を渡す・札を回収する</strong>
          <p>
            右の札番号を確認し、商品を渡して札を回収したらチェックを押します。
          </p>
        </li>
      </ol>
      <h3>
        <Icon name="download" />
        営業の区切りにバックアップ
      </h3>
      <p>
        設定でバックアップを保存し、保存先のファイルを確認してください。USBなど別の場所にもコピーしてください。
      </p>
      <details>
        <summary>再開・トラブル時</summary>
        <p>
          保留の会計は現金と比べて、二度受け取らないでください。保存結果が不明なときは新しい注文を入力せず、確認待ちの記録を開いてください。
        </p>
        <p>
          ブラウザのデータを削除すると記録が失われます。同じPC・ブラウザの通常のウィンドウで使ってください。
        </p>
        <p>待ち一覧の本数は未受け渡し分です。調理済みの商品も含みます。</p>
      </details>
    </dialog>
  );
}
