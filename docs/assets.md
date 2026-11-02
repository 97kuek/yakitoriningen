# 画面で使う素材

更新日：2026-11-02。現在の使用箇所はコンポーネントの画像参照、事前保存の対象は`vite.config.ts`を正とします。

## 現在の素材

| ファイル（`public/`内） | 使用箇所 | 表現 |
|---|---|---|
| `assets/logo-brush.webp` | ヘッダーのロゴ | 提供された看板を元に画像生成。黒い筆文字、赤い「鳥」、左に焼き鳥串。透過背景。飛行機要素は含めない |
| `assets/welcome-stall.webp` | ホーム | 提供されたWASAポスターの雰囲気に合わせた手描き風の屋台とひよこ |
| `assets/empty-orders-handdrawn.webp` | 札回収待ちが空のとき | 屋台と同じ描き味のひよこ・盆・竹串。透過背景。CSSで4秒の穏やかな上下ループ |
| `assets/history-empty.webp` | 条件に合う注文がないとき | 虫眼鏡と帳簿を持ったひよこ。透過背景 |
| `assets/share-stall.jpg` | OGP共有カード | 屋台画像をJPEG化。画面表示には使用せず、オフライン事前保存の対象外 |
| `icon.svg` | PWAアイコン | アプリの識別用 |
| `fonts/biz-udp-mincho-400.woff2`、`700.woff2` | 日本語の表示 | BIZ UD P明朝。ローカル配信し、外部フォント通信は不要 |

空状態の現在のアニメーションはGIFではありません。CSSで画像をループさせ、`prefers-reduced-motion: reduce`では停止します。停止・再生ボタンは置きません。

日本語フォントは数字・円記号・ASCIIを除いたサブセットです。金額・札番号・英字はOSのゴシック体へフォールバックします。文字サイズは12px・16px・24pxです。再生成は`scripts/subset-japanese-font.py`を使います。フォントのライセンスは`public/fonts/OFL-BIZUDPMincho.txt`を参照してください。

## 参照資料と旧案

`docs/design-references/`には、提供ポスター・看板と生成元の画像を保存しています。公開画面では直接読み込みません。画像生成では照り・ぼかし・立体感を抑え、紙とクレヨンの描き味を合わせました。ロゴの最終参照は提供画像`S__206790678_0.jpg`です。

以下は以前の案として残っており、現在のコンポーネントでは参照しません。

- `assets/shop-logo.webp`：初期の画像ロゴ。
- `assets/flight-mark.webp`：人力飛行機のひよこ。現在のロゴでは不使用。
- `assets/empty-orders.gif`、`assets/empty-orders-still.png`：以前の空状態。現在は手描き版WebPとCSSのループを使う。

旧案も`public/`内にあるため現在のビルドでは配信・事前保存されます。コードから不使用であることと、配信対象外であることを混同しないでください。素材を削除する際は既存参照とオフライン更新を確認します。
