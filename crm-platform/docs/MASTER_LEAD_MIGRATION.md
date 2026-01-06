# MasterLead移行完了レポート

移行日時: 2026-01-06

## ✅ 移行完了

すべてのリードデータが`MasterLead`に正常に紐付けられました。

## 📊 移行結果

| 項目 | 件数 |
|------|------|
| 総Lead数 | 7,298件 |
| 紐付け済みLead | 7,298件 (100%) |
| MasterLead数 | 6,932件 |
| 名寄せ率 | 約5% (7,298件 → 6,932件) |

## 🔄 名寄せロジック

### 重複判定基準
- **優先**: 電話番号による名寄せ
  - 電話番号が一致するリードは同じ`MasterLead`に紐付け
  - 電話番号の正規化（空白削除、ハイフン統一）を実施

### データ統合
- 既存の`MasterLead`がある場合、より詳細な情報で更新
- 店舗名、住所など、より長い文字列のデータを優先

## 📋 スキーマ変更内容

### 1. MasterLeadモデルの追加

```prisma
model MasterLead {
  id          String   @id @default(cuid())
  companyName String   // 検索用
  phone       String?  // 重複チェック用
  address     String?
  source      String   // "tabelog.com" 等
  data        Json     // 詳細データ（leads.dataと同じ構造）
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  leads       Lead[]

  @@index([companyName])
  @@index([phone])
  @@map("master_leads")
}
```

### 2. Leadモデルの変更

```prisma
model Lead {
  // ...既存のカラム...

  // Master Lead relation (必須)
  masterLeadId String
  masterLead   MasterLead @relation(fields: [masterLeadId], references: [id], onDelete: Cascade)

  // 制約追加
  @@unique([masterLeadId, tenantId])
}
```

## 🔍 データ構造

### MasterLead
- **目的**: 重複リードの統合（名寄せ）
- **キー**: 電話番号（優先）、店舗名
- **データ**: `leads.data`と同じ構造のJSONB

### Lead → MasterLead リレーション
- **1対多**: 1つの`MasterLead`に複数の`Lead`が紐付け可能
- **制約**: 同じテナント内で同じ`MasterLead`を重複登録できない（`@@unique([masterLeadId, tenantId])`）

## 🚀 今後の使用方法

### 新規リード登録時

```typescript
// 1. MasterLeadを検索または作成
let masterLead = await prisma.masterLead.findFirst({
  where: { phone: normalizedPhone }
});

if (!masterLead) {
  masterLead = await prisma.masterLead.create({
    data: {
      companyName: name,
      phone: normalizedPhone,
      address: address,
      source: source,
      data: leadData,
    }
  });
}

// 2. Leadを作成（MasterLeadに紐付け）
const lead = await prisma.lead.create({
  data: {
    tenantId: tenantId,
    organizationId: organizationId,
    source: source,
    data: leadData,
    masterLeadId: masterLead.id, // 必須
    // ...
  }
});
```

### 名寄せ検索

```typescript
// 電話番号でMasterLeadを検索
const masterLead = await prisma.masterLead.findFirst({
  where: { phone: phoneNumber },
  include: {
    leads: {
      where: { tenantId: tenantId },
      include: { organization: true }
    }
  }
});
```

## ⚠️ 注意事項

1. **必須フィールド**: `masterLeadId`は必須フィールドになりました。新規リード作成時は必ず`MasterLead`を作成または取得してから`Lead`を作成してください。

2. **削除動作**: `MasterLead`を削除すると、関連するすべての`Lead`が削除されます（`onDelete: Cascade`）。

3. **一意制約**: 同じテナント内で同じ`MasterLead`を重複登録することはできません（`@@unique([masterLeadId, tenantId])`）。

4. **名寄せ**: 電話番号による名寄せが自動的に行われます。電話番号がないリードは、店舗名で個別の`MasterLead`が作成されます。

## 📝 移行スクリプト

移行スクリプトは`scripts/migrate-to-master.ts`に保存されています。必要に応じて再実行できます（未紐付けのリードがある場合のみ処理されます）。

