# 画面で使う素材

## 採用画像

- `public/assets/shop-logo.webp`：提供看板を参照して生成した「焼き鳥人間」のロゴ。透過WebP、480×192px（表示232px幅の2倍）。
- `public/assets/welcome-stall.webp`：提供されたWASAポスターとひよこの絵を参照して生成した、開始画面の屋台。WebP、1200×800px（表示最大600px幅の2倍）。

画面で使う画像は、表示サイズの2倍を上限に縮小したWebPにしています。PWAが初回準備ですべて保存するため、大きい画像はそのまま初回の通信量と端末の保存容量になります。生成した元のPNG（`docs/design-references/shop-logo-source.png`、`welcome-stall-source.png`）は配信せず、作り直す時の素材として保持しています。書き出しは次のとおりです。

```sh
cwebp -q 85 -m 6 -resize 1200 800 docs/design-references/welcome-stall-source.png -o public/assets/welcome-stall.webp
cwebp -q 90 -alpha_q 100 -m 6 -resize 480 192 docs/design-references/shop-logo-source.png -o public/assets/shop-logo.webp
```

組み込みの`image_gen`で生成・編集しました。ロゴの透過を保持し、焼き鳥は光沢を抑えた平面の塗りに修正しています。画面の文字と操作部品はHTMLで表示します。

待ち一覧向けのひよこ画像案は背景のにじみが残ったため不採用とし、営業画面は小さなアイコンと短い文にしました。

## 書体

