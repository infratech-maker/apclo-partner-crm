# ngrok経由でのアクセス方法

## 概要

ngrokを使用して、ローカルサーバーをインターネット経由でアクセス可能にします。

## 起動方法

### 方法1: Pythonスクリプトを使用（推奨）

```bash
source venv/bin/activate
export PYTHONPATH=.
python run_with_ngrok.py
```

### 方法2: シェルスクリプトを使用

```bash
./start_server_with_ngrok.sh
```

## アクセスURL

起動後、以下のような出力が表示されます：

```
==================================================
サーバー情報
==================================================
ローカル: http://localhost:8000
ngrok:   https://xxxx-xx-xx-xx-xx.ngrok-free.app
barius:  https://xxxx-xx-xx-xx-xx.ngrok-free.app/barius.html
ngrok管理画面: http://localhost:4040
```

**ngrokのURL**（例: `https://xxxx-xx-xx-xx-xx.ngrok-free.app`）を使用して、インターネット経由でアクセスできます。

## 注意事項

1. **ngrokの無料プラン**: 無料プランでは、URLが起動のたびに変わります
2. **ngrok認証**: 初回起動時にngrokの認証が必要な場合があります
   - 認証トークンは https://dashboard.ngrok.com/get-started/your-authtoken で取得できます
   - 認証: `ngrok config add-authtoken YOUR_TOKEN`
3. **停止方法**: `Ctrl+C` でサーバーとngrokの両方を停止します

## トラブルシューティング

### ngrokが起動しない場合

1. ngrokがインストールされているか確認:
   ```bash
   which ngrok
   ```

2. ngrokがインストールされていない場合:
   ```bash
   # macOS
   brew install ngrok/ngrok/ngrok
   
   # または公式サイトからダウンロード
   # https://ngrok.com/download
   ```

### URLが取得できない場合

ngrok管理画面（http://localhost:4040）にアクセスして、トンネル情報を確認してください。

### ポート8000が既に使用されている場合

`run_with_ngrok.py` の `start_ngrok(8000)` の部分を別のポートに変更してください。



