#!/usr/bin/env python3
"""既存storesデータにフランチャイズ判定フラグ（is_franchise）を反映するスクリプト。"""

import sys
from pathlib import Path

from sqlalchemy import or_

# プロジェクトルートをパスに追加
sys.path.insert(0, str(Path(__file__).parent))

from app import create_app  # noqa: E402
from extensions import db  # noqa: E402
from models import Store  # noqa: E402
import config_local  # noqa: E402
import config  # noqa: E402

# ローカル設定をマッピング
config.config["local"] = config_local.LocalConfig


def ensure_is_franchise_column():
    """SQLiteのstoresテーブルにis_franchise列がなければ追加する。"""
    engine = db.engine
    inspector = db.inspect(engine)

    columns = [col["name"] for col in inspector.get_columns("stores")]
    if "is_franchise" in columns:
        return

    from sqlalchemy import text

    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE stores ADD COLUMN is_franchise BOOLEAN DEFAULT 0"))
        conn.commit()


def detect_franchise_by_name(name: str) -> bool:
    """店名からフランチャイズらしさを判定する簡易ロジック。"""
    if not name:
        return False

    # 本店は除外
    if "本店" in name:
        return False

    keywords = ["支店", "号店", "チェーン"]
    if any(k in name for k in keywords):
        return True

    # 末尾が「店」で終わるものもフランチャイズ候補とみなす（例: ○○羽生店）
    if name.endswith("店"):
        return True

    return False


def main(limit: int | None = None):
    app = create_app("local")

    with app.app_context():
        ensure_is_franchise_column()

        query = db.session.query(Store)
        # まだフラグが決まっていない、もしくはFalseになっているものを対象
        query = query.filter(or_(Store.is_franchise.is_(None), Store.is_franchise.is_(False)))

        if limit:
            stores = query.limit(limit).all()
        else:
            stores = query.all()

        print(f"対象店舗数: {len(stores)}件")

        updated = 0
        for store in stores:
            if detect_franchise_by_name(store.name):
                store.is_franchise = True
                updated += 1

        db.session.commit()
        print(f"フランチャイズと判定された店舗数: {updated}件")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="既存storesデータにis_franchiseフラグを付与")
    parser.add_argument("--limit", type=int, default=None, help="処理する最大件数（省略時は全件）")
    args = parser.parse_args()

    main(limit=args.limit)


