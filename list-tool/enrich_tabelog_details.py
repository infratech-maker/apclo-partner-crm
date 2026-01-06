#!/usr/bin/env python3
"""食べログから店舗詳細情報を補完するスクリプト"""
import sys
import re
import time
import requests
import json
from typing import Dict, Optional
from datetime import datetime
from pathlib import Path
from bs4 import BeautifulSoup

# プロジェクトルートをパスに追加
sys.path.insert(0, str(Path(__file__).parent))

from app import create_app
from extensions import db
from models import Store
from sqlalchemy import func, and_, or_
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


def extract_from_tabelog(soup: BeautifulSoup) -> Dict[str, str]:
    """食べログのページから情報を抽出"""
    result = {}
    
    try:
        head = soup.find('div', id='rst-data-head')
        if not head:
            return result
        
        tables = head.find_all('table', class_='rstinfo-table__table')
        
        for table in tables:
            rows = table.find_all('tr')
            for tr in rows:
                try:
                    th = tr.find('th')
                    td = tr.find('td')
                    if not th or not td:
                        continue
                    
                    label = th.get_text(strip=True)
                    if not label:
                        continue
                    
                    # お問い合わせ（電話番号）
                    # 「予約・お問い合わせ」または「お問い合わせ」のラベルに対応
                    if label == "お問い合わせ" or label == "予約・お問い合わせ":
                        phone_links = td.find_all('a', href=re.compile(r'tel:'))
                        if phone_links:
                            phone = phone_links[0].get('href', '').replace('tel:', '').strip()
                            result["phone"] = normalize_phone(phone)
                        else:
                            phone_text = td.get_text(strip=True)
                            # 電話番号パターンを抽出（数字とハイフンを含む）
                            phone_match = re.search(r'[\d\-\(\)]+', phone_text)
                            if phone_match:
                                result["phone"] = normalize_phone(phone_match.group())
                            else:
                                result["phone"] = normalize_phone(phone_text)
                    
                    # 交通手段
                    elif label == "交通手段":
                        transport = td.get_text(strip=True)
                        result["transport"] = transport
                    
                    # 営業時間
                    elif label == "営業時間":
                        hours = td.get_text(strip=True)
                        result["business_hours"] = hours
                    
                    # 定休日
                    elif label == "定休日":
                        closed = td.get_text(strip=True)
                        result["closed_day"] = closed
                    
                    # 公式アカウント
                    elif label == "公式アカウント":
                        accounts = []
                        for link in td.find_all('a'):
                            href = link.get('href', '')
                            text = link.get_text(strip=True)
                            if href:
                                accounts.append(f"{text}: {href}")
                        if accounts:
                            result["official_account"] = "\n".join(accounts)
                    
                except Exception as e:
                    continue
                    
    except Exception as e:
        pass
    
    return result


def send_slack_notification(message: str, webhook_url: str = None):
    """Slackに通知を送信"""
    if not webhook_url:
        # 設定から取得
        app = create_app('local')
        with app.app_context():
            webhook_url = app.config.get('SLACK_WEBHOOK_URL', '')
    
    if not webhook_url:
        return False
    
    try:
        payload = {
            "text": message
        }
        response = requests.post(webhook_url, json=payload, timeout=5)
        response.raise_for_status()
        return True
    except Exception as e:
        print(f"⚠️  Slack通知エラー: {e}")
        return False


def enrich_store_from_tabelog(store: Store) -> bool:
    """食べログのURLから店舗情報を補完"""
    if not store.url or 'tabelog.com' not in store.url:
        return False
    
    try:
        # リクエスト送信
        response = requests.get(store.url, headers=HEADERS, timeout=10)
        response.raise_for_status()
        
        # HTMLをパース
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # 情報を抽出
        details = extract_from_tabelog(soup)
        
        # データベースを更新
        updated = False
        
        if details.get("phone") and not store.phone:
            store.phone = details["phone"]
            updated = True
        
        if details.get("transport") and not store.transport:
            store.transport = details["transport"]
            updated = True
        
        if details.get("business_hours") and not store.business_hours:
            store.business_hours = details["business_hours"]
            updated = True
        
        if details.get("closed_day") and not store.closed_day:
            store.closed_day = details["closed_day"]
            updated = True
        
        if details.get("official_account") and not store.official_account:
            store.official_account = details["official_account"]
            updated = True
        
        if updated:
            store.updated_at = datetime.utcnow()
        
        return updated
        
    except Exception as e:
        print(f"  エラー: {store.name} ({store.url}) - {e}")
        return False


