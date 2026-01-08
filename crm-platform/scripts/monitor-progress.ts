import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

// .env.local から環境変数を読み込み
dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  // ここで throw しても良いが、ログに出して終了させる
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL または SUPABASE_SERVICE_ROLE_KEY が設定されていません。");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function monitorProgress() {
  console.log("🕵️‍♂️ DBの更新状況を診断します...");

  // 1. 直近10分間の新規作成数を確認
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  const {
    count: newCount,
    error: countError,
  } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .gt("created_at", tenMinutesAgo);

  // 2. 直近10分間の更新数（電話番号補完など）を確認
  const { count: updatedCount, error: updatedError } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .gt("updated_at", tenMinutesAgo);

  // 3. 最新のレコード情報を取得（今どこを処理しているか推測）
  const { data: latestLeads, error: latestError } = await supabase
    .from("leads")
    .select("name, created_at, source")
    .order("created_at", { ascending: false })
    .limit(3);

  console.log("------------------------------------------------");

  if (countError) {
    console.error("❌ DB接続エラー (新規件数取得):", countError.message);
  } else if (updatedError) {
    console.error("❌ DB接続エラー (更新件数取得):", updatedError.message);
  } else {
    console.log(`⏱ 直近10分間の新規追加数 (INSERT): ${newCount ?? 0} 件`);
    console.log(`🔄 直近10分間の更新数 (UPDATE):     ${updatedCount ?? 0} 件`);

    if ((newCount ?? 0) === 0 && (updatedCount ?? 0) === 0) {
      console.log("\n⚠️ 注意: 直近10分間、DBへの書き込みは発生していません。");
      console.log("   可能性1: 既存の取得範囲（例: 1〜20ページ）を重複チェック中（INSERT/UPDATEが発生しない）。");
      console.log("   可能性2: IPブロックやセレクタ変更によるエラー（メインのスクレイピングログを確認してください）。");
    } else if ((newCount ?? 0) === 0 && (updatedCount ?? 0) > 0) {
      console.log("\nℹ️ 新規追加はありませんが、詳細情報の補完(UPDATE)は進んでいます。");
    } else {
      console.log("\n✅ データは正常に追加・更新されています。UIの反映遅延やキャッシュの可能性があります。");
    }
  }

  console.log("\n📝 【最新の保存データ】");
  if (latestError) {
    console.error("❌ 最新レコード取得エラー:", latestError.message);
  } else {
    latestLeads?.forEach((l) => {
      const createdAt = l.created_at
        ? new Date(l.created_at as string).toLocaleTimeString()
        : "N/A";
      console.log(`   - ${l.name} (${createdAt}) - ${l.source}`);
    });
  }

  console.log("------------------------------------------------");
}

monitorProgress()
  .then(() => {
    process.exit(0);
  })
  .catch((e) => {
    console.error("❌ monitor-progress 実行中にエラーが発生しました:", e);
    process.exit(1);
  });









