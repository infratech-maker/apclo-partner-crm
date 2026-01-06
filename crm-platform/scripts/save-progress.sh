#!/bin/bash
# 現在の進捗状況を保存するスクリプト

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROGRESS_DIR="$PROJECT_DIR/logs/progress"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

mkdir -p "$PROGRESS_DIR"

echo "💾 進捗状況を保存します..."
echo "   保存先: $PROGRESS_DIR"
echo ""

# 新規リスト収集の進捗を保存
if [ -f "$PROJECT_DIR/logs/last-collected-page.txt" ]; then
  cp "$PROJECT_DIR/logs/last-collected-page.txt" "$PROGRESS_DIR/last-collected-page_$TIMESTAMP.txt"
  LAST_PAGE=$(cat "$PROJECT_DIR/logs/last-collected-page.txt")
  echo "📋 新規リスト収集: ページ $LAST_PAGE まで完了"
else
  echo "📋 新規リスト収集: 進捗ファイルが見つかりません（最初から開始）"
fi

# 電話番号収集の進捗を確認
echo ""
echo "📞 電話番号収集の進捗を確認中..."
cd "$PROJECT_DIR"
npx tsx -e "
import { prisma } from './src/lib/prisma';
(async () => {
  const tenantId = 'ff424270-d1ee-4a72-9f57-984066600402';
  const organizationId = '7f79c785-1f85-4ec1-88bb-67aff9d119fc';
  
  const allLeads = await prisma.lead.count({
    where: {
      tenantId,
      organizationId,
      source: { contains: 'tabelog.com' }
    }
  });
  
  const withPhone = await prisma.lead.findMany({
    where: {
      tenantId,
      organizationId,
      source: { contains: 'tabelog.com' }
    },
    select: { id: true, data: true }
  });
  
  const withPhoneCount = withPhone.filter(lead => {
    const data = lead.data as any;
    const phone = data?.phone || data?.電話番号;
    return phone && typeof phone === 'string' && phone.trim() !== '' && phone !== '不明の為情報お待ちしております';
  }).length;
  
  const withoutPhoneCount = allLeads - withPhoneCount;
  
  console.log(\`   総リード数: \${allLeads}件\`);
  console.log(\`   電話番号あり: \${withPhoneCount}件 (\${Math.round(withPhoneCount / allLeads * 100)}%)\`);
  console.log(\`   電話番号なし: \${withoutPhoneCount}件 (\${Math.round(withoutPhoneCount / allLeads * 100)}%)\`);
  
  // 最後に更新されたリードの情報を保存
  const lastUpdated = await prisma.lead.findFirst({
    where: {
      tenantId,
      organizationId,
      source: { contains: 'tabelog.com' }
    },
    select: { id: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' }
  });
  
  if (lastUpdated) {
    console.log(\`   最後の更新: \${lastUpdated.updatedAt}\`);
  }
  
  await prisma.\$disconnect();
})();
" > "$PROGRESS_DIR/phone-collection-progress_$TIMESTAMP.txt" 2>&1

cat "$PROGRESS_DIR/phone-collection-progress_$TIMESTAMP.txt"

echo ""
echo "✅ 進捗状況を保存しました:"
echo "   - 新規リスト収集: $PROGRESS_DIR/last-collected-page_$TIMESTAMP.txt"
echo "   - 電話番号収集: $PROGRESS_DIR/phone-collection-progress_$TIMESTAMP.txt"

