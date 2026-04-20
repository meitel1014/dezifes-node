"$ARGUMENTS" という名前の NodeCG Dashboard パネルをスキャフォールドしてください。

手順:
1. `src/browser/dashboard/$ARGUMENTS/index.tsx`（エントリポイント）を作成
2. `_shared/` の既存コンポーネントを使わない独立パネルの場合は `App.tsx` も作成
3. `package.json` の `nodecg.dashboardPanels` にパネル設定を追加

パターン選択:
- ナワバリ/エリア共通ロジックを持つパネルは `_shared/` の既存コンポーネント（`ButtonsPanel`、`TeamSelectPanel`、`PreviewPanel` など）を `mode` プロップで呼び出す形にする
- 独立したパネル（設定系など）は `settings-csv-reload/` のように `index.tsx` + `App.tsx` の 2 ファイル構成にする
- CSS は `index.tsx` で `@/browser/global.css` と `../_shared/dashboard.css` をインポートして共用する。個別の `style.css` は原則作成しない

既存パネルの参考:
- `_shared/` 利用例: `src/browser/dashboard/turf-war-buttons/index.tsx`
- 独立パネル例: `src/browser/dashboard/settings-csv-reload/index.tsx` + `App.tsx`

作業開始前に、workspace 名・パネルタイトル・横幅（1〜8）をユーザーに確認してください。
