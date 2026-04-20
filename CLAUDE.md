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
- **画像処理**: sharp（スクショ切り出し・リサイズ・アノテーション）
- **フォントレンダリング**: opentype.js（プレイヤー名比較用ラスタライズ）

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
| `matchCandidates` | `MatchCandidates` | OCR 判定中候補（モード別・未確定・最新 1 件）|
| `matches` | `Match[]` | 確定済み試合記録（永続） |
| `weaponAliases` | `WeaponAliases` | ブキ ID → 表示名マッピング（CSV 由来） |

Replicant は NodeCG の `db/` に自動永続化される。編集内容はプロセス再起動後も保持される。

### Message（操作命令）

| Message名 | ペイロード | 用途 |
|---|---|---|
| `reloadTeamsCsv` | なし | CSV 再読込（編集内容破棄） |
| `resetMode` | `{ mode }` | 表示非表示 + 選択初期化 |
| `updateTeam` | `{ mode, teamName, patch }` | チーム情報の部分更新 |
| `confirmMatchCandidate` | `{ mode }` | OCR 候補を確定して `matches` に追加 |
| `dismissMatchCandidate` | `{ mode }` | OCR 候補を破棄 |
| `updateMatchCandidate` | `{ mode, side, position, patch }` | 候補のプレイヤー名・ブキを手動修正 |
| `deleteMatch` | `{ id }` | 確定済み試合記録を削除 |

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
│   ├── teams.csv                    # チーム情報原本（UTF-8 BOMなし）
│   ├── weapon_aliases.csv           # ブキ ID → 表示名マッピング
│   ├── weapon_flat_10_0_0/          # ブキフラットアイコン PNG（173 枚）
│   ├── Splatoon2-merged.ttf         # プレイヤー名判定用フォント
│   └── screenshots/                 # OCR 対象スクショ格納ディレクトリ
│       └── annotated/               # アノテーション済み画像（自動生成）
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
│   │   │   ├── turf-war-*/          # ナワバリ Workspace パネル (4つ)
│   │   │   ├── splat-zones-*/       # エリア Workspace パネル (4つ)
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
│   │   ├── nodecg.d.ts              # Extension 側 `NodeCG` 型
│   │   └── ocr/
│   │       ├── regions.ts           # 判定座標定義（唯一の調整ポイント）
│   │       ├── matchWeapon.ts       # ZNCC によるブキ判定
│   │       ├── matchPlayerName.ts   # MSE スライディング窓によるプレイヤー名判定
│   │       ├── processScreenshot.ts # スクショ OCR 処理全体
│   │       └── annotateScreenshot.ts# 判定領域矩形付き確認画像生成
│   ├── nodecg/
│   │   ├── replicants.d.ts          # ReplicantMap
│   │   └── messages.d.ts            # MessageMap + Mode / Side / PickPosition 型
│   └── schemas/
│       ├── index.ts                 # 全スキーマを re-export
│       ├── bundleConfig.ts          # configschema 用
│       ├── team.ts                  # Team 型
│       ├── teamsPool.ts             # TeamsPool（モード別チーム配列）
│       ├── selection.ts             # Selection（α/β 選択状態）
│       ├── visibility.ts            # Visibility（α/β 表示状態）
│       ├── matchCandidate.ts        # MatchCandidate / PickCandidate 型
│       ├── match.ts                 # Match（確定済み試合記録）型
│       └── weaponAliases.ts         # WeaponAliases 型
└── cfg/                             # NodeCG 設定（.gitignore 対象）
```

### Path alias

`@/*` → `src/*`（[tsconfig.app.json](tsconfig.app.json) と [vite.config.mts](vite.config.mts) で定義）

> [!CAUTION]
> ルート直下の `dashboard/`, `graphics/`, `extension/`, `shared/`, `schemas/` は Vite ビルド成果物で、すべて `.gitignore` 対象。**直接編集しない。** 編集は必ず `src/` 内で行う。
> - 思考プロセス（Thinkingブロック）は必ず日本語で記述する。
> - ユーザーへの回答も日本語で行う。

Dashboard パネル構成: [src/browser/dashboard/CLAUDE.md](src/browser/dashboard/CLAUDE.md)
Graphic 仕様: [src/browser/graphics/CLAUDE.md](src/browser/graphics/CLAUDE.md)
CSV・data/ 仕様: [data/CLAUDE.md](data/CLAUDE.md)

## データフロー

### チーム表示フロー
1. 運営が `data/teams.csv`（UTF-8 BOMなし）にチーム情報を書く
2. Extension 起動時に CSV を読み、`teamsPool` Replicant を初期化（永続値があればスキップ）
3. Dashboard でチーム選択 → `selection` Replicant 更新
4. Dashboard で「表示/非表示」ボタン → `visibility` Replicant を直接トグル → Graphic がフェードイン/アウト
5. Dashboard で「リセット」ボタン → `resetMode` メッセージ → `visibility` + `selection` クリア → Graphic がフェードアウト
6. Dashboard のプレビュー編集 → `updateTeam` メッセージ → `teamsPool` 内のチームを部分更新
7. 設定で「CSV 再読込」→ `reloadTeamsCsv` メッセージ → CSV から `teamsPool` を強制上書き（編集破棄）

### OCR 判定フロー

詳細は [src/extension/ocr/CLAUDE.md](src/extension/ocr/CLAUDE.md) を参照。

## 重要な挙動メモ

- **Replicant 永続化**: NodeCG の `db/` 配下に JSON で自動保存される。編集内容はプロセス再起動後も残る。初回起動時のみ CSV から初期化。
- **Replicant の初期値**: Zod スキーマの `.default(...)` で定義。Extension では `defaultValue` を渡さない。
- **useReplicant は `undefined` を返しうる**: 初回レンダリング時は値が未到達。`?.` や `?? fallback` でガード。
- **Extension ビルド**: Rollup で **CJS** 出力（NodeCG の require 用）。`rollup-plugin-node-externals` で外部化。
- **ESLint**: `useReplicant` の `rep.value = newValue` は `react-hooks/immutability` の suppress 対象（NodeCG API の正規の書き方）。
- **OCR 詳細**: [src/extension/ocr/CLAUDE.md](src/extension/ocr/CLAUDE.md) を参照（座標定義・ZNCC・CPU スパイク対策・nodecg.mount 等）。

## `.claude/` ディレクトリについて

- [agents/nodecg-reviewer.md](.claude/agents/nodecg-reviewer.md) — Replicant/Message/スキーマ/Extension 実装の整合性レビュー
- [commands/build.md](.claude/commands/build.md) — ビルド実行 + 結果報告
- [commands/new-panel.md](.claude/commands/new-panel.md), [commands/new-graphic.md](.claude/commands/new-graphic.md) — 雛形生成（ナワバリ/エリア共通パネルは `_shared/` + `mode` プロップ形式、独立パネルは `index.tsx` + `App.tsx` 形式）

## 参考リソース

- 会場セットアップ手順: [README.md](README.md)
- 元テンプレートの README: [README-ORIGINAL.md](README-ORIGINAL.md)
- 解説記事: [NodeCG 配信グラフィック開発入門（Zenn Book）](https://zenn.dev/bozitoma/books/nodecg-react-overlay)
