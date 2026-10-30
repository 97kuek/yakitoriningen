# フロントエンド

React・TypeScriptで、会計担当者がPC1台を操作する画面を実装します。保存済みの記録は`Cashier`ポートから読み、入力中の状態はReactで管理します。

## 画面と主要ファイル

| ファイル | 責務 |
|---|---|
| `src/App.tsx` | 起動状態、画面切り替え、下書き、保存中・エラー・復元後の状態、PWA更新 |
| `src/components/Startup.tsx` | 初回準備と営業再開前の確認 |
| `src/components/Checkout.tsx` | 商品・本数入力、未入金の注文、入金確認 |
| `src/components/Waiting.tsx` | 未受け渡し一覧、受け渡しと札回収、完了を元に戻す操作 |
| `src/components/History.tsx`、`SalesCharts.tsx` | 売上・経費・利益、内訳、履歴検索・返金 |
| `src/components/Settings.tsx`、`MenuSettings.tsx` | 商品・価格、経費、バックアップなどの設定 |
| `src/components/DataPanel.tsx`、`Recovery.tsx` | バックアップ・復元、結果が未確認の操作の照合 |
| `src/components/controls.tsx`、`src/controls.css` | ボタン・選択欄・開閉欄・ダイアログの共通操作と見た目 |
| `src/presentation/format.ts`、`src/styles.css` | 表示形式と画面のレイアウト |
| `src/ui.ts`、`src/useExclusiveTab.ts` | 画面間の操作型、Web Locksによる二重起動抑止 |

## 依存とデータフロー

```text
入力 → domainで見積もり → Cashierポートへ操作を渡す
     → applicationで検証・保存 → コミット済みSnapshot → 再描画
```

`src/bootstrap.ts`が組み立てた`cashier`を使います。画面から`storage/`やDexieを直接参照しません。金額計算や札の所有条件はdomain/applicationで判断し、UIは結果を表示します。

保存中は重複操作を抑止し、失敗時には保存状態を読み直します。保存結果が分からない操作は`Recovery`で同じ操作IDを照合し、入力し直しや二度目の入金へ誘導しません。

## 入力状態の扱い

- 会計の下書きは`App`で保持し、会計・売上・設定を往復しても消さない。
- 最初の商品入力で価格を固定する。設定変更後も入力中の注文には当時の価格を使う。
- 未入金の本数修正は、現金未受領を確認して保留を取り消し、その数量と価格を下書きへ戻す。受領の有無が未確認の入金操作がある場合は先に照合する。
- 設定は画面から隠しても保持し、未保存の編集を画面往復で失わない。再読み込み後まで未保存の入力を残す機能はない。
- 履歴の札番号検索・未受け渡し絞り込み・50件ごとのページ切り替えは注文表にだけ適用する。売上集計やグラフの範囲は変えない。

## UIの変更手順

1. [要件](requirements.md)と[運用手順](operations.md)で、現金・札・入力状態への影響を確認する。
2. `Button`・`IconButton`・`Select`・`Disclosure`・`Dialog`を使う。選択欄は共通のリストボックスで揃え、キーボードとフォーカスを保つ。
3. 日常語で操作を示し、営業日や札枚数など頻度の低い設定は開閉欄に置く。標準のボタン・入力欄は40px、フォーカス枠は一つにする。
4. 保存前後・画面往復・狭い画面・マウスとキーボードを確認する。保存処理へ影響する場合は[backendの変更手順](backend.md)も確認する。

検証コマンドは[CONTRIBUTING.md](../CONTRIBUTING.md)、自動試験で確認する範囲と実機で残る項目は[検証範囲](acceptance.md)を参照してください。
