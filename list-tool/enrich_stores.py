#!/usr/bin/env python3
"""店舗データの補完スクリプト"""
import sys
import time
from pathlib import Path
from datetime import datetime

# プロジェクトルートをパスに追加
sys.path.insert(0, str(Path(__file__).parent))

from app import create_app
from extensions import db
from models import Store
from sqlalchemy import func, and_, or_
import config_local
import config

config.config['local'] = config_local.LocalConfig


def get_stores_to_enrich(limit=100):
    """補完が必要な店舗を取得"""
    app = create_app('local')
    with app.app_context():
        stores = db.session.query(Store).filter(
            and_(
                Store.opening_date.isnot(None),
                Store.url.isnot(None), Store.url != '',
                or_(
                    Store.phone.is_(None), Store.phone == '',
                    Store.closed_day.is_(None), Store.closed_day == '',
                    Store.business_hours.is_(None), Store.business_hours == '',
                    Store.transport.is_(None), Store.transport == ''
                )
            )
        ).limit(limit).all()
        return stores


def enrich_store_details(store):
    """店舗の詳細情報を補完（食べログから）"""
    try:
        # 食べログのURLから詳細情報を取得
        if not store.url or 'tabelog.com' not in store.url:
            return False
        
        # ここで実際のスクレイピング処理を実装
        # 現在はプレースホルダーとして、既存のデータを確認
        
        updated = False
        
        # 電話番号がなければ、URLから取得を試みる
        # 実際の実装では、食べログのページをスクレイピングして情報を取得
        
        # 定休日、営業時間、交通アクセスなどの情報を取得
        # この部分は実際のスクレイピングロジックに置き換える必要があります
        
        if updated:
            store.updated_at = datetime.utcnow()
            return True
        
        return False
        
    except Exception as e:
        print(f"  エラー: {store.name} - {e}")
        return False


def enrich_batch(limit=100, delay=1.0):
    """バッチで補完処理を実行"""
    app = create_app('local')
    
    with app.app_context():
        # 補完が必要な件数を取得
        remaining = db.session.query(func.count(func.distinct(Store.store_id))).filter(
            and_(
                Store.opening_date.isnot(None),
                Store.url.isnot(None), Store.url != '',
                or_(
                    Store.phone.is_(None), Store.phone == '',
                    Store.closed_day.is_(None), Store.closed_day == '',
                    Store.business_hours.is_(None), Store.business_hours == '',
                    Store.transport.is_(None), Store.transport == ''
                )
            )
        ).scalar()
        
        print(f"補完が必要な店舗数: {remaining:,}件")
        print(f"1回あたりの処理件数: {limit}件")
        print(f"処理間隔: {delay}秒")
        print("=" * 60)
        
        processed = 0
        updated = 0
        
        while True:
            stores = get_stores_to_enrich(limit)
            
            if not stores:
                print("\n✅ 全ての店舗の補完が完了しました！")
                break
            
            print(f"\n📦 バッチ処理開始: {len(stores)}件")
            
            for store in stores:
                try:
                    if enrich_store_details(store):
                        updated += 1
                    processed += 1
                    
                    if processed % 10 == 0:
                        print(f"   進捗: {processed:,}件処理済み (更新: {updated:,}件)")
                    
                    time.sleep(delay)
                    
                except Exception as e:
                    print(f"   ⚠️  エラー: {store.name} - {e}")
                    continue
            
            # コミット
            try:
                db.session.commit()
                print(f"✅ バッチ処理完了: {len(stores)}件処理、{updated}件更新")
            except Exception as e:
                print(f"❌ コミットエラー: {e}")
                db.session.rollback()
            
            # 残り件数を確認
            remaining = db.session.query(func.count(func.distinct(Store.store_id))).filter(
                and_(
                    Store.opening_date.isnot(None),
                    Store.url.isnot(None), Store.url != '',
                    or_(
                        Store.phone.is_(None), Store.phone == '',
                        Store.closed_day.is_(None), Store.closed_day == '',
                        Store.business_hours.is_(None), Store.business_hours == '',
                        Store.transport.is_(None), Store.transport == ''
                    )
                )
            ).scalar()
            
            print(f"残り: {remaining:,}件")
            
            if remaining == 0:
                break
            
            # 次のバッチまで待機
            print(f"⏳ {delay}秒待機中...")
            time.sleep(delay)
        
        print("\n" + "=" * 60)
        print(f"✅ 補完処理完了")
        print(f"   処理済み: {processed:,}件")
        print(f"   更新: {updated:,}件")
        print("=" * 60)


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='店舗データの補完処理')
    parser.add_argument('--limit', type=int, default=100, help='1回あたりの処理件数')
    parser.add_argument('--delay', type=float, default=1.0, help='処理間隔（秒）')
    
    args = parser.parse_args()
    
    enrich_batch(limit=args.limit, delay=args.delay)

