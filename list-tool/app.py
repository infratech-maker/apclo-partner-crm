"""Flaskアプリケーションファクトリ"""
from flask import Flask, send_from_directory, jsonify, request
from extensions import db, migrate
from config import config as config_dict
import os


def create_app(config_name='default'):
    """アプリケーションファクトリ"""
    app = Flask(__name__)
    
    # 設定を読み込む
    if config_name not in config_dict:
        config_name = 'default'
    app.config.from_object(config_dict[config_name])
    
    # ngrokの警告ページをスキップするためのヘッダーを追加
    @app.after_request
    def after_request(response):
        # ngrokの警告ページをスキップするためのヘッダー
        response.headers['ngrok-skip-browser-warning'] = 'true'
        # CORSヘッダーを追加（必要に応じて）
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, ngrok-skip-browser-warning'
        return response
    
    # 拡張機能を初期化
    db.init_app(app)
    migrate.init_app(app, db)
    
    # データベーステーブルを自動作成（初回のみ）
    with app.app_context():
        try:
            db.create_all()
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"データベーステーブル作成をスキップ: {e}")
    
    # ルートを登録
    register_routes(app)
    
    # シェルコンテキストを設定
    @app.shell_context_processor
    def make_shell_context():
        from models import Store, User
        return {'db': db, 'Store': Store, 'User': User}
    
    # Celeryを初期化（Redisが利用可能な場合のみ）
    try:
        from tasks import make_celery
        celery_app = make_celery(app)
        
        # Celeryタスクを登録
        from tasks import register_tasks, register_enrichment_tasks
        register_tasks(celery_app)
        register_enrichment_tasks(celery_app)
    except Exception as e:
        # Redisが利用できない場合はCeleryを無効化
        import logging
        logger = logging.getLogger(__name__)
        logger.warning(f"Celeryの初期化をスキップしました: {e}")
    
    return app


