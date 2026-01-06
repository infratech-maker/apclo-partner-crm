import time
import pandas as pd
import random
import os
import threading
import requests
from datetime import datetime, timedelta
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

# ==========================================
# ⚙️ 設定エリア
# ==========================================
# 収集したいエリアの郵便番号リスト
TARGET_LOCATIONS = [
    "150-0043", # 渋谷区道玄坂
    "160-0022", # 新宿区新宿
    "106-0032", # 港区六本木
    "171-0014", # 豊島区池袋
    "104-0061", # 中央区銀座
]

# 1エリアあたりのスクロール回数
SCROLL_COUNT = 30 

# 保存ファイル名
OUTPUT_FILE = "ubereats_list_auto_collected.csv"

# Slack通知設定
SLACK_WEBHOOK_URL = os.getenv("SLACK_WEBHOOK_URL")
NOTIFICATION_INTERVAL_HOURS = 1  # 1時間ごとに通知
# ==========================================

def send_slack_notification(message: str, color: str = "info"):
    """Slack通知を送信"""
    if not SLACK_WEBHOOK_URL:
        return
    
    try:
        color_map = {
            "good": "#36a64f",
            "warning": "#ff9900",
            "danger": "#ff0000",
            "info": "#439fe0",
        }
        
        payload = {
            "attachments": [
                {
                    "color": color_map.get(color, "#439fe0"),
                    "text": message,
                    "footer": "UberEats List Collection (Auto)",
                    "ts": int(time.time()),
                }
            ]
        }
        
        response = requests.post(
            SLACK_WEBHOOK_URL,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if response.status_code != 200:
            print(f"⚠️ Slack通知の送信に失敗しました: {response.status_code}")
    except Exception as e:
        print(f"⚠️ Slack通知の送信中にエラーが発生しました: {e}")

def get_progress_stats(output_path: str, total_locations: int, current_location_index: int, start_time: float):
    """進行状況の統計を取得"""
    try:
        if os.path.exists(output_path):
            df = pd.read_csv(output_path)
            collected_count = len(df)
        else:
            collected_count = 0
        
        elapsed_time = time.time() - start_time
        elapsed_hours = elapsed_time / 3600
        elapsed_minutes = (elapsed_time % 3600) / 60
        
        progress_percent = (current_location_index / total_locations * 100) if total_locations > 0 else 0
        
        return {
            "collected_count": collected_count,
            "current_location": current_location_index,
            "total_locations": total_locations,
            "progress_percent": progress_percent,
            "elapsed_hours": int(elapsed_hours),
            "elapsed_minutes": int(elapsed_minutes),
        }
    except Exception as e:
        print(f"⚠️ 統計取得エラー: {e}")
        return None

def hourly_notification_worker(output_path: str, total_locations: int, current_location_index_ref: list, start_time_ref: list, stop_event: threading.Event):
    """1時間ごとにSlack通知を送信するワーカースレッド"""
    while not stop_event.is_set():
        # 1時間待機
        stop_event.wait(NOTIFICATION_INTERVAL_HOURS * 3600)
        
        if stop_event.is_set():
            break
        
        # 進行状況を取得
        stats = get_progress_stats(
            output_path,
            total_locations,
            current_location_index_ref[0] if current_location_index_ref else 0,
            start_time_ref[0] if start_time_ref else time.time()
        )
        
        if stats:
            message = (
                f"📊 UberEatsリスト収集 - 進行状況レポート\n\n"
                f"⏱️ 経過時間: {stats['elapsed_hours']}時間{stats['elapsed_minutes']}分\n"
                f"📍 処理済みエリア: {stats['current_location']}/{stats['total_locations']} ({stats['progress_percent']:.1f}%)\n"
                f"✅ 収集済みURL数: {stats['collected_count']}件\n"
                f"🔄 処理継続中..."
            )
            send_slack_notification(message, "info")

def setup_driver():
    options = Options()
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--window-size=1280,1080")
    # options.add_argument("--headless") # 安定したら有効化
    
    # Bot判定回避設定
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_argument("user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
    
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=options)
    return driver

def check_for_captcha_or_block(driver):
    """CAPTCHAやブロック画面を検知する"""
    try:
        # ページのテキストを取得
        page_text = driver.find_element(By.TAG_NAME, "body").text.lower()
        page_source = driver.page_source.lower()
        
        # 検知キーワード
        captcha_keywords = [
            'captcha', 'ロボット', 'robot', 'ブロック', 'block', 
            'verify', 'verification', 'challenge', 'access denied',
            'アクセス拒否', 'アクセスブロック', 'bot detection'
        ]
        
        # キーワードをチェック
        for keyword in captcha_keywords:
            if keyword in page_text or keyword in page_source:
                return True, keyword
        
        # HTTPステータスコードのチェック（403, 429など）
        # Seleniumでは直接取得できないが、ページタイトルや特定の要素で判断可能
        
        return False, None
    except Exception as e:
        # エラー時は検知なしとして扱う
        return False, None

def set_location(driver, location_text):
    """住所を入力して設定する"""
    wait = WebDriverWait(driver, 15)
    try:
        # 入力欄を探す
        input_box = wait.until(EC.element_to_be_clickable((By.XPATH, "//input[contains(@id, 'location-typeahead')]")))
        
        # 既存入力をクリア
        input_box.click()
        input_box.send_keys(Keys.COMMAND + "a") 
        input_box.send_keys(Keys.DELETE)
        time.sleep(1)

        # 入力
        print(f"   ⌨️ 住所入力中: {location_text}")
        for char in location_text:
            input_box.send_keys(char)
            time.sleep(random.uniform(0.1, 0.3))
        
        # 候補待ち
        time.sleep(3) 
        
        # 最初の候補をクリック
        first_option = wait.until(EC.element_to_be_clickable((By.XPATH, "//ul[contains(@id, 'location-typeahead')]//li[1]")))
        first_option.click()
        
        print("   ✅ 住所選択完了。遷移待ち...")
        time.sleep(5)
        return True

    except Exception as e:
        print(f"   ⚠️ 住所設定エラー: {e}")
        return False

def collect_urls(driver, location_name):
    """URL収集"""
    print(f"   🔄 スクロール開始 ({SCROLL_COUNT}回)...")
    body = driver.find_element(By.TAG_NAME, "body")
    
    for i in range(SCROLL_COUNT):
        # スクロール前に検知チェック（10回ごと）
        if i > 0 and i % 10 == 0:
            is_blocked, keyword = check_for_captcha_or_block(driver)
            if is_blocked:
                print(f"\n   🚨 スクロール中にボット検知が検出されました！")
                print(f"      検出キーワード: {keyword}")
                print(f"      安全のため、このエリアの処理を中断します。")
                return []  # 空のリストを返して中断
        
        body.send_keys(Keys.PAGE_DOWN)
        time.sleep(random.uniform(1.0, 1.5))
    
    store_elements = driver.find_elements(By.XPATH, "//a[contains(@href, '/store/')]")
    
    collected = []
    for elem in store_elements:
        try:
            url = elem.get_attribute("href")
            text = elem.text.split('\n')[0] if elem.text else "名称取得失敗"
            
            if url and "diningMode" in url:
                collected.append({
                    "検索エリア": location_name,
                    "店舗名": text,
                    "URL": url
                })
        except:
            continue
    return collected

def main():
    print("🚀 Uber Eats 完全自動リスト収集 (Bulk Mode) を開始します...")
    
    # パス解決
    base_dir = os.path.dirname(os.path.abspath(__file__))
    output_path = os.path.join(base_dir, OUTPUT_FILE)
    
    # 開始時刻を記録
    start_time = time.time()
    total_locations = len(TARGET_LOCATIONS)
    current_location_index = 0
    
    # 進行状況を共有するための参照（リストでラップ）
    current_location_index_ref = [0]
    start_time_ref = [start_time]
    
    # 通知スレッドの停止イベント
    stop_event = threading.Event()
    
    # 1時間ごとの通知スレッドを開始
    notification_thread = threading.Thread(
        target=hourly_notification_worker,
        args=(output_path, total_locations, current_location_index_ref, start_time_ref, stop_event),
        daemon=True
    )
    notification_thread.start()
    
    # 開始通知
    start_message = (
        f"🚀 UberEatsリスト収集を開始しました\n\n"
        f"📍 対象エリア数: {total_locations}エリア\n"
        f"📋 エリアリスト: {', '.join(TARGET_LOCATIONS[:5])}{'...' if len(TARGET_LOCATIONS) > 5 else ''}\n"
        f"⏱️ 開始時刻: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
    )
    send_slack_notification(start_message, "info")
    
    driver = setup_driver()
    all_count = 0
    
    try:
        for idx, loc in enumerate(TARGET_LOCATIONS):
            current_location_index = idx + 1
            current_location_index_ref[0] = current_location_index
            print(f"\n📍 ターゲットエリア: {loc} の処理を開始")
            
            # 【重要】Cookie削除（リセット）
            driver.delete_all_cookies()
            driver.get("https://www.ubereats.com/jp")
            time.sleep(3)
            
            # CAPTCHA/ブロック検知チェック（トップページ読み込み後）
            is_blocked, keyword = check_for_captcha_or_block(driver)
            if is_blocked:
                print(f"\n🚨 ボット検知が検出されました！")
                print(f"   検出キーワード: {keyword}")
                print(f"   安全のため、処理を中断します。")
                print(f"   ブラウザを確認して、手動で解決してください。")
                print(f"\n⚠️ 中断時点までのデータは保存されています。")
                break  # ループを中断
            
            if set_location(driver, loc):
                # 住所設定後のページでも検知チェック
                time.sleep(2)  # ページ遷移待ち
                is_blocked, keyword = check_for_captcha_or_block(driver)
                if is_blocked:
                    print(f"\n🚨 ボット検知が検出されました！")
                    print(f"   検出キーワード: {keyword}")
                    print(f"   安全のため、処理を中断します。")
                    print(f"   ブラウザを確認して、手動で解決してください。")
                    print(f"\n⚠️ 中断時点までのデータは保存されています。")
                    break  # ループを中断
                data = collect_urls(driver, loc)
                if data:
                    print(f"   🎉 {len(data)} 件取得")
                    all_count += len(data)
                    
                    # 追記保存
                    df = pd.DataFrame(data)
                    df = df.drop_duplicates(subset=["URL"])
                    
                    if not os.path.exists(output_path):
                        df.to_csv(output_path, index=False, encoding="utf-8-sig")
                    else:
                        df.to_csv(output_path, mode='a', header=False, index=False, encoding="utf-8-sig")
                else:
                    print("   ⚠️ データ取得数 0件")
            else:
                print("   ❌ エリア設定失敗のためスキップ")

    except KeyboardInterrupt:
        print("\n🛑 中断しました")
        stop_event.set()
        
        # 中断通知
        stats = get_progress_stats(output_path, total_locations, current_location_index, start_time)
        if stats:
            interrupt_message = (
                f"🛑 UberEatsリスト収集が中断されました\n\n"
                f"⏱️ 経過時間: {stats['elapsed_hours']}時間{stats['elapsed_minutes']}分\n"
                f"📍 処理済みエリア: {stats['current_location']}/{stats['total_locations']}\n"
                f"✅ 収集済みURL数: {stats['collected_count']}件\n"
                f"⚠️ 中断時点までのデータは保存されています"
            )
            send_slack_notification(interrupt_message, "warning")
    except Exception as e:
        print(f"\n❌ エラーが発生しました: {e}")
        stop_event.set()
        
        # エラー通知
        stats = get_progress_stats(output_path, total_locations, current_location_index, start_time)
        if stats:
            error_message = (
                f"❌ UberEatsリスト収集でエラーが発生しました\n\n"
                f"⏱️ 経過時間: {stats['elapsed_hours']}時間{stats['elapsed_minutes']}分\n"
                f"📍 処理済みエリア: {stats['current_location']}/{stats['total_locations']}\n"
                f"✅ 収集済みURL数: {stats['collected_count']}件\n"
                f"❌ エラー: {str(e)}"
            )
            send_slack_notification(error_message, "danger")
    finally:
        stop_event.set()  # 通知スレッドを停止
        driver.quit()
        
        # 完了通知
        total_time = time.time() - start_time
        total_hours = int(total_time / 3600)
        total_minutes = int((total_time % 3600) / 60)
        
        final_stats = get_progress_stats(output_path, total_locations, current_location_index, start_time)
        if final_stats:
            completion_message = (
                f"✅ UberEatsリスト収集が完了しました\n\n"
                f"⏱️ 総処理時間: {total_hours}時間{total_minutes}分\n"
                f"📍 処理エリア数: {final_stats['current_location']}/{total_locations}\n"
                f"✅ 収集URL数: {final_stats['collected_count']}件\n"
                f"📁 保存先: {output_path}"
            )
            send_slack_notification(completion_message, "good")
        
        print(f"\n✅ 処理完了。保存先: {output_path}")

if __name__ == "__main__":
    main()

