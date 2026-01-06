#!/usr/bin/env python3
"""新規店舗リスト収集スクリプト

Ubereats、Wolt、出前館、食べログ、ぐるなびなどから新規店舗情報を収集します。
"""
import sys
import time
import requests
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Optional
from bs4 import BeautifulSoup

# プロジェクトルートをパスに追加
sys.path.insert(0, str(Path(__file__).parent))

from app import create_app
from extensions import db
from models import Store
import config_local
import config

config.config['local'] = config_local.LocalConfig

# リクエストヘッダー
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}


def normalize_phone(raw: str) -> str:
    """電話番号の整形"""
    if not raw:
        return ""
    import re
    normalized = (
        raw.replace("－", "-")
        .replace("ー", "-")
        .replace("―", "-")
        .replace("　", "")
        .replace(" ", "")
    )
    normalized = re.sub(r"[^\d-]", "", normalized)
    normalized = re.sub(r"-{2,}", "-", normalized)
    normalized = normalized.strip("-")
    return normalized


def check_store_exists(name: str, address: str = None, url: str = None) -> Optional[Store]:
    """既存の店舗をチェック（重複防止）"""
    app = create_app('local')
    with app.app_context():
        # 店舗名で検索
        store = db.session.query(Store).filter(Store.name == name).first()
        if store:
            return store
        
        # URLで検索
        if url:
            store = db.session.query(Store).filter(Store.url == url).first()
            if store:
                return store
        
        # 住所で検索（部分一致）
        if address:
            store = db.session.query(Store).filter(Store.address.like(f'%{address}%')).first()
            if store:
                return store
        
        return None


def create_store_from_data(data: Dict) -> Store:
    """辞書データからStoreオブジェクトを作成"""
    store = Store()
    store.name = data.get('name', '')
    store.phone = normalize_phone(data.get('phone', '')) if data.get('phone') else None
    store.website = data.get('website')
    store.address = data.get('address')
    store.category = data.get('category')
    store.rating = data.get('rating')
    store.city = data.get('city')
    store.place_id = data.get('place_id')
    store.url = data.get('url')
    store.opening_date = data.get('opening_date')
    store.closed_day = data.get('closed_day')
    store.transport = data.get('transport')
    store.business_hours = data.get('business_hours')
    store.official_account = data.get('official_account')
    store.data_source = data.get('data_source', 'manual')
    store.collected_at = datetime.utcnow()
    store.updated_at = datetime.utcnow()
    
    return store


def collect_from_tabelog(area: str = "tokyo", limit: int = 100) -> List[Dict]:
    """食べログから店舗情報を収集"""
    stores = []
    # TODO: 食べログのスクレイピングロジックを実装
    # 現在はプレースホルダー
    print(f"⚠️  食べログからの収集は未実装です（area={area}, limit={limit}）")
    return stores


def collect_from_ubereats(area: str = "tokyo", limit: int = 100) -> List[Dict]:
    """Ubereatsから店舗情報を収集"""
    stores = []
    # TODO: Ubereatsのスクレイピングロジックを実装
    # 現在はプレースホルダー
    print(f"⚠️  Ubereatsからの収集は未実装です（area={area}, limit={limit}）")
    return stores


def collect_from_wolt(area: str = "tokyo", limit: int = 100) -> List[Dict]:
    """Woltから店舗情報を収集"""
    stores = []
    # TODO: Woltのスクレイピングロジックを実装
    # 現在はプレースホルダー
    print(f"⚠️  Woltからの収集は未実装です（area={area}, limit={limit}）")
    return stores


def collect_from_demaecan(area: str = "tokyo", limit: int = 100) -> List[Dict]:
    """出前館から店舗情報を収集"""
    stores = []
    # TODO: 出前館のスクレイピングロジックを実装
    # 現在はプレースホルダー
    print(f"⚠️  出前館からの収集は未実装です（area={area}, limit={limit}）")
    return stores


def collect_from_gnavi(area: str = "tokyo", limit: int = 100) -> List[Dict]:
    """ぐるなびから店舗情報を収集"""
    stores = []
    # TODO: ぐるなびのスクレイピングロジックを実装
    # 現在はプレースホルダー
    print(f"⚠️  ぐるなびからの収集は未実装です（area={area}, limit={limit}）")
    return stores


