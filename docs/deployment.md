# 公開と更新

Cloudflare Workers Static Assetsで、`dist/`のアプリ・画像・PWAだけを配信します。注文・売上・経費は各PCのIndexedDBに保存し、Cloudflareへ送信しません。

## 初回の公開

Node.js 22.12以上で、リポジトリの依存関係をインストールします。

```sh
npm ci
npx wrangler login
npx wrangler whoami
npm run deploy:check
npm run deploy
```

ログイン画面で公開先のCloudflareアカウントを認証します。複数のアカウントがある場合は公開先を確認し、`CLOUDFLARE_ACCOUNT_ID`で対象を選びます。APIトークンをコマンドに直接書いたり、Gitへ保存したりしません。

`wrangler.jsonc`の公開名は`yakitoriningen`です。互換日は同梱ランタイムが対応する`2026-10-23`に固定しています。実際のURLは`wrangler deploy`の完了時に表示されます。独自ドメインとGitHubからの自動公開は、この設定では追加しません。

`npm run deploy:check`はビルドと公開内容の事前確認だけを行います。公開時は`npm run deploy`で同じビルド手順を実行します。

## 配信設定を確認する

```sh
npm run build
npm run preview:cloudflare
```

Cloudflareと同じ配信処理を使う確認用URLは`http://127.0.0.1:4373/`です。通常のプレビュー4173、ブラウザ試験4273とは分けています。`public/_headers`はビルド時に`dist/`へコピーされます。

- `/sw.js`はブラウザのHTTPキャッシュを使い回さず、更新を確認する。
- `/`・`/index.html`・マニフェストは再検証する。
- ファイル名が固定の画像にも一律の長期キャッシュを指定せず、Cloudflareの既定の再検証を使う。
- URLの直接表示はSPAとして処理し、画面を開けるようにする。
- アプリ内の更新は従来どおり手動確認後に適用し、営業中に自動で再読み込みしない。

## 公開後の確認

1. 公開されたHTTPSのURLで、営業準備画面・ロゴ・画像が表示されることを確認する。
2. 営業用とは別のブラウザまたはプロファイルで練習用データを作り、会計・受け渡しを確認する。
3. 通信を切って同じURLを再読み込みし、アプリと練習用データを読み出せることを確認する。
4. `/sw.js`とHTMLのHTTPヘッダーが設定どおりか確認する。

## ローカルからの引き継ぎ

ローカルのURLと公開先URLは保存先が別です。必要な記録がある場合は、元の画面でバックアップを保存・読み直し確認し、公開先の「バックアップから引き継ぐ」から復元します。複数PCで同じURLを開いても注文は共有されません。

一度営業に使い始めたURLは継続利用します。公開先のURLを変える場合も、バックアップによる引き継ぎが必要です。

## アプリを更新するとき

開発側は試験後に`npm run deploy`で新しいアプリを公開します。利用者は営業終了後、バックアップを保存・確認し、入力中・保留の操作を解消してから画面の「更新する」を押します。

Firebase向けの既存設定は残っていますが、通常の公開手順はCloudflareです。Firebaseのプロジェクト作成・公開はこの手順では行いません。

## 根拠

- [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/)
- [SPAの配信](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/)
- [HTTPヘッダー](https://developers.cloudflare.com/workers/static-assets/headers/)
