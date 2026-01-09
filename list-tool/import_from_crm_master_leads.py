"""
crm-platformのmaster_leadsテーブルから直接データを取得してlist-toolのデータベースにインポートするスクリプト

使用方法:
    python import_from_crm_master_leads.py [--config local|default] [--db-url <postgresql-url>]

例:
    python import_from_crm_master_leads.py --config local --db-url postgresql://user:pass@localhost:5432/dbname
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
from models import Store, DeliveryService
import config_local
import config

# 設定を登録
config.config['local'] = config_local.LocalConfig

# PostgreSQL接続用
try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
    HAS_PSYCOPG2 = True
except ImportError:
    HAS_PSYCOPG2 = False
    print("⚠️  psycopg2がインストールされていません。PostgreSQL接続にはpsycopg2が必要です。")


def get_database_url_from_env():
    """環境変数からデータベースURLを取得"""
    # .envファイルを読み込む
    env_path = Path(__file__).parent.parent / 'crm-platform' / '.env.local'
    if env_path.exists():
        with open(env_path, 'r') as f:
            for line in f:
                line = line.strip()
                if line.startswith('DATABASE_URL='):
                    return line.split('=', 1)[1].strip().strip('"').strip("'")
    
    # 環境変数から直接取得
    return os.getenv('DATABASE_URL')


def fetch_master_leads_from_crm(db_url):
    """crm-platformのmaster_leadsテーブルから全データを取得"""
    if not HAS_PSYCOPG2:
        raise ImportError("psycopg2が必要です。インストールしてください: pip install psycopg2-binary")
    
    print(f"📡 crm-platformのデータベースに接続中...")
    print(f"   URL: {db_url.split('@')[1] if '@' in db_url else '***'}")
    
    conn = psycopg2.connect(db_url)
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        # master_leadsテーブルから全データを取得
        # Prismaはキャメルケースのカラム名を使用するため、引用符で囲む
        query = """
            SELECT 
                id,
                "companyName",
                phone,
                address,
                source,
                data,
                "createdAt",
                "updatedAt"
            FROM master_leads
            ORDER BY "createdAt" ASC
        """
        
        print("📊 master_leadsテーブルからデータを取得中...")
        cursor.execute(query)
        rows = cursor.fetchall()
        
        print(f"✅ {len(rows)}件のマスターリードデータを取得しました")
        
        # 辞書形式に変換
        master_leads = []
        for row in rows:
            master_leads.append({
                'id': row['id'],
                'companyName': row['companyName'],
                'phone': row['phone'],
                'address': row['address'],
                'source': row['source'],
                'data': row['data'],
                'createdAt': row['createdAt'].isoformat() if row['createdAt'] else None,
                'updatedAt': row['updatedAt'].isoformat() if row['updatedAt'] else None,
            })
        
        return master_leads
        
    finally:
        cursor.close()
        conn.close()


def convert_master_lead_to_store(master_lead):
    """master_leadデータをStoreモデルに変換"""
    data = master_lead.get('data', {})
    
    # store_id: data.store_idを優先、なければidを使用
    store_id = data.get('store_id') or master_lead.get('id')
    if not store_id:
        import uuid
        store_id = str(uuid.uuid4())
    
    # 店舗名: companyNameまたはdata.nameまたはdata.店舗名を優先
    name = master_lead.get('companyName') or data.get('name') or data.get('店舗名') or '店舗名不明'
    
    # 電話番号: phoneまたはdata.phoneまたはdata.電話番号
    phone = master_lead.get('phone') or data.get('phone') or data.get('電話番号') or None
    
    # ウェブサイト
    website = data.get('website') or None
    
    # 住所: addressまたはdata.addressまたはdata.住所またはdata.詳細住所
    address = master_lead.get('address') or data.get('address') or data.get('住所') or data.get('詳細住所') or None
    
    # カテゴリ
    category = data.get('category') or None
    
    # 評価
    rating = data.get('rating')
    if rating is not None:
        try:
            rating = float(rating)
        except (ValueError, TypeError):
            rating = None
    else:
        rating = None
    
    # 都市
    city = data.get('city') or None
    
    # place_id
    place_id = data.get('place_id') or None
    
    # URL: data.urlまたはsource
    url = data.get('url') or master_lead.get('source') or None
    
    # フランチャイズ
    is_franchise = data.get('is_franchise', False)
    if isinstance(is_franchise, str):
        is_franchise = is_franchise.lower() in ('true', '1', 'yes')
    
    # 位置情報
    location = None
    if data.get('location'):
        if isinstance(data['location'], dict):
            lat = data['location'].get('lat')
            lng = data['location'].get('lng')
            if lat and lng:
                location = json.dumps({'lat': lat, 'lng': lng})
        elif isinstance(data['location'], str):
            location = data['location']
    
    # 開店日
    opening_date = data.get('opening_date') or None
    
    # 定休日
    closed_day = data.get('closed_day') or None
    
    # 交通手段
    transport = data.get('transport') or None
    
    # 営業時間
    business_hours = data.get('business_hours') or None
    
    # 公式アカウント
    official_account = data.get('official_account') or None
    
    # データソース
    data_source = data.get('data_source') or master_lead.get('source', 'crm-master-lead')
    
    # 収集日時
    collected_at = None
    if data.get('collected_at'):
        try:
            collected_at = datetime.fromisoformat(data['collected_at'].replace('Z', '+00:00'))
        except (ValueError, AttributeError):
            pass
    if not collected_at and master_lead.get('createdAt'):
        try:
            collected_at = datetime.fromisoformat(master_lead['createdAt'].replace('Z', '+00:00'))
        except (ValueError, AttributeError):
            pass
    if not collected_at:
        collected_at = datetime.utcnow()
    
    # 更新日時
    updated_at = None
    if master_lead.get('updatedAt'):
        try:
            updated_at = datetime.fromisoformat(master_lead['updatedAt'].replace('Z', '+00:00'))
        except (ValueError, AttributeError):
            pass
    if not updated_at:
        updated_at = datetime.utcnow()
    
    # Storeオブジェクトを作成
    store = Store(
        store_id=store_id,
        name=name,
        phone=phone,
        website=website,
        address=address,
        category=category,
        rating=rating,
        city=city,
        place_id=place_id,
        url=url,
        is_franchise=is_franchise,
        location=location,
        opening_date=opening_date,
        closed_day=closed_day,
        transport=transport,
        business_hours=business_hours,
        official_account=official_account,
        data_source=data_source,
        collected_at=collected_at,
        updated_at=updated_at,
    )
    
    # デリバリーサービス情報
    delivery_services = data.get('delivery_services', [])
    if isinstance(delivery_services, list) and delivery_services:
        store.delivery_services = []
        for service_name in delivery_services:
            if service_name:
                delivery_service = DeliveryService(
                    store_id=store_id,
                    service_name=str(service_name),
                    is_active=True,
                )
                store.delivery_services.append(delivery_service)
    
    return store


def delete_all_stores(app):
    """既存の店舗データをすべて削除"""
    with app.app_context():
        print("🗑️  既存の店舗データを削除中...")
        
        # デリバリーサービスを先に削除（外部キー制約のため）
        deleted_services = db.session.query(DeliveryService).delete()
        print(f"   - デリバリーサービス: {deleted_services}件削除")
        
        # 店舗データを削除
        deleted_stores = db.session.query(Store).delete()
        print(f"   - 店舗データ: {deleted_stores}件削除")
        
        db.session.commit()
        print("✅ 既存データの削除が完了しました")


def import_stores(app, master_leads):
    """マスターリードデータを店舗データとしてインポート"""
    with app.app_context():
        print(f"\n🔄 {len(master_leads)}件のマスターリードデータを店舗データに変換中...")
        
        stores = []
        errors = []
        
        for i, master_lead in enumerate(master_leads, 1):
            try:
                store = convert_master_lead_to_store(master_lead)
                stores.append(store)
                
                if i % 1000 == 0:
                    print(f"   {i}/{len(master_leads)}件変換完了...")
            except Exception as e:
                error_msg = f"マスターリード {master_lead.get('id', 'unknown')} の変換に失敗: {str(e)}"
                errors.append(error_msg)
                print(f"⚠️  {error_msg}")
        
        if errors:
            print(f"\n⚠️  {len(errors)}件のエラーが発生しました")
        
        print(f"✅ {len(stores)}件の店舗データに変換しました")
        
        # データベースに一括挿入
        print(f"\n💾 データベースに挿入中...")
        batch_size = 1000
        
        for i in range(0, len(stores), batch_size):
            batch = stores[i:i + batch_size]
            try:
                db.session.bulk_save_objects(batch)
                db.session.commit()
                print(f"   {min(i + batch_size, len(stores))}/{len(stores)}件挿入完了...")
            except Exception as e:
                db.session.rollback()
                print(f"❌ バッチ挿入エラー (バッチ {i//batch_size + 1}): {str(e)}")
                # 個別に挿入を試みる
                for store in batch:
                    try:
                        db.session.merge(store)
                        db.session.commit()
                    except Exception as e2:
                        db.session.rollback()
                        print(f"   ⚠️  個別挿入も失敗: {store.store_id} - {str(e2)}")
        
        # 最終的な件数を確認
        total_count = db.session.query(Store).count()
        print(f"\n✅ インポートが完了しました")
        print(f"   - データベース内の店舗数: {total_count}件")
        
        return total_count


def main():
    parser = argparse.ArgumentParser(
        description='crm-platformのmaster_leadsテーブルから直接データを取得してlist-toolのデータベースにインポート'
    )
    parser.add_argument(
        '--config',
        type=str,
        default='local',
        choices=['local', 'default', 'development', 'production'],
        help='使用する設定 (デフォルト: local)'
    )
    parser.add_argument(
        '--db-url',
        type=str,
        default=None,
        help='crm-platformのPostgreSQLデータベースURL (例: postgresql://user:pass@localhost:5432/dbname)'
    )
    
    args = parser.parse_args()
    
    # データベースURLを取得
    db_url = args.db_url or get_database_url_from_env()
    
    if not db_url:
        print("❌ データベースURLが指定されていません。")
        print("   以下のいずれかの方法で指定してください:")
        print("   1. --db-urlオプションで指定")
        print("   2. DATABASE_URL環境変数を設定")
        print("   3. ../crm-platform/.env.localファイルにDATABASE_URLを設定")
        sys.exit(1)
    
    print("=" * 60)
    print("crm-platform master_leads → list-tool データインポート")
    print("=" * 60)
    print(f"設定: {args.config}")
    print(f"データベース: {db_url.split('@')[1] if '@' in db_url else '***'}")
    print("=" * 60)
    print("")
    
    # アプリケーションを作成
    app = create_app(args.config)
    
    try:
        # 1. crm-platformのmaster_leadsテーブルからデータを取得
        master_leads = fetch_master_leads_from_crm(db_url)
        
        if len(master_leads) == 0:
            print("⚠️  取得したデータがありません")
            sys.exit(0)
        
        # 2. 既存データを削除
        delete_all_stores(app)
        
        # 3. データをインポート
        total_count = import_stores(app, master_leads)
        
        print("")
        print("=" * 60)
        print("✅ インポート処理が完了しました！")
        print("=" * 60)
        print(f"インポートされた店舗数: {total_count}件")
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
