import { Dialog, Disclosure } from './controls';
import { Icon } from './Icon';
export function Help({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="使い方"
      className="help-dialog"
    >
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
        営業の区切りに記録を保存
      </h3>
      <p>
        設定の「記録を保存」で全記録を保存し、ファイルを選んで確認してください。USBなどにもコピーしてください。
      </p>
      <Disclosure title="再開・トラブル時">
        <p>
          保留の会計は現金と比べて、二度受け取らないでください。保存結果が不明なときは新しい注文を入力せず、確認待ちの記録を開いてください。
        </p>
        <p>
          ブラウザのデータを削除すると記録が失われます。同じPC・ブラウザの通常のウィンドウで使ってください。
        </p>
        <p>待ち一覧の本数は未受け渡し分です。調理済みの商品も含みます。</p>
      </Disclosure>
    </Dialog>
  );
}
