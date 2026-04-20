# Dashboard パネル構成

| Workspace | パネル | 表示名 | 幅 |
|---|---|---|---|
| ナワバリ | `turf-war-team-select` | ナワバリ｜チーム選択 | 4 |
| ナワバリ | `turf-war-buttons` | ナワバリ｜表示操作 | 4 |
| ナワバリ | `turf-war-preview` | ナワバリ｜プレビュー編集 | 8 |
| ナワバリ | `turf-war-results` | ナワバリ｜判定結果 | 8 |
| エリア | `splat-zones-team-select` | エリア｜チーム選択 | 4 |
| エリア | `splat-zones-buttons` | エリア｜表示操作 | 4 |
| エリア | `splat-zones-preview` | エリア｜プレビュー編集 | 8 |
| エリア | `splat-zones-results` | エリア｜判定結果 | 8 |
| 設定 | `settings-csv-reload` | 設定｜CSV 再読込 | 4 |

ナワバリとエリアは同一構造で `mode` プロップだけ異なる。共通ロジックは `_shared/` に集約。

## 実装パターン

- **ナワバリ/エリア共通パネル**: `_shared/` コンポーネントを `mode` プロップで呼び出す（`turf-war-*/index.tsx` と `splat-zones-*/index.tsx` は薄いラッパー）。
- **独立パネル**（`settings-csv-reload` 等）: `index.tsx` + `App.tsx` の 2 ファイル構成。
- **`_shared/` ディレクトリ**: `index.tsx` がないためエントリとして認識されない。共通コンポーネント・CSS のみ配置。
- **HTML 生成**: `{name}/index.tsx` を置くとビルド時に `dashboard/{name}.html` が自動生成される。手動で HTML を書かない。