日本語の文字は、和風で読みやすさを重視した明朝体の[BIZ UD P明朝](https://github.com/googlefonts/morisawa-biz-ud-mincho)（SIL Open Font License 1.1、`public/fonts/OFL-BIZUDPMincho.txt`）で表示します。通常（400）と太字（700）を使います。営業中は通信しないため、Google Fontsなどから読み込まず、アプリに同梱してPWAで事前保存します。

`public/fonts/biz-udp-mincho-400.woff2`と`biz-udp-mincho-700.woff2`は、ひらがな・カタカナ・日本語の記号・JIS第1水準漢字と、ソースコードで使う文字だけに絞ったものです（2つで約1.5MB、元は合計13MB）。数字・円記号・英字は含めていないため、金額・札番号・時刻は読みやすいゴシック体で表示されます。商品名にこの範囲にない漢字を入力した場合、その文字だけゴシック体になります。

画面の文字に第1水準以外の漢字を増やしたときは、元のフォントを[Google Fontsのリポジトリ](https://github.com/google/fonts/tree/main/ofl/bizudpmincho)から取得して作り直します。

```sh
uv run scripts/subset-japanese-font.py \
  BIZUDPMincho-Regular.ttf public/fonts/biz-udp-mincho-400.woff2 \
  BIZUDPMincho-Bold.ttf public/fonts/biz-udp-mincho-700.woff2
```

## 提供画像

`docs/design-references/yakitori-sign.jpg` と `docs/design-references/wasa-poster.jpg` はユーザーの提供画像です。生成画像の参照元として保持しています。

## 操作用アイコン

Lucide Reactを使用。ISC License。[公式サイトとライセンス](https://lucide.dev/license)。串のモチーフとアプリアイコンのみプロジェクト内SVGです。

## 参考にしたスキル

`frontend-design`、`yomiyasu`、`web-design-guidelines`と、ユーザー提供の `zukai-slide-fix.skill` を読みました。図解用スキルからは要素の削減・整列・字重の統一という基準を採用しています。スライド用の寸法や部品は使用していません。追加スキルのグローバルインストールはしていません。

## 画像生成のプロンプト

ロゴの生成プロンプト：

> Use case: logo-brand. Create the final production raster logo for a Japanese school-festival yakitori cashier app. Reference image 1 is the user's actual shop name sign; preserve the exact shop name and handmade personality, but make a clean new logo. Reference image 2 supplies warm yellow chicks, coral red, ink charcoal, browned skewer colors. Wide horizontal canvas about 1536 by 384, tightly framed wordmark with modest padding so it stays legible at 240 by 60 CSS pixels. Exact text only: 焼き鳥人間 . All five Japanese characters must be fully correct and highly readable. Use friendly hand-painted Japanese lettering of medium weight, clear open counters, slightly imperfect ink edges but no distressed texture that clogs strokes. Make only 鳥 a warm vermilion red; other characters charcoal. Include one small simple browned yakitori skewer to the left, and one tiny yellow chick perched near the final character. The wordmark is the dominant element; no other text, no WASA letters, no border, no paper rectangle, no grid, no heavy shadow, no tagline. Genuinely transparent background. Keep the horizontal logo a single compact coherent composition, not a mockup or sheet.

開始画面の生成プロンプト：

> Use case: illustration-story. Create the final welcome-screen illustration for the user's 焼き鳥人間 yakitori cashier app, landscape 3:2. Reference image 1 is their real WASA poster and gives the handmade school festival spirit and yellow/red/brown palette. Reference image 2 is their sign and gives paper-and-ink simplicity. Reference image 3 is the already generated app mascot: match those round yellow chicks, simple black eyes, little beaks, lightly grainy marker fills and imperfect dark outlines. Show three friendly yellow chicks running a tiny Japanese yakitori festival stall: one tending a short charcoal grill with browned chicken skewers and a little steam, one holding a tray of skewers, one welcoming the customer. A small red fabric awning, a warm soft yellow backdrop, a plain paper-white foreground. Spacious calm composition, simple silhouettes, charming handmade drawing. The illustration sits to the left of a real setup form, so it should be inviting but not busy. NO text, NO numbers, NO lettering, NO UI controls, NO screenshots, NO big callout badges, NO photorealism, NO glossy 3D. Do not redraw the original poster or wordmark. No cropped characters or objects.

3画像に共通して適用した最終編集プロンプト：

> Use case: precise-object-edit. This exact image is the edit target. Change ONLY the rendering of the chicken meat on every yakitori skewer. The user says the excessive glossy sheen looks AI-generated. Redraw all chicken pieces as simple FLAT MATTE ochre-brown marker shapes, with just dark brown/charcoal sketch outlines and a few charcoal grill marks. No white shine streaks, no specular highlights, no pale glossy rims, no glaze, no orange hot spots, no wet surfaces, no gradients or volumetric rendering. At most two flat brown tones per piece, sparse paper/colored-pencil grain is fine. Keep every chick, their expressions, outlines, lettering if present, typography, all positions, canvas framing, objects, the tray/stall, background, and colors elsewhere EXACTLY unchanged. Preserve existing transparency wherever present. This is a handmade school-festival illustration, not a food advertisement. Make the food look drawn with simple dry markers just like the chicks, not more realistic than the rest.


## 追加修正（2026-10-30）

組み込みのimage_genで生成・編集し、最終採用分だけをpublic/assetsへ保存。生成画像の外側にぼかしが残った空状態案は不採用。ロゴの焼き鳥は鶏肉とねぎが交互に刺さった形へ修正し、照り・衣の粒・大きな焦げ穴を除いた。空状態は白地の小さなひよこと空の盆を採用し、画面では紙色になじませている。

- `docs/design-references/shop-logo-source.png`：既存の文字とひよこを維持した編集。透過PNG。画面では縮小したWebPを使う。
- `docs/design-references/empty-orders-source.png`：空の待ち一覧用イラストの元画像。白地PNG。画面では使わず、配信対象から外している。

ロゴ最終編集プロンプト：

> Refine ONLY the meat on the left skewer of this transparent logo. Keep exact Japanese letters 焼き鳥人間 and chick and transparent layout unchanged. The chicken currently looks BREADED fried croquettes with long black middle slits. Make three solid irregular CUBES of unbreaded grilled chicken thigh: smooth simple flat pale tan fill, chunky squared outline, only two tiny short charcoal grill strokes on each piece, NO grainy crumbs, NO dark middle cutout slit, NO breading, NO texture. Keep pale white-green leek segments between the chicken cubes. Hand drawn outlined flat cartoon, matte. Every pixel outside the skewer/letters/chick must be transparent alpha0. NO background, NO glow, NO shadow.

空状態の最終生成プロンプト：

> A tiny quiet illustration for an empty yakitori order list. WHITE BACKGROUND, solid perfectly uniform pure white #FFFFFF, no transparency. One simple round yellow chick with a small cream festival headband, standing beside a small EMPTY rectangular wooden serving tray. Friendly calm face, eyes smiling. Sparse hand-drawn dark brown outlines, FLAT solid yellow body, FLAT ochre tray, small orange beak/feet. Only four flat colors plus white background. Like a simple Japanese school festival pen drawing, no digital effects. No shading, NO paper texture, NO grain, NO gradients, NO drop shadows, NO ambient glow, NO halo, NO fog, NO dark vignette, NO light rays, no food, no text, no lettering, no sparkles, no decor. The background must remain pure white right up to the character outline. Full character and tray comfortably visible, centered compact landscape composition, clean small UI sticker.


## 待ち画面のGIF（2026-11-01）

組み込みのimage_genで既存のひよこを参照したスプライトを生成し、上段の3コマをffmpegでGIFへ符号化した。CSSで画像全体を揺らす演出は削除した。

- `public/assets/empty-orders.gif`：384×270、6フレーム、2.64秒で停止。
- `public/assets/empty-orders-still.png`：動きを減らす設定用の静止画。
- 元のPNGは`docs/design-references/`に保持。GIFと静止画は両方ともPWAの事前保存対象。

生成プロンプト（組み込みツール使用、CLIへの切り替えなし）：

> Create an animation sprite sheet editing the reference illustration for a yakitori cashier app empty state. Preserve exactly the same friendly yellow chick with cream headband, warm brown hand-drawn outlines, small orange beak, and empty wooden tray to its right. A flat warm off-white #fffef7 background, no texture, no text, no grid lines, no labels. Output one landscape 1536x1024 image divided into an exact 3-column by 2-row grid of six equal 512x512 cells. Each cell contains the whole same chick and tray at identical scale and aligned identical positions with ample equal margin. Tray and feet remain fixed across every frame. Animation frames reading left to right top row then bottom row: 1 eyes open neutral wings down; 2 eyes half closed wings slightly lifted; 3 eyes closed smiling wings raised gently; 4 eyes half open wings slightly lowered; 5 eyes open wings lowered; 6 same as frame1. Subtle natural blink and small wing wave, no camera movement, no background changes. Flat restrained colors, matte, simple hand-drawn mascot, no gloss, no sparks, no smoke, no 3D. This exact aligned sheet will be cut into frames and encoded as a real GIF.

## 透過とループの修正（2026-11-01）

組み込みimage_genで背景を透過に編集し、ffmpegで上段3コマをGIFへ符号化した。`empty-orders.gif`は無限ループ、`empty-orders-still.png`は同じGIFの先頭フレーム。画面には停止・再生ボタンを置かずループ再生する。端末の動きを減らす設定では静止画を使う。

編集プロンプト：

> Edit this exact 1536x1024 animation sprite sheet. Remove ALL off-white background to genuine transparent alpha, including the spaces surrounding every chick and tray and inside negative spaces. Preserve the exact six-cell 3-column by 2-row arrangement, poses, frame positions, scale, color and linework of every chick and tray. Do not add any objects, text, glow, shadow, halo or new background. This is for cutting into GIF frames; all clear space must be fully transparent, no paper texture or opaque background rectangle. Keep all outlines crisp and solid.

## ロゴと履歴の空状態（2026-11-01）

- `public/assets/flight-mark.webp`：人力飛行機をこぐひよこと焼き鳥の透過イラスト。ロゴの文字は画像に含めず、画面と同じBIZ UDPMinchoで「焼き鳥人間」を表示する。
- `public/assets/history-empty.webp`：虫眼鏡と帳簿を持ったひよこ。注文履歴に該当する注文がない場合に中央表示する。

どちらも組み込みのimage_genで生成し、透過を保ってWebPへ縮小変換した。旧ロゴは参照資料として残すがヘッダーでは使用しない。新しい画像もPWAの事前キャッシュに含める。

生成指定：平面的な黄・生成り・茶色の線画、文字・背景・影なし。人力飛行機は細長い主翼・自転車型のペダル・プロペラを描き、履歴用は鉢巻姿のひよこと空の帳簿を描く。

## 待ち画面の手描き版（2026-11-01）

`empty-orders-handdrawn.webp`はwelcome-stallのクレヨン風に合わせて組み込みimage_genで生成した透過イラスト。派手な照りのある肉は使わず、ひよこと木の盆・竹串だけにした。WebPへ480pxに縮小し、CSSで4秒の穏やかな上下ループを付ける。動きを減らす設定では静止する。従来のGIFは使用しない。ヘッダーの人力飛行機は外し、画面のフォントで店名を表示する。

編集指定：keep textured chick, remove halo/shadow/white outline, empty wooden tray and two bamboo sticks, genuine transparent alpha.

## 筆文字ロゴ

`public/assets/logo-brush.webp` は提供画像 `S__206790678_0.jpg` を参照し、2026-11-01に画像生成で整えたロゴです。黒い筆文字と赤い「鳥」、左の焼き鳥串を残し、飛行機と背景模様を除きました。透過PNGを640px幅のWebPへ変換し、ヘッダーで表示します。

共有カード用の `share-stall.jpg` は既存の屋台イラストをJPEGへ変換したものです。index.htmlのOGPに指定し、タイトル・説明はPWAマニフェストと揃えています。
