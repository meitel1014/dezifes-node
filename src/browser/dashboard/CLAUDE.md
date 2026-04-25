# Dashboard パネル構成

| Workspace | パネル | 表示名 | 幅 |
|---|---|---|---|
| Battle | `mode-select` | モード切替 | 4 |
| Battle | `turf-war-team-select` | チーム選択 | 4 |
| Battle | `turf-war-buttons` | 表示操作 | 4 |
| Battle | `turf-war-preview` | プレビュー編集 | 8 |
| Result | `result` | 判定結果 | fullbleed |
| 設定 | `settings-csv-reload` | 設定｜CSV 再読込 | 4 |
| 設定 | `settings-weapons` | 設定｜ブキ対応表 | 4 |
| 設定 | `settings-google-sheet` | 設定｜Google スプレッドシート同期 | 4 |

`mode-select` パネルに ナワバリ/エリア 切り替えボタンを配置。切り替えは `activeMode` Replicant に書き込む。他のパネルは `activeMode` を読み取り、`_shared/` コンポーネントに `mode` プロップとして渡す。

## 実装パターン

- **Battle / Result パネル**: ラッパーで `useReplicant('activeMode')` を読み取り `_shared/` コンポーネントに渡す（`index.tsx` は薄いラッパー）。
- **独立パネル**（`settings-csv-reload` 等）: `index.tsx` + `App.tsx` の 2 ファイル構成。
- **`_shared/` ディレクトリ**: `index.tsx` がないためエントリとして認識されない。共通コンポーネント・CSS のみ配置。
- **HTML 生成**: `{name}/index.tsx` を置くとビルド時に `dashboard/{name}.html` が自動生成される。手動で HTML を書かない。

## fullbleed パネルの注意点

`fullbleed: true` のパネルは NodeCG がワークスペースを自動生成するため、`package.json` の dashboardPanels エントリに **`workspace` を同時指定してはいけない**（起動時エラーになる）。ワークスペース名はパネルの `title` をもとに NodeCG が決める。
