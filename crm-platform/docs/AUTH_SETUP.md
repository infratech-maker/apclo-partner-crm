# 認証機能セットアップガイド

## 概要

NextAuth.jsを使用した認証機能が実装されています。Email/Passwordによるログインが可能です。

## 実装内容

### 1. 認証設定 (`src/lib/auth.ts`)

- **Credentials Provider**: Email/Passwordによる認証
- **セッション管理**: JWT戦略を使用
- **セッション情報の拡張**:
  - `id`: ユーザーID
  - `tenantId`: テナントID
  - `organizationId`: 主所属組織ID
  - `role`: ロール名
  - `permissions`: 権限の配列（例: `["Customer:read", "Customer:create"]`）

### 2. API Route (`src/app/api/auth/[...nextauth]/route.ts`)

NextAuth.jsのAPIエンドポイントを提供します。

### 3. 型定義 (`src/types/next-auth.d.ts`)

セッションとJWTトークンの型定義を拡張しています。

### 4. ログイン画面 (`src/app/login/page.tsx`)

Tailwind CSSとShadcn UIを使用したモダンなログインフォーム。

## 環境変数

`.env.local`に以下の環境変数を設定してください：

```env
# NextAuth.js
NEXTAUTH_SECRET=your-secret-key-here
NEXTAUTH_URL=http://localhost:3000
```

**NEXTAUTH_SECRETの生成方法**:

```bash
openssl rand -base64 32
```

## 使用方法

### ログイン

1. `/login`にアクセス
2. EmailとPasswordを入力
3. ログインボタンをクリック

### セッション情報の取得

```typescript
import { auth } from "@/lib/auth";
import { getServerSession } from "next-auth";

// Server Component / Server Action
const session = await auth();

// または
const session = await getServerSession(authOptions);

// セッション情報にアクセス
console.log(session?.user.id);
console.log(session?.user.tenantId);
console.log(session?.user.organizationId);
console.log(session?.user.role);
console.log(session?.user.permissions);
```

### クライアント側での使用

```typescript
"use client";

import { useSession } from "next-auth/react";

export default function MyComponent() {
  const { data: session, status } = useSession();

  if (status === "loading") return <p>Loading...</p>;
  if (status === "unauthenticated") return <p>Not logged in</p>;

  return (
    <div>
      <p>User ID: {session?.user.id}</p>
      <p>Tenant ID: {session?.user.tenantId}</p>
      <p>Role: {session?.user.role}</p>
      <p>Permissions: {session?.user.permissions.join(", ")}</p>
    </div>
  );
}
```

### ログアウト

```typescript
"use client";

import { signOut } from "next-auth/react";

export default function LogoutButton() {
  return (
    <button onClick={() => signOut({ callbackUrl: "/login" })}>
      Logout
    </button>
  );
}
```

## セキュリティ機能

### 1. パスワード検証

- `bcryptjs`を使用してパスワードをハッシュ化
- ログイン時に`bcrypt.compare`で検証

### 2. ユーザー状態チェック

- `isActive: false`のユーザーはログイン不可

### 3. ロールと権限

- ユーザーに割り当てられたロールから権限を取得
- 有効期限切れのロールは除外

## テストアカウント

シードデータから以下のアカウントでログインできます：

- **Master Admin**: `admin@zenmao.com` / `password123`
- **Partner Admin**: `admin@partner.com` / `password123`
- **General User**: `user@zenmao.com` / `password123`

## トラブルシューティング

### エラー: "Invalid email or password"

- EmailとPasswordが正しいか確認
- ユーザーが`isActive: true`か確認
- データベースにユーザーが存在するか確認

### エラー: "NEXTAUTH_SECRET is not set"

`.env.local`に`NEXTAUTH_SECRET`を設定してください。

### エラー: "User account is inactive"

ユーザーの`isActive`フラグが`false`になっています。データベースで確認してください。

## 次のステップ

1. **認証ミドルウェア**: 保護されたルートの実装
2. **権限チェック**: ページやAPI Routeでの権限チェック
3. **パスワードリセット**: パスワードリセット機能の実装
4. **2FA**: 二要素認証の実装

