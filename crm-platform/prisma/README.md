# Prisma セットアップガイド

このディレクトリには、Prismaスキーマとシードスクリプトが含まれています。

## セットアップ手順

### 1. 依存関係のインストール

```bash
npm install
```

これにより、以下のパッケージがインストールされます：
- `@prisma/client`: Prisma Client
- `prisma`: Prisma CLI
- `bcryptjs`: パスワードハッシュ化
- `@types/bcryptjs`: TypeScript型定義

### 2. データベースマイグレーション

Prismaスキーマをデータベースに反映します：

```bash
npx prisma migrate dev --name init_multitenant_rbac
```

**注意**: 既存のデータがある場合、このコマンドでデータがリセットされる可能性があります。開発環境であれば問題ありませんが、重要なデータがある場合はバックアップを取ってください。

### 3. Prisma Clientの生成

マイグレーション後、Prisma Clientを生成します：

```bash
npx prisma generate
```

### 4. シードデータの投入

初期データ（テナント、ユーザー、ロール、権限など）を投入します：

```bash
npx prisma db seed
```

または、直接実行：

```bash
tsx prisma/seed.ts
```

## シードデータの内容

### テナント
- **ZenMao Inc.** (slug: `zenmao`)
- **Demo Partner Corp.** (slug: `demo-partner`)

### ロール
- **Super Admin**: 全ての権限を持つ
- **Org Admin**: 組織管理に必要な権限を持つ
- **User**: 基本的な閲覧・作成権限のみ

### 組織階層
- **ZenMao配下**:
  - 本社 (ZENMAO-HQ)
    - 営業部 (ZENMAO-SALES)
    - マーケティング部 (ZENMAO-MARKETING)
- **Partner配下**:
  - 支店A (PARTNER-BRANCH-A)

### ユーザー
- **Master Admin** (ZenMao)
  - Email: `admin@zenmao.com`
  - Password: `password123`
  - ロール: Super Admin
  - 所属: 本社（主所属）
- **Partner Admin** (Partner)
  - Email: `admin@partner.com`
  - Password: `password123`
  - ロール: Super Admin
  - 所属: 支店A（主所属）
- **General User** (ZenMao)
  - Email: `user@zenmao.com`
  - Password: `password123`
  - ロール: User
  - 所属: 営業部（主所属）
  - 上長: Master Admin

## 権限の構造

各リソース（Lead, Customer, User, Deal, Organization, Product, KpiRecord, PlRecord, Simulation, ScrapingJob）に対して、以下のアクション権限が作成されます：

- `read`: 閲覧権限
- `create`: 作成権限
- `update`: 更新権限
- `delete`: 削除権限

### ロール別の権限

- **Super Admin**: 全てのリソースに対して全てのアクション権限
- **Org Admin**: 組織管理に必要な権限（Organization, User, Customer, Dealのread/create/update）
- **User**: 基本的な閲覧・作成権限（Lead, Customer, Dealのread/create）

## トラブルシューティング

### エラー: "Prisma schema validation"

Prismaスキーマに構文エラーがある可能性があります。以下を実行して確認：

```bash
npx prisma format
```

### エラー: "DATABASE_URL is not set"

`.env`または`.env.local`ファイルに`DATABASE_URL`を設定してください：

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/crm_platform"
```

### エラー: "bcryptjs is not installed"

依存関係を再インストール：

```bash
npm install
```

### シードが重複エラーになる

シードスクリプトは`upsert`を使用しているため、何度実行してもエラーになりません。既存のデータは更新されます。

## 次のステップ

シードデータの投入が完了したら、以下のコマンドでPrisma Studioを起動してデータを確認できます：

```bash
npx prisma studio
```

ブラウザで http://localhost:5555 が開き、データベースの内容を確認できます。

