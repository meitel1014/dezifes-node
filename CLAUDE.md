# CLAUDE.md

## プロジェクト概要

デジ窓フェスティバル（デジフェス）の配信グラフィックシステム。
スプラトゥーン 3 を用いたナワバリトーナメントとエリアトーナメントの 2 つのイベントで、チーム情報を Dashboard から操作し、配信画面と会場スクリーンにオーバーレイ表示する。

バンドル名: `dezifes-nodecg`（[package.json](package.json) の `name` と [bundleName.ts](bundleName.ts) の `BUNDLE_NAME` で定義。一致必須）

## 技術スタック

- **NodeCG**: v2 (`^2.6.4`) / **Node.js**: v22 以上（LTS）
- **フレームワーク**: React 19 + TypeScript 5.9（SWC 経由）
- **ビルド**: Vite 7 + Rollup 4 + esbuild（dashboard/graphics は Vite、extension は Rollup の別ビルド）
- **スキーマ**: Zod 3 + zod-to-json-schema（Replicant 型 → JSON Schema の自動生成）
- **型ブリッジ**: [ts-nodecg](https://www.npmjs.com/package/ts-nodecg)（`nodecg` グローバルを強く型付け）
- **パッケージマネージャー**: pnpm（Corepack 有効化）

## コマンド

```bash
pnpm install       # 依存インストール
pnpm dev           # Vite と NodeCG を並列起動（HMR あり）
pnpm build         # tsc -b → vite build（型チェック → プロダクションビルド）
pnpm lint          # ESLint（flat config）
npx nodecg start   # pnpm build 後の本番起動
```

- Vite 開発サーバー: http://localhost:8080（dashboard/graphics 用 HMR）
- NodeCG ダッシュボード: http://localhost:9090

`pnpm dev` は `run-p` で両方を並列起動する。本番運用では `pnpm build` → `npx nodecg start` を使うこと。

## アーキテクチャ

NodeCG は **Dashboard** / **Graphics** / **Extension** の 3 コンポーネントで構成される。

- **Dashboard** ([src/browser/dashboard/](src/browser/dashboard/)) — 運営用の操作パネル（3 Workspace: ナワバリ / エリア / 設定）
- **Graphics** ([src/browser/graphics/](src/browser/graphics/)) — 配信画面に載せるオーバーレイ（4 ページ）
- **Extension** ([src/extension/index.ts](src/extension/index.ts)) — CSV ロード、メッセージハンドラ、Replicant 管理

### Replicant（状態同期）

| Replicant名 | 型 | 用途 |
|---|---|---|
| `teamsPool` | `TeamsPool` | モード別チーム一覧（CSV 由来、編集で上書き） |
| `selection` | `Selection` | モード別 α/β 選択チーム名 |
| `visibility` | `Visibility` | モード別 α/β 表示状態（フェードイン/アウト制御） |

Replicant は NodeCG の `db/` に自動永続化される。編集内容はプロセス再起動後も保持される。

### Message（操作命令）

| Message名 | ペイロード | 用途 |
|---|---|---|
| `reloadTeamsCsv` | なし | CSV 再読込（編集内容破棄） |
| `resetMode` | `{ mode }` | 表示非表示 + 選択初期化 |
| `updateTeam` | `{ mode, teamName, patch }` | チーム情報の部分更新 |

> **Note**: 表示/非表示のトグルは Dashboard から `visibility` Replicant を直接書き換えて行う。

### 型安全ブリッジ

`ts-nodecg` により、Replicant 名・Message 名・ペイロードの全てで補完が効く。

- [src/nodecg/replicants.d.ts](src/nodecg/replicants.d.ts) — `ReplicantMap`
- [src/nodecg/messages.d.ts](src/nodecg/messages.d.ts) — `MessageMap`（`Mode`, `Side` 型もここで定義）

追加作業の順序は **Zod スキーマ → マップ登録 → 実装** にすると、ビルドエラーで抜けを検出しやすい。

### Zod スキーマと JSON Schema の自動生成

[vite-plugin-nodecg-schemas.mts](vite-plugin-nodecg-schemas.mts) が `src/schemas/index.ts` から `*Schema` エクスポートを走査して `schemas/{name}.json` を自動生成する。

**命名規約**: `{name}Schema` で re-export する。re-export を忘れるとスキーマが NodeCG に反映されない。

### 生 HTML の扱い（D案）

チーム名には `<br>` 等の HTML タグを含めることができる（CSV に直接書く）。
レンダリングは [src/browser/components/Html.tsx](src/browser/components/Html.tsx) コンポーネント経由のみ。
`dangerouslySetInnerHTML` の直書きは禁止し、`<Html>` コンポーネントに閉じ込めている。

## ディレクトリ構成

```text
.
├── bundleName.ts                    # BUNDLE_NAME（package.json の name と一致必須）
├── vite.config.mts                  # Vite 設定
├── vite-plugin-nodecg.mts           # dashboard/graphics の HTML 生成 + extension の Rollup ビルド
├── vite-plugin-nodecg-schemas.mts   # Zod → JSON Schema 生成
├── data/
│   └── teams.csv                    # チーム情報原本（UTF-8 BOMなし）
├── src/
│   ├── template.html                # 全 HTML の共通テンプレート
│   ├── browser/
│   │   ├── global.css               # リセット CSS
│   │   ├── global.d.ts              # ブラウザ側 `nodecg` グローバル型宣言
│   │   ├── components/Html.tsx      # 生 HTML レンダリング専用コンポーネント
│   │   ├── hooks/
│   │   │   ├── useReplicant.ts      # Replicant 購読用 React フック
│   │   │   └── useFadeVisible.ts    # 0.5秒フェードイン/アウト用フック
│   │   ├── dashboard/
│   │   │   ├── _shared/             # ナワバリ/エリア共通パネルコンポーネント
│   │   │   ├── turf-war-*/          # ナワバリ Workspace パネル (3つ)
│   │   │   ├── splat-zones-*/       # エリア Workspace パネル (3つ)
│   │   │   └── settings-csv-reload/ # CSV 再読込パネル
│   │   └── graphics/
│   │       ├── _shared/             # under/side 共通コンポーネント + CSS
│   │       ├── turf-war-under/      # ナワバリ配信画面下部
│   │       ├── turf-war-side/       # ナワバリ会場左右分割
│   │       ├── splat-zones-under/   # エリア配信画面下部
│   │       └── splat-zones-side/    # エリア会場左右分割
│   ├── extension/
│   │   ├── index.ts                 # Extension エントリポイント
│   │   ├── csv.ts                   # 最小 RFC4180 CSV パーサ
│   │   ├── loadTeams.ts             # CSV → TeamsPool 変換
│   │   └── nodecg.d.ts              # Extension 側 `NodeCG` 型
│   ├── nodecg/
│   │   ├── replicants.d.ts          # ReplicantMap
│   │   └── messages.d.ts            # MessageMap + Mode / Side 型
│   └── schemas/
│       ├── index.ts                 # 全スキーマを re-export
│       ├── bundleConfig.ts          # configschema 用
│       ├── team.ts                  # Team 型
│       ├── teamsPool.ts             # TeamsPool（モード別チーム配列）
│       ├── selection.ts             # Selection（α/β 選択状態）
│       └── visibility.ts            # Visibility（α/β 表示状態）
└── cfg/                             # NodeCG 設定（.gitignore 対象）
```

### Path alias

`@/*` → `src/*`（[tsconfig.app.json](tsconfig.app.json) と [vite.config.mts](vite.config.mts) で定義）

> [!CAUTION]
> ルート直下の `dashboard/`, `graphics/`, `extension/`, `shared/`, `schemas/` は Vite ビルド成果物で、すべて `.gitignore` 対象。**直接編集しない。** 編集は必ず `src/` 内で行う。

## Dashboard パネル構成

| Workspace | パネル | 表示名 | 幅 |
|---|---|---|---|
| ナワバリ | `turf-war-team-select` | ナワバリ｜チーム選択 | 4 |
| ナワバリ | `turf-war-buttons` | ナワバリ｜表示操作 | 4 |
| ナワバリ | `turf-war-preview` | ナワバリ｜プレビュー編集 | 8 |
| エリア | `splat-zones-team-select` | エリア｜チーム選択 | 4 |
| エリア | `splat-zones-buttons` | エリア｜表示操作 | 4 |
| エリア | `splat-zones-preview` | エリア｜プレビュー編集 | 8 |
| 設定 | `settings-csv-reload` | 設定｜CSV 再読込 | 4 |

ナワバリとエリアは同一構造で mode プロップだけ異なる。共通ロジックは `_shared/` に集約。

## Graphic 仕様

| Graphic | 用途 | 表示領域 |
|---|---|---|
| `turf-war-under` | ナワバリ配信画面下部 | α: 左下 960×70 / β: 右下 960×70（中央寄せ） |
| `turf-war-side` | ナワバリ会場左右分割 | α: 左上 960×960 / β: 右上 960×960 |
| `splat-zones-under` | エリア配信画面下部 | 同上 |
| `splat-zones-side` | エリア会場左右分割 | 同上 |

- **under**: チーム名 + プレイヤー名（全角スペース区切り）。フォント比率 1:1。
- **side**: 二つ名 + チーム名 + プレイヤー 1〜4。フォント比率 1:3:2。α は左寄せ、β は右寄せ。
- side のプレイヤー名位置はチーム名行数に関わらず固定（`grid-template-rows` で制御）。
- フェードイン/アウトは CSS transition opacity 0.5 秒。
- 装飾は CSS クラスのみ付与。スタイル調整は手動で行う。

## データフロー

1. 運営が `data/teams.csv`（UTF-8 BOMなし）にチーム情報を書く
2. Extension 起動時に CSV を読み、`teamsPool` Replicant を初期化（永続値があればスキップ）
3. Dashboard でチーム選択 → `selection` Replicant 更新
4. Dashboard で「表示/非表示」ボタン → `visibility` Replicant を直接トグル → Graphic がフェードイン/アウト
5. Dashboard で「リセット」ボタン → `resetMode` メッセージ → `visibility` + `selection` クリア → Graphic がフェードアウト
6. Dashboard のプレビュー編集 → `updateTeam` メッセージ → `teamsPool` 内のチームを部分更新
7. 設定で「CSV 再読込」→ `reloadTeamsCsv` メッセージ → CSV から `teamsPool` を強制上書き（編集破棄）

## CSV 仕様（data/teams.csv）

| 列名 | 内容 |
|---|---|
| `どちらのイベントに出場しますか` | `ナワバリトーナメント` or `エリアトーナメント` |
| `チーム名` | チーム名。改行は `<br>` を含められる |
| `プレイヤー1`〜`プレイヤー4` | プレイヤー名 |
| `二つ名` | 二つ名 |

チーム名を一意キーとして扱う（重複不可）。

## 重要な挙動メモ

- **HTML 生成の規約**: `src/browser/{dashboard,graphics}/{name}/index.tsx` を置くと、ビルド時に `{dashboard|graphics}/{name}.html` が [src/template.html](src/template.html) をベースに自動生成される。手動で HTML を書かない。
- **`_shared/` ディレクトリ**: `src/browser/dashboard/_shared/` と `src/browser/graphics/_shared/` に共通コンポーネントを配置。`index.tsx` がないのでエントリとして認識されない。
- **Replicant 永続化**: NodeCG の `db/` 配下に JSON で自動保存される。編集内容はプロセス再起動後も残る。初回起動時のみ CSV から初期化。
- **Replicant の初期値**: Zod スキーマの `.default(...)` で定義。Extension では `defaultValue` を渡さない。
- **useReplicant は `undefined` を返しうる**: 初回レンダリング時は値が未到達。`?.` や `?? fallback` でガード。
- **Extension ビルド**: Rollup で **CJS** 出力（NodeCG の require 用）。`rollup-plugin-node-externals` で外部化。
- **ESLint**: `useReplicant` の `rep.value = newValue` は `react-hooks/immutability` の suppress 対象（NodeCG API の正規の書き方）。

## `.claude/` ディレクトリについて

- [agents/nodecg-reviewer.md](.claude/agents/nodecg-reviewer.md) — Replicant/Message/スキーマ/Extension 実装の整合性レビュー
- [commands/build.md](.claude/commands/build.md) — ビルド実行 + 結果報告
- [commands/new-panel.md](.claude/commands/new-panel.md), [commands/new-graphic.md](.claude/commands/new-graphic.md) — 雛形生成

> [!NOTE]
> `new-panel.md` と `new-graphic.md` は現プロジェクトのパターンに沿って記述されている。
> ナワバリ/エリア共通パネルは `_shared/` コンポーネントを `mode` プロップで呼び出す形、独立パネルは `index.tsx` + `App.tsx` の 2 ファイル構成を使う。

## 参考リソース

- 会場セットアップ手順: [README.md](README.md)
- 元テンプレートの README: [README-ORIGINAL.md](README-ORIGINAL.md)
- 解説記事: [NodeCG 配信グラフィック開発入門（Zenn Book）](https://zenn.dev/bozitoma/books/nodecg-react-overlay)
