# GitHub経由でのプロジェクト共有ガイド

## 📋 現在の状況

- **メインプロジェクト**: `/Users/a/CallSenderApp` 
  - GitHubリポジトリ: `https://github.com/infratech-maker/ZenMapCRM.git`
  - 既にGit管理下
  
- **list-toolアプリ**: `/Users/a/名称未設定フォルダ`
  - Git管理下にない（別ディレクトリ）

---

## 🚀 共有方法（2つの選択肢）

### 方法1: 既存のGitHubリポジトリに統合（推奨）

list-toolアプリケーションを既存のリポジトリに追加します。

#### 手順

1. **list-toolアプリをメインプロジェクトに移動またはコピー**
   ```bash
   # オプションA: コピー（元のファイルは残す）
   cp -r "/Users/a/名称未設定フォルダ" /Users/a/CallSenderApp/list-tool
   
   # オプションB: 移動（元のファイルを削除）
   mv "/Users/a/名称未設定フォルダ" /Users/a/CallSenderApp/list-tool
   ```

2. **.gitignoreを確認・更新**
   - `list-tool/venv/` は既に`.gitignore`で除外されている
   - `list-tool/instance/*.db` も除外されている
   - 必要に応じて追加の除外設定を追加

3. **変更をコミット**
   ```bash
   cd /Users/a/CallSenderApp
   git add list-tool/
   git commit -m "Add list-tool application"
   git push origin main
   ```

4. **別のPCでクローン**
   ```bash
   git clone https://github.com/infratech-maker/ZenMapCRM.git
   cd ZenMapCRM
   ```

---

### 方法2: list-toolを別のGitリポジトリとして管理

list-toolアプリケーションを独立したGitリポジトリとして管理します。

#### 手順

1. **list-toolディレクトリでGitを初期化**
   ```bash
   cd "/Users/a/名称未設定フォルダ"
   git init
   ```

2. **.gitignoreを作成**
   ```bash
   cat > .gitignore << EOF
   # Python
   __pycache__/
   *.py[cod]
   venv/
   env/
   *.pyc
   
   # Database
   *.db
   *.sqlite
   instance/*.db
   
   # Environment
   .env
   .env.local
   
   # Logs
   *.log
   logs/
   
   # OS
   .DS_Store
   EOF
   ```

3. **GitHubに新しいリポジトリを作成**
   - GitHubで新しいリポジトリを作成（例: `list-tool-app`）

4. **コミット＆プッシュ**
   ```bash
   git add .
   git commit -m "Initial commit: list-tool application"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/list-tool-app.git
   git push -u origin main
   ```

5. **別のPCでクローン**
   ```bash
   git clone https://github.com/YOUR_USERNAME/list-tool-app.git
   cd list-tool-app
   ```

---

## 🔧 別のPCでのセットアップ手順

### メインプロジェクト（CRM Platform）

```bash
# 1. リポジトリをクローン
git clone https://github.com/infratech-maker/ZenMapCRM.git
cd ZenMapCRM

# 2. CRM Platformのセットアップ
cd crm-platform
npm install

# 3. 環境変数を設定
cp .env.example .env.local
# .env.localを編集して必要な環境変数を設定

# 4. Docker Composeでデータベースを起動
docker-compose up -d

# 5. 開発サーバーを起動
npm run dev
```

### list-toolアプリ（方法1で統合した場合）

```bash
# 1. メインプロジェクトのクローン後
cd list-tool

# 2. Python仮想環境を作成
python3 -m venv venv
source venv/bin/activate  # macOS/Linux
# または
venv\Scripts\activate  # Windows

# 3. 依存関係をインストール
pip install -r requirements.txt

# 4. 環境変数を設定
cp .env.example .env
# .envを編集

# 5. アプリケーションを起動
python run.py
```

---

## 📝 注意事項

### コミット前に確認すべきこと

1. **機密情報を含むファイル**
   - `.env`、`.env.local` は`.gitignore`で除外されている
   - データベースファイル（`.db`）も除外されている

2. **大きなファイル**
   - `venv/`（仮想環境）は除外されている
   - `node_modules/`も除外されている

3. **個人設定ファイル**
   - `.DS_Store`、`.vscode/`などは除外されている

### 推奨される共有方法

**方法1（統合）を推奨**する理由：
- ✅ 1つのリポジトリで管理できる
- ✅ 関連プロジェクトが一緒に管理できる
- ✅ クローンが1回で済む
- ✅ バージョン管理が統一される

---

## 🔐 プライベートリポジトリの場合

現在のリポジトリがプライベートの場合：

1. **別のPCでアクセスするには**
   - GitHubアカウントでログイン
   - リポジトリへのアクセス権限が必要
   - SSH鍵またはPersonal Access Tokenを使用

2. **SSH鍵の設定（推奨）**
   ```bash
   # 別のPCで
   ssh-keygen -t ed25519 -C "your_email@example.com"
   # 公開鍵をGitHubに登録
   cat ~/.ssh/id_ed25519.pub
   # GitHub > Settings > SSH and GPG keys に追加
   
   # リモートURLをSSHに変更
   git remote set-url origin git@github.com:infratech-maker/ZenMapCRM.git
   ```

---

## 📞 トラブルシューティング

### 問題: クローンできない
- **解決策**: GitHubアカウントでログインし、リポジトリへのアクセス権限を確認

### 問題: プッシュできない
- **解決策**: 
  ```bash
  git remote -v  # リモートURLを確認
  git push origin main  # ブランチ名を確認
  ```

### 問題: 大きなファイルでエラー
- **解決策**: `.gitignore`を確認し、不要なファイルを除外

---

## ✅ 次のステップ

1. どちらの方法で共有するか決定
2. 変更をコミット＆プッシュ
3. 別のPCでクローンして動作確認

質問があればお知らせください！

