import time
import pandas as pd
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys

# ==========================================
# 設定エリア
# ==========================================
# 保存するファイル名
OUTPUT_FILE = "ubereats_list_phase1.csv"

# スクロール回数 (1回あたり約3秒。20回で約1分。多いほど多くの店を取得します)
SCROLL_COUNT = 30 
# ==========================================

def main():
    print("🚀 Uber Eats リスト収集ツール (Phase 1) を起動します...")

    # ブラウザの設定
    options = Options()
    # 動作が見えるようにHeadlessモード（画面なし）はOFFにします
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    # ウィンドウサイズを固定（表示崩れ防止）
    options.add_argument("--window-size=1280,1080")
    
    # ブラウザ起動
    try:
        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=options)
    except Exception as e:
        print(f"❌ ブラウザの起動に失敗しました: {e}")
        return

    try:
        # 1. Uber Eatsトップを開く
        driver.get("https://www.ubereats.com/jp")
        
        print("\n" + "="*60)
        print("【 ✋ ユーザー操作待ち 】")
        print("自動操作を一時停止しています。立ち上がったブラウザで以下を行ってください：")
        print("  1. 『お届け先の住所』を入力・決定してください。")
        print("  2. 収集したいカテゴリ（例: 全て、和食、タピオカなど）をクリックしてリストを表示させてください。")
        print("  3. 準備ができたら、この黒い画面（ターミナル）に戻り『Enterキー』を押してください。")
        print("="*60 + "\n")
        
        # ユーザーの入力待ち
        input(">> 準備完了したらEnterを押してください...")

        print(f"\n🔄 スクロールを開始します（全 {SCROLL_COUNT} 回）...")
        
        # 2. 無限スクロール処理
        body = driver.find_element(By.TAG_NAME, "body")
        for i in range(SCROLL_COUNT):
            body.send_keys(Keys.PAGE_DOWN)
            time.sleep(1.5) # 読み込み待ち（通信環境により調整可）
            
            # 進捗表示
            if (i + 1) % 5 == 0:
                print(f"   ...スクロール中 ({i + 1}/{SCROLL_COUNT})")
        
        print("⏳ データ読み込み待機中...")
        time.sleep(3)

        # 3. データ抽出
        print("📥 画面上の店舗情報を収集中...")
        
        # 店舗リンク（aタグ）を収集
        # hrefに '/store/' が含まれ、かつ '/delivery/' などの余計なものが少ないものを狙う
        store_elements = driver.find_elements(By.XPATH, "//a[contains(@href, '/store/')]")
        
        data_list = []
        unique_urls = set()

        for elem in store_elements:
            try:
                url = elem.get_attribute("href")
                
                # URLチェック (重複除外、無効なリンク除外)
                if not url or url in unique_urls:
                    continue
                
                # テキスト情報の取得（店名、評価、手数料などが混ざったテキスト）
                text_content = elem.text.strip()
                if not text_content:
                    continue
                
                # 行ごとに分割して簡易解析
                lines = text_content.split('\n')
                store_name = lines[0] if lines else "取得失敗"

                # リストに追加
                data_list.append({
                    "店舗名": store_name,
                    "URL": url,
                    "元データ(テキスト)": text_content  # 後で詳細解析するために保存
                })
                unique_urls.add(url)
                
            except Exception as e:
                continue # エラーが出た要素はスキップ

        # 4. CSV保存
        if len(data_list) > 0:
            df = pd.DataFrame(data_list)
            # URLをキーに完全重複削除
            df = df.drop_duplicates(subset=["URL"])
            
            df.to_csv(OUTPUT_FILE, index=False, encoding="utf-8-sig")
            print(f"\n✅ 完了！ {len(df)} 件の店舗データを取得しました。")
            print(f"📁 保存先: {OUTPUT_FILE}")
        else:
            print("\n⚠️ 店舗データが見つかりませんでした。スクロールが足りないか、住所入力が完了していない可能性があります。")

    except Exception as e:
        print(f"\n❌ エラーが発生しました: {e}")
    
    finally:
        print("\n処理が終了しました。")
        input("ブラウザを閉じるにはEnterを押してください...")
        driver.quit()

if __name__ == "__main__":
    main()



