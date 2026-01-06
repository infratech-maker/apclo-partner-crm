# UberEats リスト収集ツール (Phase 1)

UberEatsのサイトから店舗リストを収集するPythonスクリプトです。

## 前提条件

- Python 3.8以上がインストールされていること
- Chromeブラウザがインストールされていること

## セットアップ

### 1. 仮想環境の作成とライブラリのインストール

```bash
cd /Users/a/CallSenderApp/crm-platform/scripts

# 仮想環境を作成（初回のみ）
python3 -m venv venv

# 仮想環境をアクティベート
source venv/bin/activate

# 必要なライブラリをインストール（初回のみ）
pip install pandas selenium webdriver-manager
```

### 2. スクリプトの実行

```bash
# 仮想環境がアクティベートされていることを確認
# （プロンプトに (venv) が表示されているはずです）

# スクリプトを実行
python get_uber_list.py
```

## 使い方

1. スクリプトを実行すると、Chromeブラウザが自動で立ち上がります
2. ブラウザ上で以下を行ってください：
   - 「お届け先の住所」を入力・決定
   - 収集したいカテゴリ（例: 全て、和食、タピオカなど）をクリックしてリストを表示
3. 準備ができたら、ターミナルに戻り `Enterキー` を押してください
4. 自動でスクロールが開始され、店舗URLが収集されます
5. 完了後、`ubereats_list_phase1.csv` ファイルが生成されます

## 設定のカスタマイズ

`get_uber_list.py` ファイル内の以下の変数を変更できます：

- `OUTPUT_FILE`: 保存するCSVファイル名（デフォルト: `ubereats_list_phase1.csv`）
- `SCROLL_COUNT`: スクロール回数（デフォルト: 30回。多いほど多くの店舗を取得できます）

## 出力ファイル

- `ubereats_list_phase1.csv`: 収集した店舗データ（店舗名、URL、元データ）

## 次のステップ（Phase 2）

Phase 1で生成されたCSVファイルを読み込み、各店舗の詳細ページから電話番号や正確な住所を取得するPhase 2のスクリプトを作成予定です。

## トラブルシューティング

### ChromeDriverのエラーが出る場合

`webdriver-manager`が自動でChromeDriverをダウンロードしますが、Chromeブラウザのバージョンと合わない場合は、Chromeブラウザを最新版に更新してください。

### 店舗データが取得できない場合

- 住所入力が完了しているか確認してください
- カテゴリを選択してリストが表示されているか確認してください
- `SCROLL_COUNT`を増やして再実行してください



