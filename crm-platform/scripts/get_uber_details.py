import pandas as pd
import time
import random
import re
import os
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.common.by import By

# ==========================================
# 設定エリア
# ==========================================
# 実行ディレクトリに応じてパスを調整してください
INPUT_FILE = "ubereats_list_phase1.csv"
OUTPUT_FILE = "ubereats_list_phase2_final.csv"
# ==========================================

def clean_phone_number(raw_text):
    """
    テキストから電話番号を抽出し、日本の形式(03...)に直す
    例: "店舗の電話番号：81369036068" -> "0369036068"
    """
    if not raw_text:
        return ""
    
    digits = re.sub(r'\D', '', raw_text)
    
    # UberEatsは国番号81がついていることが多い
    if digits.startswith("81") and len(digits) > 10:
        return "0" + digits[2:]
    
    return digits

def setup_driver():
    options = Options()
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--window-size=1280,1080")
    # ヘッドレスモードを無効化（デバッグ用）
    # options.add_argument("--headless") 
    
    service = Service(ChromeDriverManager().install())
    return webdriver.Chrome(service=service, options=options)

def main():
    print("🚀 Phase 2: 詳細データ収集を開始します...")

    # パス解決（スクリプト実行場所対策）
    base_dir = os.path.dirname(os.path.abspath(__file__))
    input_path = os.path.join(base_dir, INPUT_FILE)
    output_path = os.path.join(base_dir, OUTPUT_FILE)
    
    # ルートディレクトリからの実行にも対応
    if not os.path.exists(input_path):
        # カレントディレクトリを探す
        if os.path.exists(INPUT_FILE):
            input_path = INPUT_FILE
            output_path = OUTPUT_FILE
        else:
            print(f"❌ エラー: 入力ファイル {INPUT_FILE} が見つかりません。")
            print(f"   検索パス: {input_path}")
            return

    print(f"📂 読み込み元: {input_path}")
    df = pd.read_csv(input_path)
    
    # 保存用ファイルが既にあれば、それを読み込んで「続き」からやる
    if os.path.exists(output_path):
        print("🔄 既存のデータが見つかりました。続きから再開します。")
        df_existing = pd.read_csv(output_path)
        processed_urls = df_existing['URL'].tolist()
        df_to_process = df[~df['URL'].isin(processed_urls)].copy()
        # カラム構成を合わせる
        expected_cols = df.columns.tolist() + ['詳細住所', '電話番号', '詳細取得ステータス']
        if not all(col in df_existing.columns for col in ['詳細住所', '電話番号']):
             # 既存ファイルにカラムが足りない場合の対応
             df_result = pd.DataFrame(columns=expected_cols)
        else:
             df_result = df_existing
    else:
        print("🆕 新規作成します。")
        df_to_process = df.copy()

    total_count = len(df_to_process)
    if total_count == 0:
        print("✅ 全てのデータの処理が完了しています！")
        return

    print(f"残り {total_count} 件の処理を開始します。\n")

    driver = setup_driver()

    try:
        count = 0
        for index, row in df_to_process.iterrows():
            count += 1
            url = row['URL']
            store_name = row.get('店舗名', '不明')
            
            print(f"[{count}/{total_count}] アクセス中: {store_name[:15]}...")

            updated_data = row.to_dict()
            updated_data['詳細住所'] = ""
            updated_data['電話番号'] = ""
            updated_data['詳細取得ステータス'] = "Failed"

            try:
                driver.get(url)
                time.sleep(random.uniform(2, 4))
                
                # --- A. 電話番号の取得 ---
                try:
                    phone_elem = driver.find_element(By.XPATH, "//*[contains(text(), '店舗の電話番号')]")
                    phone_text = phone_elem.text
                    updated_data['電話番号'] = clean_phone_number(phone_text)
                except:
                    pass

                # --- B. 住所の取得 ---
                try:
                    p_tags = driver.find_elements(By.TAG_NAME, "p")
                    found_address = ""
                    for p in p_tags:
                        txt = p.text
                        if any(x in txt for x in ["都", "道", "府", "県"]) and any(c.isdigit() for c in txt):
                            if len(txt) < 50:
                                found_address = txt
                                break
                    
                    if not found_address:
                         try:
                             found_address = driver.find_element(By.XPATH, "//h1/following::p[1]").text
                         except:
                             pass
                    
                    updated_data['詳細住所'] = found_address
                except:
                    pass

                updated_data['詳細取得ステータス'] = "Success"
                print(f"   Ref: {updated_data['電話番号']} | Addr: {updated_data['詳細住所'][:10]}...")

            except Exception as e:
                print(f"   ⚠️ アクセスエラー: {e}")
            
            # 1件ずつ追記保存
            df_new_row = pd.DataFrame([updated_data])
            if not os.path.exists(output_path):
                df_new_row.to_csv(output_path, index=False, encoding="utf-8-sig")
            else:
                df_new_row.to_csv(output_path, mode='a', header=False, index=False, encoding="utf-8-sig")

    except KeyboardInterrupt:
        print("\n🛑 中断しました。")
    finally:
        print(f"\n📁 保存完了: {output_path}")
        driver.quit()

if __name__ == "__main__":
    main()



