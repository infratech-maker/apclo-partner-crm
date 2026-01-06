# GitHubプッシュ手順

## ✅ 完了した作業

1. ✅ list-toolアプリを`/Users/a/CallSenderApp/list-tool`にコピー
2. ✅ `.gitignore`を作成（venv、データベース、.envなどを除外）
3. ✅ 大きな画像ファイルを除外
4. ✅ コミット完了（コミットID: `be0bca2`）

## 📤 GitHubへのプッシュ方法

現在、ローカルに1つのコミットが残っています。以下のいずれかの方法でプッシュしてください：

### 方法1: 通常のプッシュ（推奨）

```bash
cd /Users/a/CallSenderApp
git push origin main
```

### 方法2: 認証が必要な場合

GitHubの認証情報を入力する必要がある場合：

```bash
# Personal Access Tokenを使用
git push https://YOUR_TOKEN@github.com/infratech-maker/ZenMapCRM.git main

# またはSSHを使用
git remote set-url origin git@github.com:infratech-maker/ZenMapCRM.git
git push origin main
```

### 方法3: 段階的にプッシュ

大きなファイルが原因の場合、段階的にプッシュ：

```bash
# まず、小さなファイルだけをプッシュ
git push origin main --verbose
```

## 🔍 トラブルシューティング

### エラー: "HTTP 400"
- GitHubの認証情報を確認
- Personal Access Tokenが必要な場合があります
- GitHub Settings > Developer settings > Personal access tokens でトークンを作成

### エラー: "large file"
- 大きなファイルが含まれている場合、Git LFSを使用：
  ```bash
  git lfs install
  git lfs track "*.jpg"
  git lfs track "*.png"
  git add .gitattributes
  git commit -m "Add Git LFS tracking"
  git push origin main
  ```

## 📋 別のPCでの取得方法

プッシュが完了したら、別のPCで以下を実行：

```bash
# リポジトリをクローン
git clone https://github.com/infratech-maker/ZenMapCRM.git
cd ZenMapCRM

# list-toolアプリのセットアップ
cd list-tool
python3 -m venv venv
source venv/bin/activate  # macOS/Linux
pip install -r requirements.txt
cp .env.example .env  # 必要に応じて編集
python run.py
```

## ✅ 確認方法

プッシュが成功したか確認：

```bash
git log origin/main..HEAD
# 何も表示されなければ、プッシュ成功
```

または、GitHubのWebサイトで確認：
https://github.com/infratech-maker/ZenMapCRM

