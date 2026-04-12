"$ARGUMENTS" という名前の NodeCG Graphic ページをスキャフォールドしてください。

手順:
1. `src/browser/graphics/$ARGUMENTS/index.tsx`（エントリポイント）を作成
2. `src/browser/graphics/$ARGUMENTS/App.tsx`（React コンポーネント）を作成
3. `src/browser/graphics/$ARGUMENTS/style.css` を作成
4. `package.json` の `nodecg.graphics` に `width: 1920, height: 1080` で追加

既存の `src/browser/graphics/result/` のパターンに従うこと。
作業開始前に、どの Replicant を参照するかをユーザーに確認してください。
