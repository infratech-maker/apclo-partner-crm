"""ngrok経由でアプリケーション起動スクリプト"""
import os
import sys
import time
import subprocess
import signal
import threading
from app import create_app

# ローカル環境ではSQLite3を使用
config_name = os.getenv('FLASK_ENV', 'local')

# ローカル設定を登録
if config_name == 'local':
    import config_local
    import config
    config.config['local'] = config_local.LocalConfig

app = create_app(config_name)

def start_ngrok(port=8000):
    """ngrokを起動してURLを取得"""
    try:
        # ngrokがインストールされているか確認
        result = subprocess.run(['which', 'ngrok'], capture_output=True, text=True)
        if result.returncode != 0:
            print("⚠️  ngrokがインストールされていません。")
            print("")
            print("インストール方法:")
            print("  macOS: brew install ngrok/ngrok/ngrok")
            print("  または: https://ngrok.com/download からダウンロード")
            print("")
            print("ngrokを使用しない場合は、通常の起動方法を使用してください:")
            print("  python run.py")
            return None
        
        # 既存のngrokプロセスを終了
        try:
            subprocess.run(['pkill', '-f', 'ngrok http'], 
                         capture_output=True, stderr=subprocess.DEVNULL)
            time.sleep(1)
        except:
            pass
        
        # ngrokを起動
        print("🌐 ngrokを起動しています...")
        ngrok_process = subprocess.Popen(
            ['ngrok', 'http', str(port)],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        
        # ngrokのAPIからURLを取得
        time.sleep(3)
        try:
            import urllib.request
            import json
            response = urllib.request.urlopen('http://localhost:4040/api/tunnels', timeout=5)
            data = json.loads(response.read().decode())
            
            if data.get('tunnels'):
                public_url = data['tunnels'][0]['public_url']
                print(f"✅ ngrok URL: {public_url}")
                print(f"   barius.html: {public_url}/barius.html")
                return ngrok_process, public_url
            else:
                print("⚠️  ngrokのトンネルが見つかりませんでした")
                print("   ngrok管理画面: http://localhost:4040 で確認してください")
                return ngrok_process, None
        except Exception as e:
            print(f"⚠️  ngrokのURLを取得できませんでした: {e}")
            print("   ngrok管理画面: http://localhost:4040 で確認してください")
            return ngrok_process, None
            
    except Exception as e:
        print(f"❌ ngrokの起動に失敗しました: {e}")
        return None

def cleanup(signum, frame):
    """クリーンアップ処理"""
    print("\n🛑 サーバーを停止しています...")
    sys.exit(0)

if __name__ == '__main__':
    # シグナルハンドラーを設定
    signal.signal(signal.SIGINT, cleanup)
    signal.signal(signal.SIGTERM, cleanup)
    
    print("=" * 50)
    print("Flaskサーバー起動 (ngrok経由)")
    print("=" * 50)
    print(f"環境: {config_name}")
    print(f"ローカル: http://localhost:8000")
    print("=" * 50)
    print("")
    
    # ngrokを起動
    ngrok_result = start_ngrok(8000)
    
    if ngrok_result:
        ngrok_process, ngrok_url = ngrok_result
        print("")
        print("=" * 50)
        print("サーバー情報")
        print("=" * 50)
        print(f"ローカル: http://localhost:8000")
        if ngrok_url:
            print(f"ngrok:   {ngrok_url}")
            print(f"barius:  {ngrok_url}/barius.html")
        print("ngrok管理画面: http://localhost:4040")
        print("")
        print("停止: Ctrl+C")
        print("=" * 50)
        print("")
    else:
        print("")
        print("ローカルサーバーのみ起動します")
        print("停止: Ctrl+C")
        print("")
    
    try:
        # Flaskサーバーを起動
        app.run(host='0.0.0.0', port=8000, debug=True)
    except KeyboardInterrupt:
        cleanup(None, None)
    finally:
        # ngrokプロセスを終了
        if ngrok_result and ngrok_result[0]:
            try:
                ngrok_result[0].terminate()
            except:
                pass



