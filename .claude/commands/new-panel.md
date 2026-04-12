"$ARGUMENTS" という名前の NodeCG Dashboard パネルをスキャフォールドしてください。

手順:
1. `src/browser/dashboard/$ARGUMENTS/index.tsx`（エントリポイント）を作成
2. `src/browser/dashboard/$ARGUMENTS/App.tsx`（React コンポーネント）を作成
3. `src/browser/dashboard/$ARGUMENTS/style.css` を作成
4. `package.json` の `nodecg.dashboardPanels` にパネル設定を追加

既存パネル（`src/browser/dashboard/control/`、`src/browser/dashboard/player-info/`）のパターンに従うこと。
作業開始前に、workspace 名・パネルタイトル・横幅（1〜8）をユーザーに確認してください。
