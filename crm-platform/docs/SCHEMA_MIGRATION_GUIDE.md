# スキーマ変更時のプロセス停止・再開ガイド

## 📋 概要

データベーススキーマを変更する前に、実行中のスクレイピングプロセスを安全に停止し、再開可能な状態にします。

---

## 🛑 プロセス停止手順

### 1. 進捗状況を保存

```bash
cd /Users/a/CallSenderApp/crm-platform
./scripts/save-progress.sh
```

このスクリプトは以下を実行します：
- 新規リスト収集の進捗（`logs/last-collected-page.txt`）をバックアップ
- 電話番号収集の進捗状況を確認・保存
- タイムスタンプ付きで`logs/progress/`に保存

### 2. 実行中のプロセスを停止

```bash
./scripts/stop-all-processes.sh
```

このスクリプトは以下を実行します：
- 電話番号収集プロセス（`collect-missing-phones.ts`）を停止
- 新規リスト収集プロセス（`import-new-open.ts`）を停止
- 残存プロセスがないか確認

### 3. プロセス停止の確認

```bash
ps aux | grep -E "(collect-missing-phones|import-new-open)" | grep -v grep
```

何も表示されなければ、すべてのプロセスが停止しています。

---

## 🚀 プロセス再開手順

スキーマ変更が完了したら、以下の手順でプロセスを再開します。

### 1. 再開スクリプトを実行

```bash
cd /Users/a/CallSenderApp/crm-platform
./scripts/resume-processes.sh
```

このスクリプトは以下を実行します：
- 保存された進捗状況を確認
- 新規リスト収集を前回の続きから再開
- 電話番号収集を自動的に再開（電話番号が不足しているリードから処理）

### 2. 手動で再開する場合

#### 新規リスト収集

```bash
cd /Users/a/CallSenderApp/crm-platform
npx tsx scripts/import-new-open.ts > logs/new-open-collection.log 2>&1 &
```

**注意**: このスクリプトは`logs/last-collected-page.txt`を自動的に読み込んで、前回の続きから開始します。

#### 電話番号収集

```bash
cd /Users/a/CallSenderApp/crm-platform
npx tsx scripts/collect-missing-phones.ts \
  ff424270-d1ee-4a72-9f57-984066600402 \
  7f79c785-1f85-4ec1-88bb-67aff9d119fc \
  > logs/phone-collection.log 2>&1 &
```

**注意**: このスクリプトは電話番号が不足しているリードを自動的に検出して処理します。既に電話番号があるリードはスキップされるため、安全に再実行できます。

---

## 📊 進捗状況の確認

### 新規リスト収集

```bash
# 最後に収集したページ数を確認
cat logs/last-collected-page.txt

# ログを確認
tail -f logs/new-open-collection.log
```

### 電話番号収集

```bash
# 進捗を確認
cd /Users/a/CallSenderApp/crm-platform
npx tsx -e "
import { prisma } from './src/lib/prisma';
(async () => {
  const tenantId = 'ff424270-d1ee-4a72-9f57-984066600402';
  const organizationId = '7f79c785-1f85-4ec1-88bb-67aff9d119fc';
  const allLeads = await prisma.lead.findMany({
    where: { tenantId, organizationId, source: { contains: 'tabelog.com' } },
    select: { id: true, data: true }
  });
  const withPhone = allLeads.filter(lead => {
    const data = lead.data as any;
    const phone = data?.phone || data?.電話番号;
    return phone && typeof phone === 'string' && phone.trim() !== '' && phone !== '不明の為情報お待ちしております';
  });
  console.log('総リード数:', allLeads.length, '件');
  console.log('電話番号あり:', withPhone.length, '件 (', Math.round(withPhone.length / allLeads.length * 100), '%)');
  console.log('電話番号なし:', allLeads.length - withPhone.length, '件');
  await prisma.\$disconnect();
})();
"

# ログを確認
tail -f logs/phone-collection.log
```

---

## 🔄 再開の仕組み

### 新規リスト収集（`import-new-open.ts`）

- **進捗保存**: `logs/last-collected-page.txt`に最後に収集したページ番号を保存
- **再開方法**: スクリプト起動時に`loadLastCollectedPage()`で前回のページ番号を読み込み、次のページから開始
- **安全性**: 既に登録済みのURLは重複チェックでスキップされる

### 電話番号収集（`collect-missing-phones.ts`）

- **進捗保存**: なし（データベースの状態から自動判定）
- **再開方法**: 電話番号が不足しているリードを自動的に検出して処理
- **安全性**: 既に電話番号があるリードはスキップされるため、何度でも安全に再実行可能

---

## ⚠️ 注意事項

1. **データベース接続**: スキーマ変更中はデータベースへの接続を避けてください
2. **進捗ファイル**: `logs/last-collected-page.txt`は手動で削除しないでください（削除すると最初から開始されます）
3. **ログファイル**: ログファイルは`logs/`ディレクトリに保存されます。容量に注意してください
4. **プロセス確認**: 再開後は`ps aux | grep`でプロセスが正常に動作しているか確認してください

---

## 📝 チェックリスト

スキーマ変更前：
- [ ] 進捗状況を保存（`./scripts/save-progress.sh`）
- [ ] 実行中のプロセスを停止（`./scripts/stop-all-processes.sh`）
- [ ] プロセスが停止したことを確認

スキーマ変更後：
- [ ] データベースマイグレーションを実行
- [ ] スキーマ変更が正常に適用されたことを確認
- [ ] プロセスを再開（`./scripts/resume-processes.sh`）
- [ ] プロセスが正常に動作していることを確認

---

## 🆘 トラブルシューティング

### プロセスが停止しない

```bash
# 強制終了
ps aux | grep "collect-missing-phones" | grep -v grep | awk '{print $2}' | xargs kill -9
ps aux | grep "import-new-open" | grep -v grep | awk '{print $2}' | xargs kill -9
```

### 進捗ファイルが見つからない

新規リスト収集の場合、`logs/last-collected-page.txt`が存在しない場合は最初から開始されます。問題ありません。

### 再開後にエラーが発生する

1. ログファイルを確認（`logs/new-open-collection.log`、`logs/phone-collection.log`）
2. データベース接続を確認
3. スキーマ変更が正常に適用されているか確認

