# 公開と更新

公開URL：[焼き鳥人間](https://yakitoriningen.pages.dev)

Cloudflare Pagesで`dist/`のアプリ・画像・PWAだけを配信します。注文・売上・経費は各PCのIndexedDBに保存し、Cloudflareへ送信しません。営業では上記のURLを継続利用します。

## 初回の公開

Node.js 22.12以上で依存関係をインストールし、Cloudflareにログインします。

```sh
npm ci
npx wrangler login
npx wrangler whoami
npx wrangler pages project create yakitoriningen --production-branch main --force
```

プロジェクトの作成は初回だけです。作成時の`--force`はCLIによるWorkersへの自動切り替えを避け、`pages.dev`で公開する指定です。既存プロジェクトの更新時には付けません。既にある場合は作成せず、次の更新手順を使います。ログイン時は公開先のCloudflareアカウントを選びます。APIトークンをコマンドやGitへ保存しません。

## 公開前の確認と更新

```sh
npm run check
npm test
npm run build
npm run preview:cloudflare
```

確認用URLは`http://127.0.0.1:4373/`です。通常プレビューの4173、ブラウザ試験4273とは分けています。確認用サーバーを終了してから公開します。

```sh
npm run deploy
```

このコマンドは再ビルド後、`yakitoriningen`プロジェクトの本番ブランチ`main`へ公開します。`wrangler.jsonc`の`pages_build_output_dir`は`dist/`だけを指定しています。互換日は同梱ランタイムが対応する`2026-10-23`です。

CLIからの直接公開を使います。独自ドメインやGitHubからの自動公開は追加していません。Cloudflareアカウント全体のサブドメインも変更しません。

## 更新ファイルの配信

`public/_headers`はビルド時に`dist/`へコピーします。

- `/sw.js`はHTTPキャッシュを使い回さず、更新を確認する。
- `/`・`/index.html`・マニフェストは再検証する。
- 名前が固定の画像にも長期キャッシュを指定せず、配信元の再検証を使う。
- アプリ内の更新は従来どおり手動で適用し、営業中に自動で再読み込みしない。

## 公開後の確認

1. 公開URLで開始画面・ロゴ・画像が表示されることを確認する。
2. 営業用とは別のブラウザまたはプロファイルで練習用データを作り、会計・受け渡しを確認する。
3. 通信を切って同じURLを再読み込みし、アプリと練習用データを読み出せることを確認する。
4. `/sw.js`とHTMLのHTTPヘッダーが設定どおりか確認する。

## 記録の引き継ぎ

ローカルのURLと公開先URLは保存先が別です。必要な記録がある場合は、元の画面で記録を保存・読み直し確認し、公開先の「保存した記録を開く」から復元します。複数PCで同じURLを開いても注文は共有されません。

以前の試験用URLで記録を作った場合も同じ手順で引き継ぎます。公開先のURLを変えても、記録が自動で移ることはありません。

利用者は営業終了後、記録を保存・確認し、入力中・保留の操作を解消してから画面の「更新する」を押します。

Firebase向けの既存設定は残っていますが、通常の公開先はCloudflare Pagesです。

## 根拠

- [Pagesへの直接公開](https://developers.cloudflare.com/pages/get-started/direct-upload/)
- [HTTPヘッダー](https://developers.cloudflare.com/pages/configuration/headers/)
