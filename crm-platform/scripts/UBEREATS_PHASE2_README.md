# UberEats Phase 2: 詳細情報取得スクリプト

## 概要
`get_uber_details.py` は、Phase 1で収集した店舗URLリストから、各店舗の「電話番号」と「詳細住所」を取得するスクリプトです。

## 前提条件

### 1. 必要なファイル
- `ubereats_list_phase1.csv` - Phase 1で収集した店舗URLリスト
  - このファイルは `scripts/` ディレクトリ内に配置してください

### 2. 必要なPythonパッケージ
以下のパッケージがインストールされている必要があります：

```bash
pip install pandas selenium webdriver-manager
```

または、`requirements.txt` からインストール：

```bash
cd /Users/a/CallSenderApp/crm-platform/scripts
pip install -r requirements.txt
```

### 3. Chromeブラウザ
SeleniumがChromeを使用するため、Chromeブラウザがインストールされている必要があります。

## 実行方法

### 基本的な実行

```bash
cd /Users/a/CallSenderApp/crm-platform/scripts
python get_uber_details.py
```

または、プロジェクトルートから：

```bash
cd /Users/a/CallSenderApp/crm-platform
python scripts/get_uber_details.py
```

### バックグラウンド実行（推奨）

長時間実行される可能性があるため、`screen` や `tmux` を使用することを推奨します：

```bash
# screenを使用する場合
screen -S ubereats-phase2
cd /Users/a/CallSenderApp/crm-platform/scripts
python get_uber_details.py
# Ctrl+A → D でセッションを切り離す
# screen -r ubereats-phase2 で再接続
```

```bash
# tmuxを使用する場合
tmux new -s ubereats-phase2
cd /Users/a/CallSenderApp/crm-platform/scripts
python get_uber_details.py
# Ctrl+B → D でセッションを切り離す
# tmux attach -t ubereats-phase2 で再接続
```

### nohupを使用する場合

```bash
cd /Users/a/CallSenderApp/crm-platform/scripts
nohup python get_uber_details.py > phase2.log 2>&1 &
```

## 機能

### 1. レジューム機能（途中再開）
- 既に `ubereats_list_phase2_final.csv` が存在する場合、処理済みのURLをスキップして続きから再開します
- 中断しても、次回実行時に続きから処理できます

### 2. 取得データ
- **電話番号**: 店舗の電話番号（日本の形式に変換）
- **詳細住所**: 都道府県名と番地を含む詳細な住所

### 3. 1件ずつ保存
- 各店舗の処理が完了するたびに、CSVファイルに追記保存されます
- 中断されても、処理済みのデータは失われません

## 出力ファイル

- **ファイル名**: `ubereats_list_phase2_final.csv`
- **場所**: `scripts/` ディレクトリ内
- **カラム**: 
  - Phase 1の全カラム
  - `詳細住所` - 取得した詳細住所
  - `電話番号` - 取得した電話番号
  - `詳細取得ステータス` - "Success" または "Failed"

## トラブルシューティング

### 入力ファイルが見つからない
```
❌ エラー: 入力ファイル ubereats_list_phase1.csv が見つかりません。
```

**解決方法**:
1. `ubereats_list_phase1.csv` が `scripts/` ディレクトリ内にあるか確認
2. または、スクリプトと同じディレクトリで実行しているか確認

### ChromeDriverのエラー
```
selenium.common.exceptions.WebDriverException: ...
```

**解決方法**:
- `webdriver-manager` が自動的にChromeDriverをダウンロードします
- インターネット接続を確認してください
- Chromeブラウザが最新版であることを確認してください

### CAPTCHAやアクセスブロック
- UberEatsがボット検知をした場合、手動でCAPTCHAを解決する必要があります
- ブラウザウィンドウが表示されるので、必要に応じて手動で操作してください

## 実行例

```bash
$ cd /Users/a/CallSenderApp/crm-platform/scripts
$ python get_uber_details.py

🚀 Phase 2: 詳細データ収集を開始します...
📂 読み込み元: /Users/a/CallSenderApp/crm-platform/scripts/ubereats_list_phase1.csv
🆕 新規作成します。
残り 100 件の処理を開始します。

[1/100] アクセス中: マクドナルド 新宿店...
   Ref: 0369036068 | Addr: 東京都新宿区...
[2/100] アクセス中: バーガーキング 渋谷店...
   Ref: 0361234567 | Addr: 東京都渋谷区...
...
```

## 注意事項

1. **実行時間**: 店舗数によっては数時間かかる可能性があります
2. **レート制限**: 各アクセス間に2〜4秒のランダムな待機時間を設けています
3. **中断**: Ctrl+Cで中断できます。次回実行時に続きから再開されます
4. **ブラウザ表示**: デバッグ用にブラウザウィンドウが表示されます（必要に応じて `--headless` オプションを有効化できます）






