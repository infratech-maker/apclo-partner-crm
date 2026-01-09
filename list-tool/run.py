"""アプリケーション起動スクリプト"""
import os
from app import create_app

# ローカル環境ではSQLite3を使用
config_name = os.getenv('FLASK_ENV', 'local')

# ローカル設定を登録
if config_name == 'local':
    import config_local
    import config
    config.config['local'] = config_local.LocalConfig

app = create_app(config_name)

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))  # 環境変数PORTが設定されていればそれを使用、なければ5000
    debug = os.getenv('FLASK_ENV', 'production') != 'production'  # 本番環境ではdebug=False
    print("=" * 50)
    print("Flaskサーバー起動")
    print("=" * 50)
    print(f"環境: {config_name}")
    print(f"デバッグモード: {debug}")
    print(f"アクセス: http://localhost:{port}")
    print("=" * 50)
    app.run(host='0.0.0.0', port=port, debug=debug)
