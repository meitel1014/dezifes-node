"$ARGUMENTS" という名前の NodeCG Graphic ページをスキャフォールドしてください。

手順:
1. `src/browser/graphics/$ARGUMENTS/index.tsx`（エントリポイント）を作成
2. `package.json` の `nodecg.graphics` に `width: 1920, height: 1080` で追加

パターン:
- `_shared/` の既存コンポーネント（`UnderGraphic`、`SideGraphic`）を `mode` プロップで呼び出す形にする
- CSS は `index.tsx` で `@/browser/global.css` と `../_shared/under.css`（または `side.css`）をインポートする
- `App.tsx` や個別の `style.css` は原則作成しない

既存グラフィックの参考:
- `src/browser/graphics/turf-war-under/index.tsx`（under パターン）
- `src/browser/graphics/turf-war-side/index.tsx`（side パターン）

作業開始前に、under（配信画面下部）か side（会場左右分割）か、および対応 mode（`turfWar` / `splatZones`）をユーザーに確認してください。
