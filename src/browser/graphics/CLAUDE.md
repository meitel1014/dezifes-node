# Graphic 仕様

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

## 実装パターン

- **HTML 生成**: `{name}/index.tsx` を置くとビルド時に `graphics/{name}.html` が自動生成される。手動で HTML を書かない。
- **`_shared/` ディレクトリ**: under/side 共通コンポーネント + CSS を配置。`index.tsx` がないためエントリ扱いされない。
