# Apify連携セットアップガイド

Google Mapsリスト収集機能をApifyと連携するためのセットアップ手順です。

## 前提条件

- Apifyアカウント（[https://apify.com](https://apify.com)）
- Apify APIトークン
- 開発環境ではngrokなどのトンネリングツール（ローカル開発時）

## 手順 1: Apify APIトークンの取得

1. [Apify Console](https://console.apify.com/)にログイン
2. 右上のユーザーメニューから「Settings」を選択
3. 「Integrations」タブを開く
4. 「Personal API tokens」セクションで「Create token」をクリック
5. トークン名を入力し、トークンをコピー（後で使用します）

## 手順 2: 環境変数の設定

`.env.local`ファイルに以下の環境変数を追加してください：

```bash
# Apify API設定
APIFY_API_TOKEN=your_apify_api_token_here

# Webhook認証用のシークレット（ランダムな文字列を生成）
APIFY_WEBHOOK_SECRET=your_random_secret_string_here

# アプリケーションのルートURL
# 本番環境: https://yourdomain.com
# 開発環境（ngrok使用時）: https://xxxx.ngrok-free.app
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Webhookシークレットの生成

セキュリティのため、ランダムな文字列を生成してください：

```bash
# macOS/Linux
openssl rand -hex 32

# または Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

生成された文字列を`APIFY_WEBHOOK_SECRET`に設定してください。

## 手順 3: ローカル開発環境でのWebhook設定（ngrok使用）

ローカル開発環境（`localhost:3000`）では、ApifyからのWebhookを受信できません。
そのため、`ngrok`などのトンネリングツールを使用してローカルサーバーをインターネットに公開する必要があります。

### ngrokのインストール

```bash
# Homebrew (macOS)
brew install ngrok

# または公式サイトからダウンロード
# https://ngrok.com/download
```

### ngrokの起動

```bash
# Next.js開発サーバーが localhost:3000 で起動している状態で
ngrok http 3000
```

ngrokが起動すると、以下のようなURLが表示されます：

```
Forwarding  https://xxxx-xx-xx-xx-xx.ngrok-free.app -> http://localhost:3000
```

このURL（`https://xxxx-xx-xx-xx-xx.ngrok-free.app`）を`.env.local`の`NEXT_PUBLIC_APP_URL`に設定してください。

**注意**: ngrokの無料プランでは、URLが再起動のたびに変更されます。その場合は、`.env.local`を更新してNext.js開発サーバーを再起動してください。

## 手順 4: 動作確認

### 1. 開発サーバーの起動

```bash
npm run dev
```

### 2. Webhookエンドポイントの確認

ブラウザで以下のURLにアクセスして、エラーメッセージが表示されることを確認してください（セキュリティチェックが機能している証拠）：

```
http://localhost:3000/api/webhooks/apify
```

「Invalid secret」などのエラーメッセージが表示されれば正常です。

### 3. Server Actionのテスト

実装されたUIから、または直接Server Actionを呼び出してテストできます：

```typescript
import { startGoogleMapsScraping } from '@/lib/actions/apify';

const result = await startGoogleMapsScraping({
  keywords: ['ラーメン'],
  location: '東京都',
  maxItems: 10, // テスト時は少なめに設定
});
```

## コスト管理

⚠️ **重要**: Apifyは従量課金です。テスト時は必ず`maxItems`を**10件程度**に絞って実行し、意図せず課金が増えるのを防いでください。

### 料金目安（参考）

- `compass/crawler-google-places` Actorの料金は、Apifyの料金プランによって異なります
- 無料プラン: 月5,000 USD相当のクレジット
- 詳細は[Apify Pricing](https://apify.com/pricing)を確認してください

## トラブルシューティング

### Webhookが受信されない

1. **ngrokのURLが正しいか確認**
   - `.env.local`の`NEXT_PUBLIC_APP_URL`がngrokのURLと一致しているか確認
   - ngrokを再起動した場合は、URLが変更されている可能性があります

2. **Webhookシークレットが一致しているか確認**
   - `.env.local`の`APIFY_WEBHOOK_SECRET`と、Webhook URLのクエリパラメータが一致しているか確認

3. **ログの確認**
   - Next.js開発サーバーのコンソールログを確認
   - Apify Consoleの「Runs」ページでジョブのステータスを確認

### データが保存されない

1. **データ構造の確認**
   - Webhookエンドポイント内で`console.log(item)`を追加して、Apifyから送られてくるデータ構造を確認
   - Apify Actorの出力形式が変更されている可能性があります

2. **Prismaエラーの確認**
   - データベース接続エラーやスキーマエラーがないか確認
   - ログにエラーメッセージが表示されているか確認

### ジョブが開始されない

1. **APIトークンの確認**
   - `APIFY_API_TOKEN`が正しく設定されているか確認
   - Apify Consoleでトークンが有効か確認

2. **Actor IDの確認**
   - `compass/crawler-google-places`が存在し、アクセス可能か確認
   - Apify ConsoleでActorを検索して確認

## データ構造

### Apifyから受信するデータ（想定）

```typescript
{
  title: string;              // 店舗名
  address: string;             // 住所
  phone: string;               // 電話番号（フォーマット済み）
  phoneUnformatted: string;    // 電話番号（未フォーマット）
  categoryName: string;        // カテゴリ名
  totalScore: number;          // 評価スコア
  reviewsCount: number;        // レビュー数
  url: string;                 // Google Maps URL
  website: string;             // 公式サイトURL
  location: {
    lat: number;
    lng: number;
  };
  placeId: string;             // Google Place ID
}
```

### MasterLeadへの保存形式

```typescript
{
  companyName: string;         // item.title
  phone: string | null;        // 正規化された電話番号
  address: string | null;      // item.address
  source: 'google_maps';
  data: {
    name: string;
    address: string;
    category: string;
    rating: number;
    reviews: number;
    url: string;
    website: string;
    lat: number;
    lng: number;
    placeId: string;
    // ... その他のApifyデータ
  };
}
```

## 関連ファイル

- Webhookエンドポイント: `src/app/api/webhooks/apify/route.ts`
- Server Action: `src/lib/actions/apify.ts`
- Prismaスキーマ: `prisma/schema.prisma` (MasterLeadモデル)



