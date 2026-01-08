# ログイン問題の修正

## 問題の原因

1. **ngrokエンドポイントがオフライン**: サーバーが起動していないため、`https://alica-perfumeless-ilse.ngrok-free.dev` にアクセスできませんでした。
2. **ログインAPIが未実装**: ログイン機能がクライアント側の`sessionStorage`のみで、サーバー側の認証がありませんでした。

## 実施した修正

### 1. ログインAPIエンドポイントの追加 (`/api/login`)

- パートナーIDとパスワードによる認証を実装
- データベースの`users`テーブルからユーザーを検索
- パスワードハッシュの検証
- ユーザーの有効性チェック
- 最終ログイン日時の更新

### 2. ログインページの更新 (`login.html`)

- APIエンドポイントを呼び出すように変更
- エラーメッセージの表示機能を追加
- ローディング状態の表示

## サーバーの起動方法

### 方法1: ngrok経由で起動（推奨）

```bash
cd /Users/a/CallSenderApp/list-tool
source venv/bin/activate
export PYTHONPATH=.
python run_with_ngrok.py
```

または

```bash
cd /Users/a/CallSenderApp/list-tool
./start_server_with_ngrok.sh
```

### 方法2: ローカルのみで起動

```bash
cd /Users/a/CallSenderApp/list-tool
source venv/bin/activate
export PYTHONPATH=.
python run.py
```

## 注意事項

1. **ngrok URLの変更**: ngrokの無料プランでは、起動のたびにURLが変わります。新しいURLを確認してください。
2. **ユーザーアカウント**: ログインするには、データベースにユーザーアカウントが作成されている必要があります。
   - 管理者ダッシュボード (`/admin-dashboard`) からユーザーを作成できます
   - または、`/api/admin/users` APIエンドポイントを使用してユーザーを作成できます

## テスト方法

1. サーバーを起動
2. ブラウザでログインページにアクセス: `https://[ngrok-url]/login`
3. パートナーIDとパスワードを入力
4. ログインボタンをクリック
5. 成功すれば `/list-tool` にリダイレクトされます

## トラブルシューティング

### サーバーが起動しない場合

- 仮想環境がアクティブになっているか確認: `source venv/bin/activate`
- ポート8000が使用中でないか確認: `lsof -i :8000`
- Pythonの依存関係がインストールされているか確認: `pip install -r requirements.txt` (存在する場合)

### ログインできない場合

- データベースにユーザーアカウントが存在するか確認
- ブラウザのコンソールでエラーメッセージを確認
- サーバーのログでエラーを確認

### ngrokが起動しない場合

- ngrokがインストールされているか確認: `which ngrok`
- ngrokの認証トークンが設定されているか確認: `ngrok config check`
- ngrok管理画面で確認: `http://localhost:4040`
