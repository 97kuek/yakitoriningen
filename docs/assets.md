# 画面で使う素材

## 採用画像

- `public/assets/shop-logo.png`：提供看板を参照して生成した「焼き鳥人間」のロゴ。
- `public/assets/welcome-stall.png`：提供されたWASAポスターとひよこの絵を参照して生成した、開始画面の屋台。

組み込みの`image_gen`で生成・編集しました。ロゴの透過を保持し、焼き鳥は光沢を抑えた平面の塗りに修正しています。画面の文字と操作部品はHTMLで表示します。

待ち一覧向けのひよこ画像案は背景のにじみが残ったため不採用とし、営業画面は小さなアイコンと短い文にしました。

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

- `public/assets/shop-logo.png`：既存の文字とひよこを維持した編集。透過PNG。
- `public/assets/empty-orders.png`：空の待ち一覧用イラスト。白地PNG。

ロゴ最終編集プロンプト：

> Refine ONLY the meat on the left skewer of this transparent logo. Keep exact Japanese letters 焼き鳥人間 and chick and transparent layout unchanged. The chicken currently looks BREADED fried croquettes with long black middle slits. Make three solid irregular CUBES of unbreaded grilled chicken thigh: smooth simple flat pale tan fill, chunky squared outline, only two tiny short charcoal grill strokes on each piece, NO grainy crumbs, NO dark middle cutout slit, NO breading, NO texture. Keep pale white-green leek segments between the chicken cubes. Hand drawn outlined flat cartoon, matte. Every pixel outside the skewer/letters/chick must be transparent alpha0. NO background, NO glow, NO shadow.

空状態の最終生成プロンプト：

> A tiny quiet illustration for an empty yakitori order list. WHITE BACKGROUND, solid perfectly uniform pure white #FFFFFF, no transparency. One simple round yellow chick with a small cream festival headband, standing beside a small EMPTY rectangular wooden serving tray. Friendly calm face, eyes smiling. Sparse hand-drawn dark brown outlines, FLAT solid yellow body, FLAT ochre tray, small orange beak/feet. Only four flat colors plus white background. Like a simple Japanese school festival pen drawing, no digital effects. No shading, NO paper texture, NO grain, NO gradients, NO drop shadows, NO ambient glow, NO halo, NO fog, NO dark vignette, NO light rays, no food, no text, no lettering, no sparkles, no decor. The background must remain pure white right up to the character outline. Full character and tray comfortably visible, centered compact landscape composition, clean small UI sticker.
