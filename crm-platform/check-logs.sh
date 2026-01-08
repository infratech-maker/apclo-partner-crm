#!/bin/bash
# 開発サーバーのログを確認するスクリプト

echo "=== 開発サーバーのプロセス確認 ==="
ps aux | grep -i "next dev" | grep -v grep

echo ""
echo "=== 最近のログファイルを確認 ==="
find .next -name "*.log" -type f 2>/dev/null | head -5

echo ""
echo "=== エラーログを確認 ==="
# 開発サーバーのログを直接確認する方法
echo "開発サーバーを実行しているターミナルで以下のログを探してください："
echo "- 'getDashboardMetrics:' で始まるログ"
echo "- 'API route:' で始まるログ"
echo "- 'error:' または 'Error:' を含むログ"






