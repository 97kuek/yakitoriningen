# 公開と更新

公開URL：[焼き鳥人間](https://yakitoriningen.pages.dev)

Cloudflare Pagesで`dist/`のアプリ・画像・PWAだけを配信します。注文・売上・経費は各PCのIndexedDBに保存し、Cloudflareへ送信しません。営業では上記のURLを継続利用します。

## GitHub Actionsによる自動公開

[CI and Pages deployment](https://github.com/97kuek/yakitoriningen/actions/workflows/ci.yml)で、PRと`main`へのpushを検証します。

1. Node.js 22で`npm ci`、型確認、単体テスト、整形確認、ビルドを実行する。
2. Chromiumを導入し、専用ポート4273でE2Eテストを実行する。
3. 全検証が成功した`dist/`をartifactとして保存する。
4. `main`へのpushでのみ、同じartifactを取得し、再ビルドせずCloudflare Pagesへ公開する。

PRでは公開しません。forkからのPRにもCloudflareの認証情報を渡しません。検証失敗時は公開jobを実行せず、公開認証情報がない場合も公開jobを失敗にします。成功時は実行結果のSummaryに公開したcommitとURLを記録します。

失敗したE2EのHTMLレポート・trace・画像は`playwright-failure` artifactに7日間保存します。`dist` artifactも7日間保存します。各jobは20分（検証）・10分（公開）で打ち切ります。新しいPR更新は古い検証を取り消し、`main`の実行は同時公開を避けるため順番に処理します。公開直前に最新の`main`と一致することも確認し、古い実行の再公開を防ぎます。

Actionsは検証したリリースのcommit SHAで固定し、Dependabotが週に一度更新PRを作ります。トークンの権限は`contents: read`だけを使い、workflowからGitHubへのcommit・PRコメント投稿は行いません。GitHubは`production` environmentへの実行をdeploymentとして記録します。

### 最初に一度だけ設定する認証情報

Cloudflareで専用のAPIトークンを作成します。権限は`Account` → `Cloudflare Pages` → `Edit`、対象は公開先のアカウントだけに絞ります。ローカルの`wrangler login`が保存するOAuthトークンはGitHubへ登録しません。

現在の専用キーは`yakitoriningen-github-pages`、有効期限は2027-10-31です。この権限は対象アカウント内のPages全体に及びます。期限前に同じ権限の新しいキーを作り、GitHubのSecretを更新して自動公開を確認してから古いキーを無効にします。

GitHubのリポジトリ設定「Secrets and variables」→「Actions」に次を登録します。

| 種類 | 名前 | 内容 |
|---|---|---|
| Repository secret | `CLOUDFLARE_API_TOKEN` | 作成したCloudflare APIトークン |
| Repository variable | `CLOUDFLARE_ACCOUNT_ID` | `yakitoriningen`が属するCloudflareアカウントID |

Account IDは秘密情報ではないためvariableに置きます。トークンの実値をコマンド引数・ファイル・Gitへ残さず登録するには、対話入力を使います。

```sh
gh secret set CLOUDFLARE_API_TOKEN
gh variable set CLOUDFLARE_ACCOUNT_ID
```

workflowは`production` environmentを使います。承認待ちを入れず自動公開する運用では、このenvironmentにrequired reviewersを設定しません。

### 失敗した公開の再実行

認証情報や一時的な通信障害を解消したら、Actionsの該当実行で「Re-run failed jobs」を選びます。検証成功時のartifactが残っていれば、同じ成果物で公開だけを再試行します。artifactの期限が切れた場合は、最新の`main`でworkflow全体を実行します。

手動実行はActionsの「Run workflow」で`main`を選ぶか、次を使います。

```sh
gh workflow run ci.yml --ref main
```

手動実行でも全検証を行い、最新の`main`だけを本番へ公開します。ほかのブランチを選ぶと検証だけを行います。

## 初回のPagesプロジェクト作成

Node.js 22.12以上で依存関係をインストールし、Cloudflareにログインします。

```sh
npm ci
npx wrangler login
npx wrangler whoami
npx wrangler pages project create yakitoriningen --production-branch main --force
```

プロジェクトの作成は初回だけです。作成時の`--force`はCLIによるWorkersへの自動切り替えを避け、`pages.dev`で公開する指定です。既存プロジェクトの更新時には付けません。既にある場合は作成せず、次の更新手順を使います。ログイン時は公開先のCloudflareアカウントを選びます。APIトークンをコマンドやGitへ保存しません。

## ローカルから明示的に公開する場合

通常の更新は`main`へのpushで公開します。ローカルからの公開が必要で、明示的に依頼された場合だけ以下を使います。

```sh
npm run check
npm test
npm run format:check
npm run build
npm run test:e2e
npm run preview:cloudflare
```

確認用URLは`http://127.0.0.1:4373/`です。通常プレビューの4173、ブラウザ試験4273とは分けています。確認用サーバーを終了してから公開します。

```sh
npm run deploy
```

このコマンドは再ビルド後、`yakitoriningen`プロジェクトの本番ブランチ`main`へ公開します。`wrangler.jsonc`の`pages_build_output_dir`は`dist/`だけを指定しています。互換日は同梱ランタイムが対応する`2026-10-23`です。

既存のDirect UploadプロジェクトをWranglerで更新します。CloudflareのGit integrationへの切り替えや別プロジェクトの作成は不要です。独自ドメインやCloudflareアカウント全体のサブドメインも変更しません。

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
- [Direct UploadとCIの接続・APIトークンの権限](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/)
- [GitHub Actionsのartifact](https://docs.github.com/en/actions/tutorials/store-and-share-data)
- [GitHub Actionsの手動実行](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow)
- [GitHub Actionsの権限と依存固定](https://docs.github.com/en/actions/reference/security/secure-use)
- [HTTPヘッダー](https://developers.cloudflare.com/pages/configuration/headers/)
