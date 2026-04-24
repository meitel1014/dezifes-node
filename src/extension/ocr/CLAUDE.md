# OCR 判定フロー

1. Extension 起動時に `data/weapon_aliases.csv` を読み `weaponAliases` Replicant を初期化。同時に `data/stages/{mode}/` のテンプレートをロードし `stageNames` Replicant を初期化
2. `POST /stage`（`Content-Type: text/plain`、ボディは生 base64 PNG）で試合開始時のステージ画面を受信 → `matchStage.ts` で判別 → `latestStageCandidate[mode]` に保持（`data/screenshots/stage-{timestamp}.png` に保存）
3. `POST /weapons`（`Content-Type: text/plain`、ボディは生 base64 PNG）でブキ編成 OCR を起動
   - Dashboard のドラッグ&ドロップ・OBS 等の外部ツール共通のエンドポイント
   - NodeCG の global JSON body-parser（100kb 制限）を回避するため `text/plain` を使用し、Extension 側でストリーム収集する
   - PNG は `data/screenshots/weapons-{timestamp}.png` に保存される
4. **OCR 処理（`processScreenshot.ts`）**:
   - `selection[mode]` の アルファ/ブラボー チームを確認（未選択なら skip）
   - 4 ポジションを**逐次**処理（CPU スパイク平坦化のため `setImmediate` yield を使用）
   - プレイヤー名: `data/Splatoon2-merged.ttf` でレンダリングした比較画像との MSE スライディングウィンドウ照合
   - ブキ: `data/weapon_flat_10_0_0/` テンプレートとの ZNCC（ゼロ平均正規化相互相関）、15 テンプレートごとに yield
   - 同チーム内で同プレイヤーが重複しないよう `assignUnique` で自動選択
   - `data/screenshots/annotated/` に判定領域矩形付き確認画像を生成
5. 結果を `matchCandidates[mode]` に書き込み → 判定結果パネルに表示
6. 運営がパネルで内容を確認・手動修正 → 「確定」で `matches` に追記、「破棄」で候補をクリア
7. アノテーション画像は `nodecg.mount('/annotated-screenshots', ...)` で配信（root express にマウント）

## ファイル別役割

| ファイル | 役割 |
|---|---|
| `regions.ts` | 判定座標定義（唯一の調整ポイント） |
| `matchWeapon.ts` | ZNCC によるブキ判定 |
| `matchPlayerName.ts` | MSE スライディング窓によるプレイヤー名判定 |
| `matchStage.ts` | ZNCC によるステージ判別（上250px除外・原寸比較） |
| `processScreenshot.ts` | スクショ OCR 処理全体 |
| `annotateScreenshot.ts` | 判定領域矩形付き確認画像生成 |

## 重要な挙動メモ

- **座標定義**: [regions.ts](regions.ts) の `ROW_TOP` / `ROW_STRIDE` / `x` 等が唯一の調整ポイント。1920×1080 基準で記述し、`scaleRegion()` が実際の解像度にスケーリングする。
- **ZNCC と NCC の違い**: NCC（平均なし）は白いテンプレートへの誤ヒットが起きやすい。`matchWeapon.ts` では ZNCC（ゼロ平均正規化相互相関）を使用し、輝度バイアスを除去している。テンプレートの加重平均 `mean` はロード時に事前計算してキャッシュ済み。
- **CPU スパイク対策**: ブキ判定は 15 テンプレートごとに `setImmediate` で yield（約 12 回/ポジション）。4 ポジションは並列ではなく逐次処理でイベントループを解放している。
- **`nodecg.mount` のマウント先**: `nodecg.mount(path, handler)` は NodeCG のバンドル名前空間ではなく **root express app** に直接マウントされる。ダッシュボードから `/annotated-screenshots/...` でアクセスする（`/bundles/{name}/...` ではない）。
- **静的ファイル配信の URL デコード**: Express の `req.path` は URL エンコード済み。日本語や空白を含むファイル名は `path.basename(decodeURIComponent(req.path))` でデコードしてから使う。
- **ステージ判別**: `matchStage.ts` は `POST /stage` で受信した画像の上 250px を除いた領域（y=250〜imgHeight-1）で ZNCC 比較。テンプレートは起動時にロードしてキャッシュ（`data/stages/{mode}/stages.txt` + 同名 PNG）。1 テンプレートごとに `setImmediate` で yield（フルサイズ比較のためイベントループへの影響を最小化）。全候補のスコアを `stageScores` として MatchCandidate に保持し、Dashboard でドロップダウン選択時にスコアを表示できる。
- **`/stage` → `/weapons` の連携**: `/stage` の結果はモジュールスコープの `latestStageCandidate[mode]` に保持し、次の `/weapons` 受信時に `processScreenshot` に渡す。Replicant は不要（一時メモリで十分）。ただしステージ判別完了前に `/weapons` が届いた場合は前回値または null になるため、Dashboard で手動修正可能にしている。
- **`data/stages/` のディレクトリ名**: `turfWar` / `splatZones`（コード内の `Mode` 型と一致させること）。
