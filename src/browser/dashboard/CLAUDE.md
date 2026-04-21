# Dashboard パネル構成

| Workspace | パネル | 表示名 | 幅 |
|---|---|---|---|
| Battle | `turf-war-team-select` | チーム選択 | 4 |
| Battle | `turf-war-buttons` | 表示操作・モード切替 | 4 |
| Battle | `turf-war-preview` | プレビュー編集 | 8 |
| Battle | `turf-war-results` | 判定結果 | 8 |
| 設定 | `settings-csv-reload` | 設定｜CSV 再読込 | 4 |
| 設定 | `settings-google-sheet` | 設定｜Google スプレッドシート同期 | 4 |

「表示操作・モード切替」パネルに ナワバリ/エリア 切り替えボタンを配置。切り替えは `activeMode` Replicant に書き込む。他の3パネルは `activeMode` を読み取り、`_shared/` コンポーネントに `mode` プロップとして渡す。

## 実装パターン

- **Battleパネル**: ラッパーで `useReplicant('activeMode')` を読み取り `_shared/` コンポーネントに渡す（`turf-war-*/index.tsx` は薄いラッパー）。
- **独立パネル**（`settings-csv-reload` 等）: `index.tsx` + `App.tsx` の 2 ファイル構成。
- **`_shared/` ディレクトリ**: `index.tsx` がないためエントリとして認識されない。共通コンポーネント・CSS のみ配置。
- **HTML 生成**: `{name}/index.tsx` を置くとビルド時に `dashboard/{name}.html` が自動生成される。手動で HTML を書かない。
