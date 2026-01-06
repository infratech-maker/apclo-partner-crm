# UberEats 大量リスト収集ガイド

## 📋 概要

`get_uber_list_auto.py`を使用して、大量のエリアから店舗URLを収集する方法を説明します。

## 🚀 実行手順

### ステップ1: 郵便番号リストの準備

`get_uber_list_auto.py`の`TARGET_LOCATIONS`に収集したいエリアの郵便番号を追加します。

```python
TARGET_LOCATIONS = [
    "150-0043", # 渋谷区道玄坂
    "160-0022", # 新宿区新宿
    "106-0032", # 港区六本木
    "171-0014", # 豊島区池袋
    "104-0061", # 中央区銀座
    # 以下に追加の郵便番号を記述
    "100-0001", # 千代田区千代田
    "101-0041", # 千代田区神田神保町
    "102-0082", # 千代田区一番町
    # ... 必要に応じて追加
]
```

### ステップ2: スクロール回数の調整（オプション）

より多くの店舗を収集したい場合、`SCROLL_COUNT`を増やします。

```python
SCROLL_COUNT = 50  # デフォルト: 30 → 50に増やすとより多くの店舗を収集
```

### ステップ3: 実行方法

#### 方法1: screen を使う（推奨）

長時間実行されるため、`screen`を使用することを強く推奨します。

```bash
# screenセッションを開始
screen -S ubereats-bulk

# スクリプトを実行
cd /Users/a/CallSenderApp/crm-platform/scripts
python get_uber_list_auto.py

# セッションを切り離す: Ctrl+A → D
# セッションに再接続: screen -r ubereats-bulk
# セッション一覧: screen -ls
```

#### 方法2: tmux を使う

```bash
# tmuxセッションを開始
tmux new -s ubereats-bulk

# スクリプトを実行
cd /Users/a/CallSenderApp/crm-platform/scripts
python get_uber_list_auto.py

# セッションを切り離す: Ctrl+B → D
# セッションに再接続: tmux attach -t ubereats-bulk
```

#### 方法3: nohup を使う

```bash
cd /Users/a/CallSenderApp/crm-platform/scripts

# ログファイルに出力しながらバックグラウンド実行
nohup python get_uber_list_auto.py > bulk_collection.log 2>&1 &

# プロセスIDを確認
echo $!

# ログを確認
tail -f bulk_collection.log

# 停止
kill <PID>
```

## ⚙️ 大量収集のための最適化

### 1. エリア数の見積もり

- **1エリアあたりの処理時間**: 約5-10分
- **1エリアあたりの収集数**: 約20-100件（エリアにより異なる）
- **50エリアの場合**: 約4-8時間

### 2. スクロール回数の調整

```python
# 少ない店舗数で十分な場合
SCROLL_COUNT = 20

# より多くの店舗を収集したい場合
SCROLL_COUNT = 50  # または 100
```

### 3. エラーハンドリング

スクリプトは既に以下のエラーハンドリングを実装しています：

- **住所設定失敗**: 次のエリアへスキップ
- **キーボード中断**: 処理済みデータを保存して終了
- **重複排除**: URLの重複を自動で除外

### 4. レジューム機能

スクリプトは中断されても、次回実行時に続きから再開できます：

```python
# 既存のCSVファイルがある場合、処理済みURLをスキップ
if os.path.exists(output_path):
    # 続きから再開
```

## 📊 実行例

### 小規模（5-10エリア）

```bash
# 設定: TARGET_LOCATIONS = [5-10個の郵便番号]
# 実行時間: 約30分-1時間
# 予想収集数: 100-500件

screen -S ubereats-small
cd /Users/a/CallSenderApp/crm-platform/scripts
python get_uber_list_auto.py
```

### 中規模（20-50エリア）

```bash
# 設定: TARGET_LOCATIONS = [20-50個の郵便番号]
# 実行時間: 約2-8時間
# 予想収集数: 500-2500件

screen -S ubereats-medium
cd /Users/a/CallSenderApp/crm-platform/scripts
python get_uber_list_auto.py
```

### 大規模（100エリア以上）

```bash
# 設定: TARGET_LOCATIONS = [100個以上の郵便番号]
# 実行時間: 約8-16時間（一晩実行推奨）
# 予想収集数: 2000-10000件

# 夜間に実行する場合
screen -S ubereats-large
cd /Users/a/CallSenderApp/crm-platform/scripts
python get_uber_list_auto.py
# セッションを切り離して、翌朝確認
```

## 🔍 進行状況の確認

### リアルタイムで確認

```bash
# screen/tmuxセッションに再接続
screen -r ubereats-bulk
# または
tmux attach -t ubereats-bulk
```

### CSVファイルの確認

```bash
# 収集されたURL数を確認
wc -l /Users/a/CallSenderApp/crm-platform/scripts/ubereats_list_auto_collected.csv

# 最新の10件を確認
tail -10 /Users/a/CallSenderApp/crm-platform/scripts/ubereats_list_auto_collected.csv
```

### ログファイルの確認（nohup使用時）

```bash
tail -f /Users/a/CallSenderApp/crm-platform/scripts/bulk_collection.log
```

## ⚠️ 注意事項

### 1. ボット検知対策

- 各エリア処理前にCookieを削除（実装済み）
- ランダムな待機時間（実装済み）
- ブラウザウィンドウを表示（`headless: false`）

### 2. CAPTCHA対応

CAPTCHAが表示された場合：
- ブラウザウィンドウで手動で解決
- 解決後、スクリプトは自動で続行

### 3. リソース管理

- **メモリ**: 長時間実行時はメモリ使用量に注意
- **ディスク**: CSVファイルが大きくなる可能性（1万件で約数MB）
- **ネットワーク**: 安定したインターネット接続が必要

### 4. 実行時間

- エリア数が多い場合、一晩実行することを推奨
- `screen`や`tmux`を使用して、ターミナルを閉じても実行を継続

## 📝 次のステップ

リスト収集が完了したら：

1. **CSVファイルの確認**
   ```bash
   head -20 /Users/a/CallSenderApp/crm-platform/scripts/ubereats_list_auto_collected.csv
   ```

2. **データベースへの登録**（手動または別スクリプト）
   - CSVのURLを`scraping_jobs`テーブルに登録

3. **詳細情報の取得**
   ```bash
   npx tsx scripts/process-pending-jobs.ts
   ```

## 🛠️ トラブルシューティング

### エラー: "入力ファイルが見つかりません"
- スクリプトを`scripts/`ディレクトリから実行しているか確認

### エラー: "ChromeDriverが見つかりません"
- `webdriver-manager`が自動でダウンロードします
- インターネット接続を確認してください

### 処理が途中で止まった
- `screen`や`tmux`で再接続して状況を確認
- CSVファイルが保存されているか確認
- 次回実行時に続きから再開されます



