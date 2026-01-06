#!/usr/bin/env python3
"""古いデータベースから新しいデータベースにデータをインポートするスクリプト"""
import sqlite3
import sys
import os
from pathlib import Path

# パス設定
OLD_DB_PATH = Path.home() / "Desktop" / "名称未設定フォルダ" / "out" / "restaurants.db"
NEW_DB_PATH = Path(__file__).parent / "instance" / "restaurants_local.db"

def import_stores():
    """店舗データをインポート"""
    print("=" * 60)
    print("データインポート開始")
    print("=" * 60)
    
    if not OLD_DB_PATH.exists():
        print(f"❌ 古いデータベースが見つかりません: {OLD_DB_PATH}")
        return False
    
    if not NEW_DB_PATH.exists():
        print(f"❌ 新しいデータベースが見つかりません: {NEW_DB_PATH}")
        return False
    
    # バックアップを作成
    backup_path = NEW_DB_PATH.with_suffix('.db.backup')
    print(f"📦 バックアップを作成中: {backup_path}")
    import shutil
    shutil.copy2(NEW_DB_PATH, backup_path)
    print("✅ バックアップ完了")
    
    # 古いデータベースに接続
    old_conn = sqlite3.connect(str(OLD_DB_PATH))
    old_cursor = old_conn.cursor()
    
    # 新しいデータベースに接続
    new_conn = sqlite3.connect(str(NEW_DB_PATH))
    new_cursor = new_conn.cursor()
    
    try:
        # 古いデータベースから店舗データを取得
        print("\n📊 古いデータベースからデータを読み込み中...")
        old_cursor.execute("SELECT COUNT(*) FROM stores")
        old_count = old_cursor.fetchone()[0]
        print(f"   古いデータベースの店舗数: {old_count:,}件")
        
        # 新しいデータベースの現在の件数を確認
        new_cursor.execute("SELECT COUNT(*) FROM stores")
        new_count = new_cursor.fetchone()[0]
        print(f"   新しいデータベースの現在の店舗数: {new_count:,}件")
        
        if old_count == 0:
            print("⚠️  古いデータベースにデータがありません")
            return False
        
        # 古いデータベースのカラムを確認
        old_cursor.execute("PRAGMA table_info(stores)")
        old_columns = {row[1]: row[0] for row in old_cursor.fetchall()}
        print(f"\n📋 古いデータベースのカラム: {', '.join(old_columns.keys())}")
        
        # 新しいデータベースのカラムを確認
        new_cursor.execute("PRAGMA table_info(stores)")
        new_columns = {row[1]: row[0] for row in new_cursor.fetchall()}
        print(f"📋 新しいデータベースのカラム: {', '.join(new_columns.keys())}")
        
        # 共通カラムを取得
        common_columns = set(old_columns.keys()) & set(new_columns.keys())
        print(f"\n✅ 共通カラム: {', '.join(sorted(common_columns))}")
        
        # データを取得（共通カラムのみ）
        columns_str = ', '.join(sorted(common_columns))
        old_cursor.execute(f"SELECT {columns_str} FROM stores")
        
        # データを挿入
        print(f"\n📥 データをインポート中...")
        inserted = 0
        skipped = 0
        
        for row in old_cursor.fetchall():
            try:
                # カラム名と値のマッピング
                values = dict(zip(sorted(common_columns), row))
                
                # INSERT文を構築
                placeholders = ', '.join(['?' for _ in common_columns])
                insert_sql = f"""
                    INSERT OR REPLACE INTO stores ({columns_str})
                    VALUES ({placeholders})
                """
                
                # 値の順序を整える
                ordered_values = [values[col] for col in sorted(common_columns)]
                
                new_cursor.execute(insert_sql, ordered_values)
                inserted += 1
                
                if inserted % 1000 == 0:
                    print(f"   進捗: {inserted:,}件 / {old_count:,}件")
                    new_conn.commit()
                    
            except Exception as e:
                skipped += 1
                if skipped <= 5:  # 最初の5件のエラーのみ表示
                    print(f"   ⚠️  スキップ: {e}")
        
        # コミット
        new_conn.commit()
        
        print(f"\n✅ インポート完了!")
        print(f"   インポート成功: {inserted:,}件")
        if skipped > 0:
            print(f"   スキップ: {skipped:,}件")
        
        # 最終確認
        new_cursor.execute("SELECT COUNT(*) FROM stores")
        final_count = new_cursor.fetchone()[0]
        print(f"\n📊 新しいデータベースの最終店舗数: {final_count:,}件")
        
        return True
        
    except Exception as e:
        print(f"\n❌ エラーが発生しました: {e}")
        import traceback
        traceback.print_exc()
        new_conn.rollback()
        return False
        
    finally:
        old_conn.close()
        new_conn.close()

if __name__ == "__main__":
    success = import_stores()
    sys.exit(0 if success else 1)

