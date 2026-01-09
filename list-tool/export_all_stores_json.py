"""
全店舗データをJSON形式でエクスポートするスクリプト

使用方法:
    python export_all_stores_json.py [--output <output-file>] [--config local|default]

例:
    python export_all_stores_json.py --output stores_export.json --config local
"""

import sys
import os
import json
import argparse
from datetime import datetime
from pathlib import Path

# プロジェクトルートをパスに追加
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from extensions import db
from models import Store
import config_local
import config

# 設定を登録
config.config['local'] = config_local.LocalConfig


def export_all_stores(app, output_file):
    """全店舗データをJSON形式でエクスポート"""
    with app.app_context():
        print(f"📊 データベースから店舗データを取得中...")
        
        try:
            stores = db.session.query(Store).order_by(Store.store_id).all()
            print(f"✅ {len(stores)}件の店舗データを取得しました")
            
            # 店舗データを辞書形式に変換
            stores_data = []
            for i, store in enumerate(stores, 1):
                try:
                    store_dict = store.to_dict()
                    stores_data.append(store_dict)
                    
                    if i % 1000 == 0:
                        print(f"   {i}/{len(stores)}件変換完了...")
                except Exception as e:
                    print(f"⚠️  店舗 {store.store_id} の変換に失敗: {str(e)}")
            
            # エクスポートデータの構造
            export_data = {
                "export_date": datetime.now().isoformat(),
                "total_stores": len(stores_data),
                "stores": stores_data
            }
            
            # JSONファイルに保存
            print(f"\n💾 JSONファイルに保存中: {output_file}")
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(export_data, f, ensure_ascii=False, indent=2)
            
            file_size = os.path.getsize(output_file)
            print(f"✅ エクスポートが完了しました")
            print(f"   - ファイル: {output_file}")
            print(f"   - 総店舗数: {len(stores_data)}件")
            print(f"   - ファイルサイズ: {file_size / 1024 / 1024:.2f}MB")
            
            return output_file
            
        except Exception as e:
            print(f"❌ エラーが発生しました: {str(e)}")
            import traceback
            traceback.print_exc()
            sys.exit(1)


def main():
    parser = argparse.ArgumentParser(
        description='全店舗データをJSON形式でエクスポート'
    )
    parser.add_argument(
        '--output',
        type=str,
        default='stores_export.json',
        help='出力ファイル名 (デフォルト: stores_export.json)'
    )
    parser.add_argument(
        '--config',
        type=str,
        default='local',
        choices=['local', 'default', 'development', 'production'],
        help='使用する設定 (デフォルト: local)'
    )
    
    args = parser.parse_args()
    
    # 出力ファイルのパスを解決
    output_file = Path(args.output)
    if not output_file.is_absolute():
        output_file = Path(__file__).parent / output_file
    
    print("=" * 60)
    print("店舗データ JSONエクスポート")
    print("=" * 60)
    print(f"設定: {args.config}")
    print(f"出力ファイル: {output_file}")
    print("=" * 60)
    print("")
    
    # アプリケーションを作成
    app = create_app(args.config)
    
    try:
        export_all_stores(app, str(output_file))
        
        print("")
        print("=" * 60)
        print("✅ エクスポート処理が完了しました！")
        print("=" * 60)
        print(f"ファイル: {output_file}")
        print("=" * 60)
        
    except Exception as e:
        print("")
        print("=" * 60)
        print("❌ エラーが発生しました")
        print("=" * 60)
        print(str(e))
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
