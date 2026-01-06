# Slack通知設定ガイド

## 📋 概要

店舗データ補完処理の進捗をSlackに通知する機能を実装しました。

## 🔧 設定方法

### 1. Slack Webhook URLの取得

1. [Slack API](https://api.slack.com/apps) にアクセス
2. 「Create New App」をクリック
3. 「From scratch」を選択
4. App名とワークスペースを選択
5. 「Incoming Webhooks」を有効化
6. 「Add New Webhook to Workspace」をクリック
7. 通知を送信したいチャンネルを選択
8. Webhook URLをコピー

### 2. 環境変数の設定

プロジェクトルートに`.env`ファイルを作成（または既存の`.env`ファイルを編集）し、以下を追加：

```bash
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

### 3. 設定の確認

```bash
# 設定が正しく読み込まれているか確認
source venv/bin/activate
export PYTHONPATH=.
python -c "
from app import create_app
app = create_app('local')
print('SLACK_WEBHOOK_URL:', app.config.get('SLACK_WEBHOOK_URL', '未設定'))
"
```

## 🚀 使用方法

補完処理を実行すると、自動的にSlackに通知が送信されます：

```bash
# 補完処理を実行（Slack通知付き）
python enrich_tabelog_details.py --limit 50 --delay 2.0 --max-rounds 5
```

## 📨 通知内容

以下のタイミングでSlackに通知が送信されます：

1. **処理開始時**: 処理パラメータ（件数、間隔、最大ラウンド数）
2. **各ラウンド開始時**: 残り件数、処理件数
3. **各ラウンド完了時**: 処理済み件数、更新件数、累計、残り件数、進捗率
4. **処理完了時**: 最終統計（全店舗数、補完必要件数、補完率、累計処理件数、累計更新件数）

## ⚠️ 注意事項

- `SLACK_WEBHOOK_URL`が設定されていない場合、通知は送信されませんが、処理は正常に続行されます
- Webhook URLが無効な場合、エラーメッセージが表示されますが、処理は続行されます
- 通知の送信に失敗しても、補完処理自体には影響しません

## 🔍 トラブルシューティング

### 通知が送信されない

1. `.env`ファイルに`SLACK_WEBHOOK_URL`が正しく設定されているか確認
2. Webhook URLが有効か確認（Slackアプリの設定を確認）
3. インターネット接続を確認

### エラーメッセージが表示される

- `⚠️  Slack通知エラー: ...` が表示される場合、Webhook URLが無効か、ネットワークエラーの可能性があります
- 処理自体は続行されるため、通知のみの問題であれば無視しても問題ありません