def save_stores(stores: List[Dict], source: str = "manual") -> Dict:
    """収集した店舗データをデータベースに保存"""
    app = create_app('local')
    
    with app.app_context():
        saved = 0
        skipped = 0
        errors = 0
        
        for store_data in stores:
            try:
                # データソースを設定
                store_data['data_source'] = source
                
                # 重複チェック
                existing = check_store_exists(
                    name=store_data.get('name', ''),
                    address=store_data.get('address'),
                    url=store_data.get('url')
                )
                
                if existing:
                    skipped += 1
                    continue
                
                # 新しい店舗を作成
                store = create_store_from_data(store_data)
                db.session.add(store)
                saved += 1
                
            except Exception as e:
                print(f"  エラー: {store_data.get('name', 'Unknown')} - {e}")
                errors += 1
                continue
        
        # コミット
        try:
            db.session.commit()
            print(f"✅ 保存完了: {saved}件保存、{skipped}件スキップ、{errors}件エラー")
        except Exception as e:
            print(f"❌ コミットエラー: {e}")
            db.session.rollback()
            return {'saved': 0, 'skipped': 0, 'errors': len(stores)}
        
        return {'saved': saved, 'skipped': skipped, 'errors': errors}


def collect_batch(sources: List[str] = None, areas: List[str] = None, limit_per_source: int = 100, delay: float = 2.0):
    """バッチで新規店舗を収集"""
    if sources is None:
        sources = ['tabelog']  # デフォルトは食べログのみ
    
    if areas is None:
        areas = ['tokyo']  # デフォルトは東京のみ
    
    app = create_app('local')
    
    with app.app_context():
        total_saved = 0
        total_skipped = 0
        total_errors = 0
        
        for source in sources:
            print(f"\n{'='*60}")
            print(f"データソース: {source}")
            print(f"{'='*60}")
            
            for area in areas:
                print(f"\n📦 エリア: {area}")
                
                # ソース別に収集関数を呼び出し
                if source == 'tabelog':
                    stores = collect_from_tabelog(area=area, limit=limit_per_source)
                elif source == 'ubereats':
                    stores = collect_from_ubereats(area=area, limit=limit_per_source)
                elif source == 'wolt':
                    stores = collect_from_wolt(area=area, limit=limit_per_source)
                elif source == 'demaecan':
                    stores = collect_from_demaecan(area=area, limit=limit_per_source)
                elif source == 'gnavi':
                    stores = collect_from_gnavi(area=area, limit=limit_per_source)
                else:
                    print(f"⚠️  不明なデータソース: {source}")
                    continue
                
                if not stores:
                    print(f"  収集された店舗がありません")
                    continue
                
                # データベースに保存
                result = save_stores(stores, source=source)
                total_saved += result['saved']
                total_skipped += result['skipped']
                total_errors += result['errors']
                
                # 待機
                if delay > 0:
                    time.sleep(delay)
        
        # 最終統計
        print("\n" + "="*60)
        print("✅ 新規リスト収集完了")
        print(f"   保存: {total_saved:,}件")
        print(f"   スキップ: {total_skipped:,}件")
        print(f"   エラー: {total_errors:,}件")
        print("="*60)


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='新規店舗リスト収集スクリプト')
    parser.add_argument('--sources', nargs='+', default=['tabelog'], 
                       choices=['tabelog', 'ubereats', 'wolt', 'demaecan', 'gnavi'],
                       help='収集するデータソース（複数指定可）')
    parser.add_argument('--areas', nargs='+', default=['tokyo'],
                       help='収集するエリア（複数指定可）')
    parser.add_argument('--limit', type=int, default=100,
                       help='1ソースあたりの収集件数')
    parser.add_argument('--delay', type=float, default=2.0,
                       help='処理間隔（秒）')
    
    args = parser.parse_args()
    
    collect_batch(
        sources=args.sources,
        areas=args.areas,
        limit_per_source=args.limit,
        delay=args.delay
    )



