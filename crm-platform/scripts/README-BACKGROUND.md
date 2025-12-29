# バックグラウンド実行ガイド

## 方法1: screen を使う（推奨）

`screen`を使うと、セッションを切り離しても実行を継続できます。

```bash
# screenセッションを開始
screen -S scraper

# スクレイピングを実行
cd /Users/a/CallSenderApp/crm-platform
npx tsx scripts/process-pending-jobs.ts

# セッションを切り離す: Ctrl+A → D
# セッションに再接続: screen -r scraper
# セッション一覧: screen -ls
```

## 方法2: tmux を使う

`tmux`も同様に使えます。

```bash
# tmuxセッションを開始
tmux new -s scraper

# スクレイピングを実行
cd /Users/a/CallSenderApp/crm-platform
npx tsx scripts/process-pending-jobs.ts

# セッションを切り離す: Ctrl+B → D
# セッションに再接続: tmux attach -t scraper
# セッション一覧: tmux ls
```

## 方法3: nohup を使う

`nohup`を使うと、ターミナルを閉じても実行を継続できます。

```bash
cd /Users/a/CallSenderApp/crm-platform

# ログファイルに出力しながらバックグラウンド実行
nohup npx tsx scripts/process-pending-jobs.ts > scraper.log 2>&1 &

# プロセスIDを確認
echo $!

# ログを確認
tail -f scraper.log

# 停止
kill <PID>
```

## 方法4: スクリプトを使う

提供されているスクリプトを使います。

```bash
chmod +x scripts/run-scraper-background.sh
./scripts/run-scraper-background.sh
```

## 注意事項

### headless: false の場合

現在、`worker.ts`では`headless: false`に設定されているため、ブラウザウィンドウが表示されます。
バックグラウンド実行する場合：

1. **X11転送が必要**（SSH経由の場合）
   ```bash
   ssh -X user@server
   ```

2. **または headless: true に変更**
   - `worker.ts`の`headless: false`を`headless: true`に変更
   - ただし、ボット検知のリスクが高まります

3. **または screen/tmux を使用**
   - これらを使えば、ブラウザウィンドウを表示したままバックグラウンド実行できます

### ログの確認

```bash
# リアルタイムでログを確認
tail -f scraper.log

# エラーのみ確認
grep -i error scraper.log

# 住所クリーニングの結果を確認
grep "\[Address Clean\]" scraper.log
```

