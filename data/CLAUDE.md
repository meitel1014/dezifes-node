# data/ ディレクトリ

## ファイル一覧

| ファイル/ディレクトリ | 内容 |
|---|---|
| `teams.csv` | チーム情報原本（UTF-8 BOMなし） |
| `weapon_aliases.csv` | ブキ ID → 表示名マッピング |
| `weapon_flat_10_0_0/` | ブキフラットアイコン PNG（173 枚） |
| `Splatoon2-merged.ttf` | プレイヤー名判定用フォント |
| `stages/turfWar/` | ステージ判別テンプレート（ナワバリ用） |
| `stages/splatZones/` | ステージ判別テンプレート（エリア用） |
| `screenshots/` | OCR 対象スクショ格納ディレクトリ |
| `screenshots/annotated/` | アノテーション済み画像（自動生成） |

## teams.csv 仕様

| 列名 | 内容 |
|---|---|
| `どちらのイベントに出場しますか` | `ナワバリトーナメント` or `エリアトーナメント` |
| `チーム名` | チーム名。改行は `<br>` を含められる |
| `プレイヤー1`〜`プレイヤー4` | プレイヤー名 |
| `二つ名` | 二つ名 |

チーム名を一意キーとして扱う（重複不可）。

## weapon_aliases.csv 仕様

2 列構成: `id,name`（ヘッダ行あり）。
`id` は `weapon_flat_10_0_0/` のファイル名から拡張子を除いたもの（例: `Path_Wst_Saber_Normal_O`）。
Extension 起動時に読み込まれ `weaponAliases` Replicant に格納される。

## stages/ 仕様

各ルールのディレクトリに以下を配置する。
- `stages.txt` — 改行区切りのステージ名一覧（この順序でロードされる）
- `{ステージ名}.png` — 1920×1080 のテンプレート画像（ファイル名 = ステージ名、拡張子 `.png`）

Extension 起動時にメモリキャッシュへロード（`stageNames` Replicant に名前一覧を反映）。テンプレートの追加・変更時は NodeCG 再起動が必要。
ステージ名は records.csv / GAS にそのまま出力されるため、日本語ステージ名で統一すること。
