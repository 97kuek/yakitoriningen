# 会計の修正・取り消しと履歴改善 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 承認された4点（設定入力保持、受け渡し完了取消、本数修正、履歴検索）と命名・重複整理を実装する。

**Architecture:** 業務ルールはdomain、札とログの原子的更新はapplication/storage、画面はCashierポートを使う。既存の保存済みコマンド名とバックアップの互換は維持する。

**Tech Stack:** 既存のReact/TypeScript/Dexie/Vitest/Playwright。依存追加なし。

**Spec:** チャットで提示した改善1〜4をユーザーが承認。追加指示は簡潔で分かりやすい命名、リファクタリング・共通化。

## Global Constraints

- 非エンジニア向けの日本語、40pxの操作部品、既存の限定色を維持。
- 営業データを触らず専用ブラウザで検証。4173は停止しない。
- mainへ論理単位のコミットを反映しpushする指示を継続。

## Review Focus

- 札の再利用後、空きに戻っても古い完了を取り消せない。
- 取り消しと次の札確保の競合、書込失敗、同じ操作の再試行。
- 入金準備後に本数修正を許可しない。修正前の価格を維持。
- 設定の他画面への移動では入力を保持し、復元時は破棄。
- 履歴を絞っても集計額・返金対象を変えない。

### Task 1: 受け渡し完了取消

Files: domain/order.ts, domain/handoff.ts, application/cashier-commands.ts, application/backup.ts, domain/model.ts, storage tests。

- [x] 正常取消、再試行、札再利用後、書込失敗、バックアップ往復の失敗試験を作って実行。
- [x] `undoHandoff`操作は元の完了IDを持つ。純粋な判定`canUndoHandoff`を画面と更新で共有。ログ順で再利用を判定し、札の再確保と状態更新を同一トランザクションで保存。
- [x] バックアップでは完了→取消の順を検証。元の記録は削除しない。
- [x] 保存試験を実行しコミット。

### Task 2: 設定保持・本数修正・履歴検索

Files: App.tsx, components/{Settings,Checkout,Waiting,History}.tsx, domain/history.ts, tests/e2e/app.spec.ts, styles.css。

- [x] 他画面往復の設定保持、本数修正と価格維持、完了取消、履歴検索・絞込・50件送りのブラウザ失敗試験を作って実行。
- [x] 設定を隠して保持、表示項目を親で管理。本数修正は未入金の元注文を取消記録して本数と当時の価格を編集欄に戻す。
- [x] 完了後に対象札付きの「元に戻す」を固定した欄に表示。再利用後は無効化。
- [x] 履歴のみを札番号・状態で絞り、直近50件ずつ表示。売上集計への絞込の影響はなし。
- [x] ブラウザ試験とスクリーンショットを確認しコミット。

### Task 3: 命名・共通化

Files: presentation/format.ts, application/ports.ts, ui.ts, storage/commands.tsと利用箇所。

- [x] 金額・注文内容・日本時間の時刻表示を共通化。意味の広いStore、changeOrder、UIのact/runとprepare/discardの名前を整理。
- [x] 保存済みコマンドの文字列を変更せず、DDDの依存方向を維持。
- [x] 全試験・型・整形・ビルド・レビュー後にコミット。利用手順を更新しmainへ反映。

## 追加された設定・共通部品の範囲

ユーザー回答：選んだ商品から組合せ自由で合計N本X円。商品ごとの値下げ価格を登録し、一括切替。既定はもも・かわ・ねぎま。商品追加・削除・個別価格を編集。営業日等は必要時にだけ開き、説明を日常語へ変更。返金・更新を含む全ボタン/アイコン、開閉と選択UIを共通化し二重枠をなくす。

Ruling: 追加依頼で独立したカタログ業務と共通部品の作業が生じたため、subagent-driven-developmentで担当ファイルを分ける。保存済みの価格/操作文字列は維持し、旧会計の価格・名前は不変。セットは1つの対象商品群と本数・金額を設定。複数候補の重複最適化は対象外。

### Task 4: 可変メニューの業務処理

- `Price.items?: MenuItem[]`（id,name,price,discountPrice）、`bundleItems?: string[]`、`discounted?: boolean`、`bundleDuringDiscount?: boolean`。既存フィールドは互換用に維持。
- `getMenu(price)`は旧価格を既定3商品へ展開。`getUnitPrice(item,price)`は通常/値下げの単価を返す。
- 数量と名前は商品IDをキーにするレコード。未知の非ゼロ数量、不正商品/重複IDは拒否。
- 異なる単価を混ぜるセットは会計が最安になるよう適用。単品より高くなるセットは使わない。
- バックアップ・注文名・売上一覧・種類別本数を任意商品に対応。旧データは受理。

### Task 5: UI部品

- Button/IconButton、Dialog、Disclosure、Selectを共通化。40px、同じ余白と線、二重枠なし。
- 開閉はカスタムボタン、選択は共通Select、キーボード・Escape・フォーカス復帰を維持。
- メニュー設定は商品一覧・追加削除・通常/値下げ価格、セット対象を選ぶ部分、適用ボタンを1つ。
- 返金は段階ごとに必要な操作のみ。更新ボタンは同じButtonと既存Iconを使用。

## 検証とレビュー記録

- 命名変更のみを独立したスナップショットで検証し、既存65件と型検査に成功。
- 可変メニュー、経費、完了取消、復元、履歴の単体・保存試験92件に成功。
- ブラウザでは追加商品のセット・値下げ・削除後履歴、30商品、51件のページ送り、旧価格、返金、キーボード、オフラインを確認。
- レビューの指摘を修正：削除済み商品の0数量を持ち越さない、旧値下げプリセットの編集用展開、旧同種セットの表示。
- 画像は組み込みimage_genで生成。空状態の背景ぼかしが残る案を不採用とし、白地の最終案を採用。プロンプトはdocs/assets.md。
- 本番PCの停電・異常終了と、実際の担当者による模擬営業は引き続き未検証。