def enrich_batch(limit=100, delay=2.0, max_rounds=None, prefecture: Optional[str] = None):
    """バッチで補完処理を実行

    prefecture が指定された場合は、住所の先頭がその都道府県名の店舗に限定して補完を行う。
    """
    app = create_app('local')
    
    with app.app_context():
        # Slack Webhook URLを取得
        webhook_url = app.config.get('SLACK_WEBHOOK_URL', '')
        
        # 開始通知
        area_label = f"（{prefecture}エリア）" if prefecture else ""
        start_message = (
            f"🚀 *店舗データ補完処理を開始しました*{area_label}\n"
            f"処理件数: {limit}件/回\n"
            f"処理間隔: {delay}秒\n"
            f"最大ラウンド数: {max_rounds if max_rounds else '無制限'}"
        )
        send_slack_notification(start_message, webhook_url)
        
        round_num = 0
        total_processed = 0
        total_updated = 0
        initial_remaining = None
        
        while True:
            round_num += 1
            if max_rounds and round_num > max_rounds:
                message = f"⏸️ *最大ラウンド数 ({max_rounds}) に達しました*"
                print(f"\n{message}")
                send_slack_notification(message, webhook_url)
                break
            
            # 補完が必要な件数を取得
            remaining_query = db.session.query(func.count(func.distinct(Store.store_id))).filter(
                and_(
                    Store.opening_date.isnot(None),
                    Store.url.isnot(None),
                    Store.url != "",
                    or_(
                        Store.phone.is_(None),
                        Store.phone == "",
                        Store.closed_day.is_(None),
                        Store.closed_day == "",
                        Store.business_hours.is_(None),
                        Store.business_hours == "",
                        Store.transport.is_(None),
                        Store.transport == "",
                    ),
                )
            )

            # 都道府県指定がある場合は住所で絞り込み
            if prefecture:
                remaining_query = remaining_query.filter(
                    Store.address.isnot(None),
                    Store.address != "",
                    Store.address.like(f"{prefecture}%"),
                )

            remaining = remaining_query.scalar()
            
            # 最初のラウンドで初期残り件数を保存
            if initial_remaining is None:
                initial_remaining = remaining
            
            if remaining == 0:
                message = "✅ *全ての店舗の補完が完了しました！*"
                print(f"\n{message}")
                send_slack_notification(message, webhook_url)
                break
            
            # ラウンド開始通知
            round_message = (
                f"📊 *ラウンド {round_num} 開始*{area_label}\n"
                f"補完が必要な店舗数: {remaining:,}件\n"
                f"1回あたりの処理件数: {limit}件"
            )
            print(f"\n{'='*60}")
            print(f"ラウンド {round_num}")
            print(f"{'='*60}")
            print(f"補完が必要な店舗数: {remaining:,}件")
            print(f"1回あたりの処理件数: {limit}件")
            print(f"処理間隔: {delay}秒")
            send_slack_notification(round_message, webhook_url)
            
            # 補完が必要な店舗を取得（食べログのURLがあるもの優先）
            stores_query = db.session.query(Store).filter(
                and_(
                    Store.opening_date.isnot(None),
                    Store.url.isnot(None),
                    Store.url != "",
                    Store.url.like("%tabelog.com%"),
                    or_(
                        Store.phone.is_(None),
                        Store.phone == "",
                        Store.closed_day.is_(None),
                        Store.closed_day == "",
                        Store.business_hours.is_(None),
                        Store.business_hours == "",
                        Store.transport.is_(None),
                        Store.transport == "",
                    ),
                )
            )

            if prefecture:
                stores_query = stores_query.filter(
                    Store.address.isnot(None),
                    Store.address != "",
                    Store.address.like(f"{prefecture}%"),
                )

            stores = stores_query.limit(limit).all()
            
            if not stores:
                message = "⚠️ 補完可能な店舗がありません"
                print(message)
                send_slack_notification(message, webhook_url)
                break
            
            print(f"\n📦 バッチ処理開始: {len(stores)}件")
            
            processed = 0
            updated = 0
            
            for store in stores:
                try:
                    if enrich_store_from_tabelog(store):
                        updated += 1
                    processed += 1
                    
                    if processed % 10 == 0:
                        print(f"   進捗: {processed:,}件処理済み (更新: {updated:,}件)")
                    
                    time.sleep(delay)
                    
                except Exception as e:
                    print(f"   ⚠️  エラー: {store.name} - {e}")
                    continue
            
            total_processed += processed
            total_updated += updated
            
            # コミット
            try:
                db.session.commit()
                print(f"\n✅ バッチ処理完了: {processed:,}件処理、{updated:,}件更新")
            except Exception as e:
                print(f"❌ コミットエラー: {e}")
                db.session.rollback()
            
            # 残り件数を確認
            remaining_check_query = db.session.query(func.count(func.distinct(Store.store_id))).filter(
                and_(
                    Store.opening_date.isnot(None),
                    Store.url.isnot(None),
                    Store.url != "",
                    or_(
                        Store.phone.is_(None),
                        Store.phone == "",
                        Store.closed_day.is_(None),
                        Store.closed_day == "",
                        Store.business_hours.is_(None),
                        Store.business_hours == "",
                        Store.transport.is_(None),
                        Store.transport == "",
                    ),
                )
            )

            if prefecture:
                remaining_check_query = remaining_check_query.filter(
                    Store.address.isnot(None),
                    Store.address != "",
                    Store.address.like(f"{prefecture}%"),
                )

            remaining = remaining_check_query.scalar()
            
            print(f"残り: {remaining:,}件")
            
            # ラウンド完了通知
            # 進捗率を計算（初期残り件数に対する進捗）
            progress_percent = ((initial_remaining - remaining) / initial_remaining * 100) if initial_remaining and initial_remaining > 0 else 0
            
            round_complete_message = (
                f"✅ *ラウンド {round_num} 完了*{area_label}\n"
                f"処理済み: {processed:,}件 (更新: {updated:,}件)\n"
                f"累計処理: {total_processed:,}件 (累計更新: {total_updated:,}件)\n"
                f"残り: {remaining:,}件\n"
                f"進捗率: {progress_percent:.1f}%"
            )
            send_slack_notification(round_complete_message, webhook_url)
            
            if remaining == 0:
                break
            
            # 次のラウンドまで待機
            if round_num < (max_rounds or float('inf')):
                print(f"\n⏳ {delay * 2}秒待機して次のラウンドへ...")
                time.sleep(delay * 2)
        
        # 最終統計
        total_query = db.session.query(func.count(Store.store_id))
        remaining_final_query = db.session.query(func.count(func.distinct(Store.store_id))).filter(
            and_(
                Store.opening_date.isnot(None),
                Store.url.isnot(None),
                Store.url != "",
                or_(
                    Store.phone.is_(None),
                    Store.phone == "",
                    Store.closed_day.is_(None),
                    Store.closed_day == "",
                    Store.business_hours.is_(None),
                    Store.business_hours == "",
                    Store.transport.is_(None),
                    Store.transport == "",
                ),
            )
        )

        if prefecture:
            total_query = total_query.filter(
                Store.address.isnot(None),
                Store.address != "",
                Store.address.like(f"{prefecture}%"),
            )
            remaining_final_query = remaining_final_query.filter(
                Store.address.isnot(None),
                Store.address != "",
                Store.address.like(f"{prefecture}%"),
            )

        total = total_query.scalar()
        remaining = remaining_final_query.scalar()
        
        completion_rate = ((total - remaining) / total * 100) if total > 0 else 0
        
        print("\n" + "="*60)
        print("✅ 補完処理完了")
        if prefecture:
            print(f"   対象エリア: {prefecture}")
        print(f"   全店舗数: {total:,}件")
        print(f"   補完必要: {remaining:,}件")
        print(f"   補完率: {completion_rate:.1f}%")
        print("="*60)
        
        # 完了通知
        final_message = f"🎉 *補完処理が完了しました*\n" \
                       f"全店舗数: {total:,}件\n" \
                       f"補完必要: {remaining:,}件\n" \
                       f"補完率: {completion_rate:.1f}%\n" \
                       f"累計処理: {total_processed:,}件\n" \
                       f"累計更新: {total_updated:,}件"
        send_slack_notification(final_message, webhook_url)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="食べログから店舗データの補完処理")
    parser.add_argument("--limit", type=int, default=50, help="1回あたりの処理件数")
    parser.add_argument("--delay", type=float, default=2.0, help="処理間隔（秒）")
    parser.add_argument("--max-rounds", type=int, default=None, help="最大ラウンド数")
    parser.add_argument(
        "--prefecture",
        type=str,
        default=None,
        help="対象とする都道府県名（例: 福岡）。指定しない場合は全国が対象。",
    )

    args = parser.parse_args()

    enrich_batch(
        limit=args.limit,
        delay=args.delay,
        max_rounds=args.max_rounds,
        prefecture=args.prefecture,
    )

