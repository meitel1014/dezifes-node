# デジフェス 配信グラフィック（dezifes-nodecg）

デジ窓フェスティバル（デジフェス）のスプラトゥーン 3 大会用 NodeCG 配信グラフィックシステムです。ナワバリトーナメント・エリアトーナメントのチーム情報を管理・表示します。

## 会場 PC セットアップ手順（Windows 11）

開発環境が入っていない素の Windows PC で動かすための手順です。

### 1. このリポジトリの準備

#### Git がインストール済みの場合

```powershell
git clone <このリポジトリのURL>
cd dezifes-nodecg
```

#### Git がない場合

1. リポジトリの ZIP をダウンロードして展開
2. PowerShell で展開先のフォルダに移動

```powershell
cd C:\Users\<ユーザー名>\Downloads\dezifes-nodecg
```

### 2. Node.js のインストール

1. https://nodejs.org/ にアクセスし、**v22 LTS**（推奨版）のインストーラーをダウンロード
2. インストーラーを実行（設定はすべてデフォルトのまま「Next」で OK）
3. インストール完了後、**PowerShell** を開いて以下を実行し、バージョンが表示されれば成功

```powershell
node -v
# v22.x.x と表示されれば OK
```

### 3. pnpm の有効化

Node.js に同梱されている Corepack で pnpm を有効化します。PowerShell で実行してください。

```powershell
corepack enable
```

> **エラーが出る場合**: PowerShell を **管理者として実行** してからもう一度 `corepack enable` を試してください。

> それでも実行できない場合こちらを参照。
> https://qiita.com/araiWorks/items/6964e85a73bff3ff705c

### 4. 依存関係のインストール

```powershell
pnpm install
```

初回は数分かかります。

### 5. ビルド

```powershell
pnpm build
```

エラーなく完了すれば準備完了です。

### 6. 各種ファイルの配置

dataフォルダ内に、Discord上のリンクから落としてきたデータをコピーする。

### 7. 起動

```powershell
npx nodecg start
```

起動後、ブラウザで以下にアクセスします。

| URL | 用途 |
|---|---|
| http://localhost:9090 | ダッシュボード（運営操作画面） |
| http://localhost:9090/bundles/dezifes-nodecg/graphics/turf-war-under.html | ナワバリ Under（配信画面下部） |
| http://localhost:9090/bundles/dezifes-nodecg/graphics/turf-war-side.html | ナワバリ Side（会場左右分割） |
| http://localhost:9090/bundles/dezifes-nodecg/graphics/splat-zones-under.html | エリア Under（配信画面下部） |
| http://localhost:9090/bundles/dezifes-nodecg/graphics/splat-zones-side.html | エリア Side（会場左右分割） |

### 8. OBS への取り込み

1. OBS で「ソース」→「＋」→「ブラウザ」を追加
2. URL に上記の Graphics URL を入力
3. 幅 `1920`、高さ `1080` に設定
4. 「カスタム CSS」は空にする（デフォルトの body 背景色指定を消すため）

## 運営操作ガイド

### ダッシュボードの構成

ダッシュボードには 3 つのタブ（Workspace）があります。

- **ナワバリ** — ナワバリトーナメント用の操作パネル
- **エリア** — エリアトーナメント用の操作パネル
- **設定** — CSV 再読込

各トーナメントのタブには以下のパネルがあります。

| パネル | 操作内容 |
|---|---|
| チーム選択 | アルファ / ブラボーのチームをプルダウンで選択 |
| 表示操作 | チーム情報の表示 / 非表示切り替え、リセット |
| プレビュー編集 | 選択チームの情報を確認・編集 |

### 基本的な操作の流れ

1. **チーム選択パネル** でアルファ・ブラボーのチームを選ぶ
2. **プレビュー編集パネル** で内容を確認（必要なら編集ボタンで修正）
3. **表示操作パネル** で「アルファチーム表示」「ブラボーチーム表示」を押す → Graphic にフェードインで表示される
4. もう一度同じボタンを押すとフェードアウトで非表示になる
5. **リセットボタン** を押すと、両チーム非表示 + 選択も初期化される

### CSV 再読込

設定タブの「CSV 再読込」ボタンを押すと、`data\teams.csv` から最新のデータを読み直します。**編集した内容はすべて破棄**されるのでご注意ください。

## トラブルシューティング

### `pnpm` コマンドが見つからない

```powershell
corepack enable
```

を管理者権限の PowerShell で実行してください。

### ビルドでエラーが出る

Node.js のバージョンが v22 以上であることを確認してください。

```powershell
node -v
```

### 起動後にブラウザでアクセスできない

- `npx nodecg start` が正常に起動しているか確認
- Windows ファイアウォールのダイアログが出たら「許可」を選択
- URL が `http://localhost:9090` であることを確認（`https` ではない）

### 同じ LAN 内の別 PC からアクセスしたい

起動 PC の IP アドレスを確認し、`http://<IPアドレス>:9090` でアクセスできます。

```powershell
ipconfig
```

で IPv4 アドレスを確認してください（例: `192.168.1.100`）。

## ライセンス

MIT（詳細は [LICENSE](./LICENSE) を参照）