def register_routes(app):
    """ルートを登録"""
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    
    # Webルート
    @app.route("/")
    def root():
        return send_from_directory(BASE_DIR, "list-tool.html")
    
    @app.route("/list-tool")
    def list_tool():
        return send_from_directory(BASE_DIR, "list-tool.html")
    
    @app.route("/login")
    def login():
        return send_from_directory(BASE_DIR, "login.html")
    
    @app.route("/dashboard")
    def dashboard():
        return send_from_directory(BASE_DIR, "dashboard.html")
    
    @app.route("/admin-dashboard")
    def admin_dashboard():
        return send_from_directory(BASE_DIR, "admin-dashboard.html")
    
    @app.route("/products")
    def products():
        return send_from_directory(BASE_DIR, "products.html")
    
    @app.route("/account-management")
    def account_management():
        return send_from_directory(BASE_DIR, "account-management.html")
    
    @app.route("/barius.html")
    def barius():
        return send_from_directory(BASE_DIR, "barius.html")
    
    @app.route("/barius")
    def barius_short():
        return send_from_directory(BASE_DIR, "barius.html")
    
    # 静的ファイル（画像）の配信
    @app.route("/<path:filename>")
    def serve_static(filename):
        """画像ファイルなどの静的ファイルを配信"""
        # 画像ファイルのみを配信（セキュリティ対策）
        if filename.endswith(('.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.JPG', '.JPEG', '.PNG', '.GIF', '.SVG', '.WEBP')):
            return send_from_directory(BASE_DIR, filename)
        else:
            from flask import abort
            abort(404)
    
    # APIルート
    @app.route("/api/health")
    def health():
        return jsonify({"status": "ok"})
    
    @app.route("/api/areas")
    def get_areas():
        """エリアリスト取得API"""
        try:
            AREAS = ["北海道", "東北", "関東", "中部", "近畿", "中国", "四国", "九州"]
            AREA_PREFECTURES = {
                "北海道": ["北海道"],
                "東北": ["青森", "岩手", "宮城", "秋田", "山形", "福島"],
                "関東": ["茨城", "栃木", "群馬", "埼玉", "千葉", "東京", "神奈川"],
                "中部": ["新潟", "富山", "石川", "福井", "山梨", "長野", "岐阜", "静岡", "愛知"],
                "近畿": ["三重", "滋賀", "京都", "大阪", "兵庫", "奈良", "和歌山"],
                "中国": ["鳥取", "島根", "岡山", "広島", "山口"],
                "四国": ["徳島", "香川", "愛媛", "高知"],
                "九州": ["福岡", "佐賀", "長崎", "熊本", "大分", "宮崎", "鹿児島", "沖縄"]
            }
            return jsonify({
                "areas": AREAS,
                "area_prefectures": AREA_PREFECTURES
            })
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    @app.route("/api/prefectures")
    def get_prefectures():
        """都道府県リスト取得API"""
        try:
            PREFECTURES = [
                "北海道", "青森", "岩手", "宮城", "秋田", "山形", "福島",
                "茨城", "栃木", "群馬", "埼玉", "千葉", "東京", "神奈川",
                "新潟", "富山", "石川", "福井", "山梨", "長野", "岐阜", "静岡", "愛知",
                "三重", "滋賀", "京都", "大阪", "兵庫", "奈良", "和歌山",
                "鳥取", "島根", "岡山", "広島", "山口",
                "徳島", "香川", "愛媛", "高知",
                "福岡", "佐賀", "長崎", "熊本", "大分", "宮崎", "鹿児島", "沖縄"
            ]
            return jsonify({"prefectures": PREFECTURES})
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    @app.route("/api/cities")
    def get_cities():
        """指定した都道府県に属する市区町村リスト取得API"""
        try:
            from models import Store
            from sqlalchemy import func
            from sqlalchemy.exc import OperationalError

            prefecture = request.args.get("prefecture", "").strip()

            try:
                query = db.session.query(Store.city).filter(
                    Store.city.isnot(None),
                    Store.city != ""
                )

                # 住所の先頭に都道府県名が含まれている前提でフィルタ
                if prefecture:
                    query = query.filter(
                        Store.address.isnot(None),
                        Store.address != "",
                        Store.address.like(f"{prefecture}%"),
                    )

                cities_rows = query.distinct().all()
                cities = sorted({row[0] for row in cities_rows if row[0]})

                return jsonify({"cities": cities})
            except OperationalError as e:
                # テーブル未作成時は空リストを返す
                if "no such table" in str(e).lower():
                    return jsonify({"cities": []})
                raise
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    @app.route("/api/categories")
    def get_categories():
        """カテゴリリスト取得API"""
        try:
            ALL_CATEGORIES = [
                "和食", "寿司", "ラーメン", "うどん", "そば", "焼肉", "焼鳥", "居酒屋",
                "イタリアン", "フレンチ", "中華", "韓国料理", "タイ料理", "インド料理",
                "カフェ", "パン", "スイーツ", "バー", "パブ"
            ]
            CATEGORIES = {
                "和食": ["和食", "寿司", "ラーメン", "うどん", "そば", "焼肉", "焼鳥", "居酒屋"],
                "洋食": ["イタリアン", "フレンチ"],
                "アジア": ["中華", "韓国料理", "タイ料理", "インド料理"],
                "その他": ["カフェ", "パン", "スイーツ", "バー", "パブ"]
            }
            return jsonify({
                "categories": ALL_CATEGORIES,
                "category_groups": CATEGORIES
            })
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    @app.route("/api/stats")
    def get_stats():
        """統計情報取得API"""
        try:
            from models import Store
            from sqlalchemy import func, and_, or_
            from sqlalchemy.exc import OperationalError
            
            # テーブルが存在するか確認
            try:
                # 全店舗数
                total_stores = db.session.query(func.count(func.distinct(Store.store_id))).scalar() or 0
            except OperationalError as e:
                # テーブルが存在しない場合は0を返す
                if 'no such table' in str(e).lower():
                    return jsonify({
                        'total_stores': 0,
                        'total_with_opening': 0,
                        'with_opening_date_count': 0,
                        'remaining': 0,
                        'completed': 0,
                        'completion_rate': 0,
                        'with_phone': 0,
                        'with_website': 0,
                        'fully_completed': 0,
                        'fully_completed_with_opening': 0,
                    })
                raise
                
            # 開店日ありの店舗数
            total_with_opening = db.session.query(
                func.count(func.distinct(Store.store_id))
            ).filter(Store.opening_date.isnot(None)).scalar() or 0

            # 補完が必要な件数
            remaining = db.session.query(func.count(func.distinct(Store.store_id))).filter(
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
                        Store.official_account.is_(None),
                        Store.official_account == "",
                    ),
                )
            ).scalar() or 0

            # 補完完了件数
            completed = total_with_opening - remaining if total_with_opening > 0 else 0
            completion_rate = (completed / total_with_opening * 100) if total_with_opening > 0 else 0

            # 電話番号あり
            with_phone = db.session.query(func.count(func.distinct(Store.store_id))).filter(
                Store.phone.isnot(None),
                Store.phone != "",
            ).scalar() or 0

            # ウェブサイトあり
            with_website = db.session.query(func.count(func.distinct(Store.store_id))).filter(
                Store.website.isnot(None),
                Store.website != "",
            ).scalar() or 0

            # 全項目完了
            fully_completed = db.session.query(func.count(func.distinct(Store.store_id))).filter(
                and_(
                    Store.opening_date.isnot(None),
                    Store.phone.isnot(None),
                    Store.phone != "",
                    Store.closed_day.isnot(None),
                    Store.closed_day != "",
                    Store.business_hours.isnot(None),
                    Store.business_hours != "",
                    Store.transport.isnot(None),
                    Store.transport != "",
                )
            ).scalar() or 0

            # 都市数（重複除く）
            cities_count = db.session.query(func.count(func.distinct(Store.city))).filter(
                Store.city.isnot(None),
                Store.city != "",
            ).scalar() or 0

            # 都市別店舗数（上位20都市）
            city_rows = (
                db.session.query(
                    Store.city,
                    func.count(func.distinct(Store.store_id)).label("cnt"),
                )
                .filter(Store.city.isnot(None), Store.city != "")
                .group_by(Store.city)
                .order_by(func.count(func.distinct(Store.store_id)).desc())
                .limit(20)
                .all()
            )
            city_stats = {city: count for city, count in city_rows if city}

            # 都道府県・エリア別統計用の定義（/api/areas, /api/prefectures と同等）
            PREFECTURES = [
                "北海道",
                "青森",
                "岩手",
                "宮城",
                "秋田",
                "山形",
                "福島",
                "茨城",
                "栃木",
                "群馬",
                "埼玉",
                "千葉",
                "東京",
                "神奈川",
                "新潟",
                "富山",
                "石川",
                "福井",
                "山梨",
                "長野",
                "岐阜",
                "静岡",
                "愛知",
                "三重",
                "滋賀",
                "京都",
                "大阪",
                "兵庫",
                "奈良",
                "和歌山",
                "鳥取",
                "島根",
                "岡山",
                "広島",
                "山口",
                "徳島",
                "香川",
                "愛媛",
                "高知",
                "福岡",
                "佐賀",
                "長崎",
                "熊本",
                "大分",
                "宮崎",
                "鹿児島",
                "沖縄",
            ]

            AREA_PREFECTURES = {
                "北海道": ["北海道"],
                "東北": ["青森", "岩手", "宮城", "秋田", "山形", "福島"],
                "関東": ["茨城", "栃木", "群馬", "埼玉", "千葉", "東京", "神奈川"],
                "中部": ["新潟", "富山", "石川", "福井", "山梨", "長野", "岐阜", "静岡", "愛知"],
                "近畿": ["三重", "滋賀", "京都", "大阪", "兵庫", "奈良", "和歌山"],
                "中国": ["鳥取", "島根", "岡山", "広島", "山口"],
                "四国": ["徳島", "香川", "愛媛", "高知"],
                "九州": ["福岡", "佐賀", "長崎", "熊本", "大分", "宮崎", "鹿児島", "沖縄"],
            }

            # 住所から都道府県を判定して集計
            prefecture_stats = {p: 0 for p in PREFECTURES}
            address_rows = db.session.query(Store.address).filter(
                Store.address.isnot(None),
                Store.address != "",
            ).all()
            for (addr,) in address_rows:
                for pref in PREFECTURES:
                    if addr.startswith(pref):
                        prefecture_stats[pref] += 1
                        break

            # エリア別に集計
            area_stats = {}
            for area, prefs in AREA_PREFECTURES.items():
                area_stats[area] = sum(prefecture_stats.get(p, 0) for p in prefs)

            # 取得率
            phone_rate = (with_phone / total_stores * 100) if total_stores > 0 else 0
            website_rate = (with_website / total_stores * 100) if total_stores > 0 else 0

            return jsonify(
                {
                    "total_stores": total_stores,
                    "total_with_opening": total_with_opening,
                    "with_opening_date_count": total_with_opening,
                    "remaining": remaining,
                    "completed": completed,
                    "completion_rate": completion_rate,
                    "with_phone": with_phone,
                    "with_website": with_website,
                    "fully_completed": fully_completed,
                    "fully_completed_with_opening": fully_completed,
                    "cities": cities_count,
                    "phone_rate": phone_rate,
                    "website_rate": website_rate,
                    "city_stats": city_stats,
                    "prefecture_stats": prefecture_stats,
                    "area_stats": area_stats,
                }
            )
        except Exception as e:
            import traceback
            return jsonify({"error": str(e), "traceback": traceback.format_exc()}), 500
    
    @app.route("/api/stores")
    def get_stores():
        """店舗データ一覧取得API"""
        try:
            from models import Store
            from sqlalchemy import or_, and_, func
            from sqlalchemy.exc import OperationalError
            
            page = int(request.args.get("page", 1))
            per_page = int(request.args.get("per_page", 100))
            search = request.args.get("search", "").strip() or None
            
            try:
                query = db.session.query(Store)

                # クエリパラメータ
                search = request.args.get("search", "").strip() or None
                search_mode = request.args.get("search_mode", "AND")
                match_type = request.args.get("match_type", "partial")
                prefectures = request.args.getlist("prefectures")
                cities = request.args.getlist("cities")

                # キーワード検索（店舗名・住所・カテゴリ）
                if search:
                    keywords = [k for k in search.split() if k]
                    if keywords:
                        conditions = []
                        for kw in keywords:
                            pattern = f"%{kw}%" if match_type == "partial" else kw
                            conditions.append(
                                or_(
                                    Store.name.ilike(pattern),
                                    Store.address.ilike(pattern),
                                    Store.category.ilike(pattern),
                                )
                            )
                        if search_mode.upper() == "OR":
                            query = query.filter(or_(*conditions))
                        else:
                            for cond in conditions:
                                query = query.filter(cond)

                # 都道府県フィルター（住所の先頭に都道府県名が含まれている前提）
                if prefectures:
                    prefecture_filters = []
                    for pref in prefectures:
                        prefecture_filters.append(
                            and_(
                                Store.address.isnot(None),
                                Store.address != "",
                                Store.address.like(f"{pref}%"),
                            )
                        )
                    query = query.filter(or_(*prefecture_filters))

                # 市区町村フィルター
                if cities:
                    query = query.filter(
                        Store.city.isnot(None),
                        Store.city != "",
                        Store.city.in_(cities),
                    )

                total_count = query.count()
                stores = query.order_by(Store.store_id).offset((page - 1) * per_page).limit(per_page).all()
                
                return jsonify({
                    "stores": [store.to_dict() for store in stores],
                    "total": total_count,
                    "page": page,
                    "per_page": per_page,
                    "total_pages": (total_count + per_page - 1) // per_page if total_count > 0 else 0,
                })
            except OperationalError as e:
                # テーブルが存在しない場合は空のリストを返す
                if 'no such table' in str(e).lower():
                    return jsonify({
                        "stores": [],
                        "total": 0,
                        "page": page,
                        "per_page": per_page,
                        "total_pages": 0,
                    })
                raise
        except Exception as e:
            import traceback
            return jsonify({"error": str(e), "traceback": traceback.format_exc()}), 500
    
    @app.route("/api/partner/saved-lists")
    def get_saved_lists():
        """保存済みリスト取得API（ダミー）"""
        return jsonify({"lists": []})
    
    @app.route("/api/admin/users", methods=['GET', 'POST'])
    def admin_users():
        """ユーザー管理API（GET: 一覧取得、POST: 新規作成）"""
        try:
            from models import User
            from sqlalchemy.exc import OperationalError
            import uuid
            from werkzeug.security import generate_password_hash
            
            if request.method == 'GET':
                # クエリパラメータ
                user_type = request.args.get('user_type', '').strip() or None
                is_active = request.args.get('is_active', '').strip()
                
                try:
                    query = db.session.query(User)
                    
                    if user_type:
                        query = query.filter(User.user_type == user_type)
                    
                    if is_active:
                        is_active_bool = is_active.lower() == 'true'
                        query = query.filter(User.is_active == is_active_bool)
                    
                    users = query.order_by(User.created_at.desc()).all()
                    
                    return jsonify({
                        "users": [{
                            "user_id": str(user.user_id),
                            "partner_code": user.partner_code,
                            "name": user.name,
                            "email": user.email,
                            "phone": user.phone,
                            "organization": user.organization,
                            "user_type": user.user_type,
                            "is_agency": user.is_agency,
                            "is_active": user.is_active,
                            "created_at": user.created_at.isoformat() if user.created_at else None,
                            "updated_at": user.updated_at.isoformat() if user.updated_at else None,
                            "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
                        } for user in users]
                    })
                except OperationalError as e:
                    if 'no such table' in str(e).lower():
                        return jsonify({"users": []})
                    raise
                    
            elif request.method == 'POST':
                # 新規ユーザー作成
                data = request.get_json()
                
                if not data:
                    return jsonify({"error": "リクエストボディが必要です"}), 400
                
                # 必須フィールドチェック
                required_fields = ['partner_code', 'password', 'name', 'user_type']
                for field in required_fields:
                    if field not in data or not data[field]:
                        return jsonify({"error": f"{field}は必須です"}), 400
                
                # パートナーコードの重複チェック
                existing = db.session.query(User).filter(
                    User.partner_code == data['partner_code']
                ).first()
                
                if existing:
                    return jsonify({"error": "このパートナーコードは既に使用されています"}), 400
                
                # 新規ユーザー作成
                new_user = User(
                    user_id=uuid.uuid4(),
                    partner_code=data['partner_code'],
                    password_hash=generate_password_hash(data['password']),
                    name=data['name'],
                    email=data.get('email'),
                    phone=data.get('phone'),
                    organization=data.get('organization'),
                    user_type=data['user_type'],
                    is_agency=data.get('is_agency', False),
                    is_active=data.get('is_active', True),
                    created_by=data.get('created_by', 'ADMIN'),
                    notes=data.get('notes')
                )
                
                db.session.add(new_user)
                db.session.commit()
                
                return jsonify({
                    "success": True,
                    "user": {
                        "user_id": str(new_user.user_id),
                        "partner_code": new_user.partner_code,
                        "name": new_user.name,
                    }
                }), 201
                
        except Exception as e:
            import traceback
            db.session.rollback()
            return jsonify({"error": str(e), "traceback": traceback.format_exc()}), 500
    
    @app.route("/api/admin/users/<user_id>", methods=['PUT', 'DELETE'])
    def admin_user_detail(user_id):
        """ユーザー管理API（PUT: 更新、DELETE: 削除）"""
        try:
            from models import User
            from sqlalchemy.exc import OperationalError
            from werkzeug.security import generate_password_hash
            
            try:
                user = db.session.query(User).filter(User.user_id == user_id).first()
                
                if not user:
                    return jsonify({"error": "ユーザーが見つかりません"}), 404
                    
            except OperationalError as e:
                if 'no such table' in str(e).lower():
                    return jsonify({"error": "ユーザーテーブルが存在しません"}), 404
                raise
            
            if request.method == 'PUT':
                # ユーザー更新
                data = request.get_json()
                
                if not data:
                    return jsonify({"error": "リクエストボディが必要です"}), 400
                
                # パートナーコードの重複チェック（自分以外）
                if 'partner_code' in data and data['partner_code'] != user.partner_code:
                    existing = db.session.query(User).filter(
                        User.partner_code == data['partner_code'],
                        User.user_id != user_id
                    ).first()
                    
                    if existing:
                        return jsonify({"error": "このパートナーコードは既に使用されています"}), 400
                
                # フィールド更新
                if 'partner_code' in data:
                    user.partner_code = data['partner_code']
                if 'password' in data and data['password']:
                    user.password_hash = generate_password_hash(data['password'])
                if 'name' in data:
                    user.name = data['name']
                if 'email' in data:
                    user.email = data['email']
                if 'phone' in data:
                    user.phone = data['phone']
                if 'organization' in data:
                    user.organization = data['organization']
                if 'user_type' in data:
                    user.user_type = data['user_type']
                if 'is_agency' in data:
                    user.is_agency = data['is_agency']
                if 'is_active' in data:
                    user.is_active = data['is_active']
                if 'notes' in data:
                    user.notes = data['notes']
                
                db.session.commit()
                
                return jsonify({
                    "success": True,
                    "user": {
                        "user_id": str(user.user_id),
                        "partner_code": user.partner_code,
                        "name": user.name,
                    }
                })
                
            elif request.method == 'DELETE':
                # ユーザー削除（論理削除: is_activeをFalseに）
                user.is_active = False
                db.session.commit()
                
                return jsonify({"success": True, "message": "ユーザーを無効化しました"})
                
        except Exception as e:
            import traceback
            db.session.rollback()
            return jsonify({"error": str(e), "traceback": traceback.format_exc()}), 500
    
    def _build_store_query():
        """店舗クエリを構築（フィルターパラメータ対応）"""
        from models import Store
        from sqlalchemy import or_, and_
        from sqlalchemy.exc import OperationalError
        
        try:
            query = db.session.query(Store)
            
            # クエリパラメータ
            search = request.args.get("search", "").strip() or None
            search_mode = request.args.get("search_mode", "AND")
            match_type = request.args.get("match_type", "partial")
            prefectures = request.args.getlist("prefectures")
            cities = request.args.getlist("cities")
            categories = request.args.getlist("categories")
            data_sources = request.args.getlist("data_sources")
            
            # キーワード検索（店舗名・住所・カテゴリ）
            if search:
                keywords = [k for k in search.split() if k]
                if keywords:
                    conditions = []
                    for kw in keywords:
                        pattern = f"%{kw}%" if match_type == "partial" else kw
                        conditions.append(
                            or_(
                                Store.name.ilike(pattern),
                                Store.address.ilike(pattern),
                                Store.category.ilike(pattern),
                            )
                        )
                    if search_mode.upper() == "OR":
                        query = query.filter(or_(*conditions))
                    else:
                        for cond in conditions:
                            query = query.filter(cond)
            
            # 都道府県フィルター
            if prefectures:
                prefecture_filters = []
                for pref in prefectures:
                    prefecture_filters.append(
                        and_(
                            Store.address.isnot(None),
                            Store.address != "",
                            Store.address.like(f"{pref}%"),
                        )
                    )
                query = query.filter(or_(*prefecture_filters))
            
            # 市区町村フィルター
            if cities:
                query = query.filter(
                    Store.city.isnot(None),
                    Store.city != "",
                    Store.city.in_(cities),
                )
            
            # カテゴリフィルター
            if categories:
                query = query.filter(
                    Store.category.isnot(None),
                    Store.category != "",
                    Store.category.in_(categories),
                )
            
            # データソースフィルター
            if data_sources:
                query = query.filter(
                    Store.data_source.isnot(None),
                    Store.data_source != "",
                    Store.data_source.in_(data_sources),
                )
            
            return query
        except OperationalError as e:
            if 'no such table' in str(e).lower():
                return None
            raise
    
    @app.route("/api/export/csv")
    def export_csv():
        """CSVエクスポートAPI"""
        try:
            from models import Store
            from flask import Response
            import csv
            import io
            from sqlalchemy.exc import OperationalError
            
            try:
                query = _build_store_query()
                if query is None:
                    # テーブルが存在しない場合は空のCSVを返す
                    output = io.StringIO()
                    writer = csv.writer(output)
                    writer.writerow(['店舗ID', '店舗名'])
                    output.seek(0)
                    return Response(
                        output.getvalue(),
                        mimetype='text/csv; charset=utf-8',
                        headers={'Content-Disposition': 'attachment; filename=stores_export.csv'}
                    )
                
                stores = query.all()
                
                output = io.StringIO()
                writer = csv.writer(output)
                
                # ヘッダー
                writer.writerow([
                    '店舗ID', '店舗名', '電話番号', 'ウェブサイト', '住所', 'カテゴリ',
                    '評価', '都市', '開店日', '定休日', '交通アクセス', '営業時間',
                    '公式アカウント', 'データソース'
                ])
                
                # データ
                for store in stores:
                    writer.writerow([
                        store.store_id, store.name, store.phone, store.website,
                        store.address, store.category, store.rating, store.city,
                        store.opening_date, store.closed_day, store.transport,
                        store.business_hours, store.official_account, store.data_source
                    ])
                
                output.seek(0)
                return Response(
                    output.getvalue(),
                    mimetype='text/csv; charset=utf-8',
                    headers={'Content-Disposition': 'attachment; filename=stores_export.csv'}
                )
            except OperationalError as e:
                if 'no such table' in str(e).lower():
                    # テーブルが存在しない場合は空のCSVを返す
                    output = io.StringIO()
                    writer = csv.writer(output)
                    writer.writerow(['店舗ID', '店舗名'])
                    output.seek(0)
                    return Response(
                        output.getvalue(),
                        mimetype='text/csv; charset=utf-8',
                        headers={'Content-Disposition': 'attachment; filename=stores_export.csv'}
                    )
                raise
        except Exception as e:
            import traceback
            return jsonify({"error": str(e), "traceback": traceback.format_exc()}), 500
    
    @app.route("/api/export/json")
    def export_json():
        """JSONエクスポートAPI"""
        try:
            from models import Store
            from flask import Response
            import json
            from sqlalchemy.exc import OperationalError
            
            try:
                query = _build_store_query()
                if query is None:
                    # テーブルが存在しない場合は空のJSONを返す
                    return Response(
                        json.dumps({"stores": []}, ensure_ascii=False, indent=2),
                        mimetype='application/json; charset=utf-8',
                        headers={'Content-Disposition': 'attachment; filename=stores_export.json'}
                    )
                
                stores = query.all()
                
                # 店舗データを辞書形式に変換
                stores_data = [store.to_dict() for store in stores]
                
                return Response(
                    json.dumps({"stores": stores_data}, ensure_ascii=False, indent=2),
                    mimetype='application/json; charset=utf-8',
                    headers={'Content-Disposition': 'attachment; filename=stores_export.json'}
                )
            except OperationalError as e:
                if 'no such table' in str(e).lower():
                    # テーブルが存在しない場合は空のJSONを返す
                    return Response(
                        json.dumps({"stores": []}, ensure_ascii=False, indent=2),
                        mimetype='application/json; charset=utf-8',
                        headers={'Content-Disposition': 'attachment; filename=stores_export.json'}
                    )
                raise
        except Exception as e:
            import traceback
            return jsonify({"error": str(e), "traceback": traceback.format_exc()}), 500
