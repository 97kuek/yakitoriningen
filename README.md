# 焼き鳥人間

WASAが早稲田祭で出店する焼き鳥屋「焼き鳥人間」の会計アプリです。
早稲田祭は年1回・2日間の開催です。PC1台で注文受付・現金会計・受け渡し・売上確認ができます。事前に準備すれば、営業中は通信なしで使えます。

[アプリを開く](https://yakitoriningen.pages.dev)

## できること

- 商品の本数を入力し、セット割引・お釣りを計算する
- 番号札を割り当て、受け渡し待ちの注文を確認する
- 商品・通常価格・値下げ価格・セットを設定する
- 当日の注文履歴を札番号や時間帯で探し、返金を記録する
- 当日の在庫・追加・廃棄を記録し、残り本数を確認
- 1日ごとにバックアップし、各日のファイルをまとめて集計

## 開発・起動

Node.js 22.12以上とnpmを使います。

```sh
npm ci
npm run dev
```

表示されたURLをブラウザで開きます。オフライン動作は、本番ビルドで確認します。

```sh
npm run build
npm run preview
```

プレビューは `http://127.0.0.1:4173` で開けます。検証コマンドと開発ルールは[開発への参加](CONTRIBUTING.md)を参照してください。

`main`へpushするとGitHub Actionsが検証し、成功したビルドをCloudflare Pagesへ自動公開します。

## ドキュメント

- [公開と更新](docs/deployment.md)：Cloudflareへの公開とデータの引き継ぎ
- [要件定義書](docs/requirements.md)：機能と運用の条件
- [全体アーキテクチャ](docs/architecture.md)：構成とデータの流れ
- [フロントエンド](docs/frontend.md)：画面と入力状態の扱い
- [バックエンド相当の処理](docs/backend.md)：ブラウザ内の業務処理と保存
- [操作・復旧の手順](docs/operations.md)：営業前の準備からバックアップ・復元まで
- [検証範囲](docs/acceptance.md)：自動試験と本番前の確認
- [開発への参加](CONTRIBUTING.md)：変更・検証・Gitのルール

記録は使用中のPC・ブラウザに保存され、クラウドへ同期しません。ブラウザデータの削除やPC故障に備え、バックアップを別媒体にも保存してください。公開・更新は[Cloudflareの手順](docs/deployment.md)を参照してください。

[MIT License](LICENSE)
