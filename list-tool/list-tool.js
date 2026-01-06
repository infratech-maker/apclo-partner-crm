// ログイン確認（既にhead内でチェック済みのため、ここでは表示のみ）
function checkLogin() {
    const currentPartnerId = sessionStorage.getItem("currentPartnerId");
    const isAdmin = sessionStorage.getItem("isAdmin") === "true";
    
    if (!currentPartnerId) {
window.location.href = "/login";
return false;
    }
    
    // パートナーIDを表示（管理者の場合は「マスター管理者」と表示）
    if (isAdmin) {
document.getElementById("partner-id-display").textContent = "マスター管理者";
    } else {
document.getElementById("partner-id-display").textContent = `パートナーID: ${currentPartnerId}`;
    }
    return true;
}

// ログアウト
document.getElementById("btn-logout").addEventListener("click", () => {
    sessionStorage.removeItem("currentPartnerId");
    sessionStorage.removeItem("isAdmin");
    window.location.href = "/login";
});

// データソース名を正規化する関数
function normalizeDataSourceName(sourceName) {
    if (!sourceName) return '';
    const normalized = sourceName.toLowerCase().trim();
    // マッピング: フィルター値とデータベース値の対応
    const mapping = {
'ubereats': 'ubereats',
'uber eats': 'ubereats',
'uber_eats': 'ubereats',
'wolt': 'wolt',
'ウォルト': 'wolt',
'demaecan': 'demaecan',
'出前館': 'demaecan',
'tabelog': 'tabelog',
'食べログ': 'tabelog',
'gnavi': 'gnavi',
'ぐるなび': 'gnavi',
'gurunavi': 'gnavi'
    };
    // マッピングに存在する場合は正規化された値を返す
    for (const [key, value] of Object.entries(mapping)) {
if (normalized === key.toLowerCase() || normalized.includes(key.toLowerCase())) {
    return value;
}
    }
    // マッピングにない場合は小文字化して返す
    return normalized;
}

// データソースフィルターのUIを動的に生成
function renderDataSourceFilter() {
    const container = document.getElementById('data-source-filter-container');
    if (!container) return;
    
    container.innerHTML = '';
    DATA_SOURCES.forEach(source => {
const label = document.createElement('label');
label.className = 'flex items-center p-2 hover:bg-gray-100 cursor-pointer rounded';
const checkbox = document.createElement('input');
checkbox.type = 'checkbox';
checkbox.value = source.value;
checkbox.className = 'mr-2 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 data-source-checkbox';
checkbox.checked = true; // デフォルトで全選択
const span = document.createElement('span');
span.className = 'text-sm text-gray-700';
span.textContent = source.label;
label.appendChild(checkbox);
label.appendChild(span);
container.appendChild(label);
    });
    
    // イベントリスナーを設定
    document.querySelectorAll('.data-source-checkbox').forEach(checkbox => {
checkbox.addEventListener('change', (e) => {
    const sourceValue = e.target.value;
    if (e.target.checked) {
if (!currentFilters.dataSources.includes(sourceValue)) {
    currentFilters.dataSources.push(sourceValue);
}
    } else {
const index = currentFilters.dataSources.indexOf(sourceValue);
if (index > -1) currentFilters.dataSources.splice(index, 1);
    }
    
    // ヘッダーのデータソースフィルターも同期
    syncHeaderDataSourceFilter();
    
    loadStores(1);
});
    });
    
    // 初期状態で全選択
    currentFilters.dataSources = DATA_SOURCES.map(s => s.value);
    
    // ヘッダーのデータソースフィルターも同期
    syncHeaderDataSourceFilter();
}

// ヘッダーのデータソースフィルターと左側フィルターを同期
function syncHeaderDataSourceFilter() {
    const headerCheckboxes = document.querySelectorAll('#header-filter-values-data_source input[type="checkbox"]:not([id*="all"])');
    headerCheckboxes.forEach(cb => {
const sourceValue = cb.value;
const isSelected = currentFilters.dataSources.includes(sourceValue);
cb.checked = isSelected;

// headerFilterDataも更新
if (isSelected) {
    if (!headerFilterData.data_source.selected.includes(sourceValue)) {
headerFilterData.data_source.selected.push(sourceValue);
    }
} else {
    const index = headerFilterData.data_source.selected.indexOf(sourceValue);
    if (index > -1) {
headerFilterData.data_source.selected.splice(index, 1);
    }
}
    });
}

// 左側のデータソースフィルターとヘッダーフィルターを同期
function syncLeftDataSourceFilter() {
    const headerCheckboxes = document.querySelectorAll('#header-filter-values-data_source input[type="checkbox"]:not([id*="all"])');
    const selectedSources = [];
    headerCheckboxes.forEach(cb => {
if (cb.checked) {
    selectedSources.push(cb.value);
}
    });
    
    // 左側フィルターを更新
    currentFilters.dataSources = selectedSources;
    document.querySelectorAll('.data-source-checkbox').forEach(cb => {
cb.checked = selectedSources.includes(cb.value);
    });
}

// 住所を表示用に簡易正規化する関数
function normalizeAddressToJapanese(address) {
    if (!address || address === '未取得') {
return address;
    }
    
    let result = address;
    
    // "日本、" を除去（Geocoding APIの結果から）
    result = result.replace(/^日本[、,]\s*/g, '');
    
    // "Japan, " を除去
    result = result.replace(/^Japan,\s*/g, '');
    
    // 重複する郵便番号を除去（最初の1つだけ残す）
    const postalMatches = result.match(/〒(\d{3}-?\d{4})/g);
    if (postalMatches && postalMatches.length > 1) {
const firstPostal = postalMatches[0];
result = result.replace(/〒\d{3}-?\d{4}/g, '');
result = `${firstPostal} ${result}`.trim();
    }
    
    // 重複する都道府県名を除去（最初の1つだけ残す）
    const prefecturePattern = /(東京都|大阪府|京都府|神奈川県|愛知県|兵庫県|福岡県|北海道|埼玉県|千葉県)/g;
    const prefectureMatches = result.match(prefecturePattern);
    if (prefectureMatches && prefectureMatches.length > 1) {
const firstPrefecture = prefectureMatches[0];
result = result.replace(prefecturePattern, '');
// 郵便番号の後に都道府県を配置
if (result.match(/^〒/)) {
    result = result.replace(/^(〒\d{3}-?\d{4})\s*/, `$1 ${firstPrefecture}`);
} else {
    result = `${firstPrefecture}${result}`;
}
    }
    
    // 英語表記を除去（Tokyo, City, Wardなど）
    result = result.replace(/\b(Tokyo|Osaka|Kyoto|Kanagawa|Aichi|Hyogo|Fukuoka|Hokkaido|Saitama|Chiba)\b/gi, '');
    result = result.replace(/\b(City|Ward)\b/gi, '');
    
    // 余分な空白を整理
    result = result.replace(/\s+/g, ' ').trim();
    
    return result || address;
}

// タブ切り替えロジック
function switchTab(tab) {
    const tabButtons = document.querySelectorAll('.lt-tab');
    tabButtons.forEach(btn => {
if (btn.dataset.tab === tab) {
    btn.classList.add('lt-tab-active');
} else {
    btn.classList.remove('lt-tab-active');
}
    });

    const statsSection = document.getElementById('stats-section');
    const chartsSection = document.getElementById('charts-section');
    const searchSection = document.getElementById('search-section');
    const savedListsSection = document.getElementById('saved-lists-section');
    const storesSection = document.getElementById('stores-section');
    const myListSection = document.getElementById('mylist-section');

    if (tab === 'dashboard') {
// ダッシュボードタブ：統計情報 + グラフ + 保存したリスト管理
if (statsSection) statsSection.style.display = '';
if (chartsSection) chartsSection.style.display = '';
if (savedListsSection) savedListsSection.style.display = '';
if (searchSection) searchSection.style.display = 'none';
if (storesSection) storesSection.style.display = 'none';
if (myListSection) myListSection.style.display = 'none';
    } else if (tab === 'search') {
// 検索タブ：検索・フィルター + 店舗リスト
if (statsSection) statsSection.style.display = 'none';
if (chartsSection) chartsSection.style.display = 'none';
if (savedListsSection) savedListsSection.style.display = 'none';
if (searchSection) searchSection.style.display = '';
if (storesSection) storesSection.style.display = '';
if (myListSection) myListSection.style.display = 'none';
    } else if (tab === 'mylist') {
// MYリスト表示タブ：お気に入り・ダウンロード済みリスト
if (statsSection) statsSection.style.display = 'none';
if (chartsSection) chartsSection.style.display = 'none';
if (savedListsSection) savedListsSection.style.display = 'none';
if (searchSection) searchSection.style.display = 'none';
if (storesSection) storesSection.style.display = 'none';
if (myListSection) myListSection.style.display = '';
    }
}

// ログイン確認を実行
if (!checkLogin()) {
    // リダイレクトされるので、ここには到達しない
}

// 管理者/パートナーに応じてサイドバーメニューを切り替え
const isAdmin = sessionStorage.getItem("isAdmin") === "true";
const partnerMenu = document.getElementById('partner-menu');
const adminMenu = document.getElementById('admin-menu');
const sidebarTitle = document.getElementById('sidebar-title');

if (isAdmin) {
    // 管理者の場合
    if (partnerMenu) partnerMenu.style.display = 'none';
    if (adminMenu) adminMenu.style.display = 'block';
    if (sidebarTitle) sidebarTitle.textContent = 'Admin Board';
} else {
    // 一般パートナーの場合
    if (partnerMenu) partnerMenu.style.display = 'block';
    if (adminMenu) adminMenu.style.display = 'none';
    if (sidebarTitle) sidebarTitle.textContent = 'List Board';
}

// 以下、templates/dashboard.htmlのJavaScriptコードをそのまま使用
// （長いので、主要な関数のみ記載。実際にはtemplates/dashboard.htmlのスクリプト部分をコピー）

let currentPage = 1;
let searchKeywords = [];
let allCategoriesData = [];
// データソース設定（将来的に新しいデータソースが追加される場合はここに追加）
const DATA_SOURCES = [
    { value: 'ubereats', label: 'Ubereats' },
    { value: 'wolt', label: 'ウォルト' },
    { value: 'demaecan', label: '出前館' },
    { value: 'tabelog', label: '食べログ' },
    { value: 'gnavi', label: 'ぐるなび' }
];

let currentFilters = {
    prefectures: [],
    cities: [],
    categories: [],
    dataSources: [], // deliveryServicesからdataSourcesに変更
    search: '',
    searchMode: 'AND',
    matchType: 'partial',
    phone: '',
    website: '',
    ratingOperator: '>=',
    ratingValue: '',
    // ヘッダーフィルター（後続の処理で使用）
    headerName: '',
    headerAddress: '',
    headerContact: '',
    headerCategory: '',
    headerDelivery: '',
    headerStatus: '',
    headerClosedDay: '',
    headerOpeningDate: '',
    headerTransport: '',
    headerBusinessHours: '',
    headerOfficialAccount: '',
    headerCollectedAt: ''
};

// データソース名を正規化する関数（フィルター概要でも使用）
function normalizeDataSourceNameForDisplay(sourceName) {
    if (!sourceName) return '';
    const source = DATA_SOURCES.find(s => s.value === sourceName);
    return source ? source.label : sourceName;
}

// アクティブフィルター概要を更新
function updateActiveFiltersBar(currentCount, totalCount) {
    const bar = document.getElementById('active-filters-bar');
    const chipsContainer = document.getElementById('active-filters-chips');
    if (!bar || !chipsContainer) return;

    const chips = [];

    if (currentFilters.search) {
chips.push(`キーワード: ${currentFilters.search}`);
    }
    if (currentFilters.prefectures.length > 0) {
chips.push(`都道府県: ${currentFilters.prefectures.join(', ')}`);
    }
    if (currentFilters.cities.length > 0) {
chips.push(`市区町村: ${currentFilters.cities.join(', ')}`);
    }
    if (currentFilters.categories.length > 0) {
chips.push(`カテゴリ: ${currentFilters.categories.join(', ')}`);
    }
    if (currentFilters.dataSources.length > 0 && currentFilters.dataSources.length < DATA_SOURCES.length) {
const sourceLabels = currentFilters.dataSources.map(s => normalizeDataSourceNameForDisplay(s));
chips.push(`データソース: ${sourceLabels.join(', ')}`);
    }
    if (currentFilters.phone) {
chips.push(`電話: ${currentFilters.phone}`);
    }
    if (currentFilters.website) {
chips.push(`サイト: ${currentFilters.website}`);
    }
    if (currentFilters.ratingValue) {
chips.push(`評価: ${currentFilters.ratingOperator} ${currentFilters.ratingValue}`);
    }

    // ヘッダーフィルター簡易表示
    if (currentFilters.headerName) chips.push('店舗名フィルター');
    if (currentFilters.headerAddress) chips.push('住所フィルター');
    if (currentFilters.headerContact) chips.push('連絡先フィルター');
    if (currentFilters.headerCategory) chips.push('カテゴリーフィルター');
    if (currentFilters.headerDelivery) chips.push('デリバリーサービスフィルター');
    if (currentFilters.dataSources.length > 0 && currentFilters.dataSources.length < DATA_SOURCES.length) {
const sourceLabels = currentFilters.dataSources.map(s => normalizeDataSourceNameForDisplay(s));
chips.push(`データソース: ${sourceLabels.join(', ')}`);
    }
    if (currentFilters.headerStatus) chips.push('ステータスフィルター');
    if (currentFilters.headerClosedDay) chips.push('定休日フィルター');
    if (currentFilters.headerOpeningDate) chips.push('オープン日フィルター');
    if (currentFilters.headerTransport) chips.push('交通手段フィルター');
    if (currentFilters.headerBusinessHours) chips.push('営業時間フィルター');
    if (currentFilters.headerOfficialAccount) chips.push('公式アカウントフィルター');
    if (currentFilters.headerCollectedAt) chips.push('リスト収集日フィルター');

    chipsContainer.innerHTML = '';

    if (chips.length === 0) {
bar.classList.add('hidden');
return;
    }

    chips.forEach(text => {
const chip = document.createElement('span');
chip.className = 'inline-flex items-center px-3 py-1 rounded-full bg-gray-100 text-gray-700';
chip.textContent = text;
chipsContainer.appendChild(chip);
    });

    bar.classList.remove('hidden');
}

// APIベースURL（Flaskアプリが動いている場合）
// const API_BASE = ''; // 下で再定義されるためコメントアウト

document.addEventListener('DOMContentLoaded', async () => {
    loadStats();
    loadAreas();
    loadPrefectures();
    loadCategories();
    loadStores();
    try {
await displaySavedLists();
    } catch (error) {
console.error('リスト表示エラー:', error);
const container = document.getElementById('saved-lists-container');
if (container) {
    container.innerHTML = '<p class="text-center text-red-500 py-4">リストの読み込みに失敗しました。ページをリロードしてください。</p>';
}
    }
    
    // 全選択チェックボックス
    document.getElementById('select-all-checkbox').addEventListener('change', (e) => {
const checkboxes = document.querySelectorAll('.store-checkbox');
checkboxes.forEach(cb => cb.checked = e.target.checked);
updateSelectedCount();
    });
    
    // 選択した店舗を保存
    document.getElementById('btn-save-selected').addEventListener('click', saveSelectedStores);
    
    // 現在の検索結果を保存
    document.getElementById('btn-save-current-list').addEventListener('click', saveCurrentSearchResults);
    
    // 初期フィルター設定
    filterListsByStatus('all');
    
    // 全リストを地図表示
    const allMapBtn = document.getElementById('btn-show-all-on-map');
    if (allMapBtn) {
allMapBtn.addEventListener('click', async () => {
    const lists = await getSavedLists();
    const allStores = [];
    lists.forEach(list => {
list.stores.forEach(store => {
    // 重複チェック
    const exists = allStores.some(s => 
(s.store_id && store.store_id && s.store_id === store.store_id) ||
(!s.store_id && !store.store_id && s.name === store.name)
    );
    if (!exists && ((store.location_lat && store.location_lng) || store.address)) {
allStores.push(store);
    }
});
    });
    
    if (allStores.length === 0) {
alert('地図表示可能な店舗がありません');
return;
    }
    
    const modal = document.getElementById('mapModal');
    const modalTitle = document.getElementById('mapModalTitle');
    modalTitle.textContent = `全保存リスト - 地図表示 (${allStores.length}件)`;
    modal.style.display = 'block';
    
    setTimeout(async () => {
// 全リストを表示する場合は、リスト情報も保持
await initMapWithMultipleLists(allStores, '全保存リスト');
    }, 100);
});
    }
    
    // モーダルの初期化
    const modal = document.getElementById('mapModal');
    const closeBtn = document.querySelector('.close');
    
    if (closeBtn) {
closeBtn.onclick = () => {
    modal.style.display = 'none';
};
    }
    
    // モーダル外をクリックで閉じる
    window.onclick = (event) => {
if (event.target === modal) {
    modal.style.display = 'none';
}
    };
    
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('keydown', handleSearchKeyDown);
    
    document.querySelectorAll('input[name="search-mode"]').forEach(radio => {
radio.addEventListener('change', (e) => {
    currentFilters.searchMode = e.target.value;
    updateSearchQuery();
    loadStores(1);
});
    });
    
    document.querySelectorAll('input[name="match-type"]').forEach(radio => {
radio.addEventListener('change', (e) => {
    currentFilters.matchType = e.target.value;
    loadStores(1);
});
    });
    
    document.getElementById('city-search-input').addEventListener('input', debounce(filterAndDisplayCities, 300));
    document.getElementById('category-search-input').addEventListener('input', debounce(filterAndDisplayCategories, 300));
    updateSelectedCategoriesDisplay();
    
    // データソースフィルターのUIを生成
    renderDataSourceFilter();
    
    // 全項目フィルター
    document.getElementById('phone-filter-input').addEventListener('input', debounce(() => {
currentFilters.phone = document.getElementById('phone-filter-input').value.trim();
loadStores(1);
    }, 500));
    
    document.getElementById('website-filter-input').addEventListener('input', debounce(() => {
currentFilters.website = document.getElementById('website-filter-input').value.trim();
loadStores(1);
    }, 500));
    
    document.getElementById('rating-filter-value').addEventListener('input', debounce(() => {
currentFilters.ratingOperator = document.getElementById('rating-filter-operator').value;
currentFilters.ratingValue = document.getElementById('rating-filter-value').value;
loadStores(1);
    }, 500));
    
    document.getElementById('rating-filter-operator').addEventListener('change', () => {
currentFilters.ratingOperator = document.getElementById('rating-filter-operator').value;
if (currentFilters.ratingValue) {
    loadStores(1);
}
    });
    
    document.getElementById('reset-filters').addEventListener('click', resetFilters);
    document.getElementById('export-csv').addEventListener('click', handleExportCSV);
    document.getElementById('export-json').addEventListener('click', handleExportJSON);

    // タブ切り替え設定
    const tabButtons = document.querySelectorAll('.lt-tab');
    tabButtons.forEach(btn => {
btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    switchTab(tab);
    // MYリスト表示タブが開かれたときに初期データを読み込む
    if (tab === 'mylist') {
loadFavoritesLists();
    }
});
    });

    // MYリスト表示タブのサブタブ切り替え
    const myListSubTabs = document.querySelectorAll('.mylist-subtab');
    myListSubTabs.forEach(btn => {
btn.addEventListener('click', () => {
    const subtab = btn.dataset.subtab;
    myListSubTabs.forEach(b => {
if (b.dataset.subtab === subtab) {
    b.classList.add('mylist-subtab-active');
} else {
    b.classList.remove('mylist-subtab-active');
}
    });
    
    const favoritesContent = document.getElementById('favorites-content');
    const downloadedContent = document.getElementById('downloaded-content');
    
    if (subtab === 'favorites') {
if (favoritesContent) favoritesContent.style.display = '';
if (downloadedContent) downloadedContent.style.display = 'none';
loadFavoritesLists();
    } else if (subtab === 'downloaded') {
if (favoritesContent) favoritesContent.style.display = 'none';
if (downloadedContent) downloadedContent.style.display = '';
loadDownloadedLists();
    }
});
    });

    // 初期タブは「検索」
    switchTab('search');
});

let cityChart = null;
let prefectureChart = null;
let areaChart = null;

async function loadStats() {
    try {
const response = await fetch(`${STORE_API_BASE}/api/stats`);
const data = await response.json();
document.getElementById('total-stores').textContent = data.total_stores.toLocaleString();
document.getElementById('phone-rate').textContent = data.phone_rate.toFixed(1) + '%';
document.getElementById('website-rate').textContent = data.website_rate.toFixed(1) + '%';
document.getElementById('cities-count').textContent = data.cities;

// グラフを描画
if (data.city_stats) {
    drawCityChart(data.city_stats);
}
if (data.prefecture_stats) {
    drawPrefectureChart(data.prefecture_stats);
}
if (data.area_stats) {
    drawAreaChart(data.area_stats);
}
    } catch (error) {
console.error('統計情報の読み込みエラー:', error);
    }
}

function drawCityChart(cityStats) {
    const ctx = document.getElementById('city-chart');
    if (!ctx) return;
    
    const cities = Object.keys(cityStats);
    const counts = Object.values(cityStats);
    
    // 既存のチャートを破棄
    if (cityChart) {
cityChart.destroy();
    }
    
    cityChart = new Chart(ctx, {
type: 'bar',
data: {
    labels: cities,
    datasets: [{
        label: '店舗数',
        data: counts,
        backgroundColor: 'rgba(59, 130, 246, 0.6)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 1
    }]
},
options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
legend: {
    display: false
},
tooltip: {
    callbacks: {
        // 都市名と件数を揃えて表示
        label: function(context) {
            const label = context.label || '';
            const value = context.parsed.y || 0;
            return `${label}: ${value.toLocaleString()}件`;
        }
    }
}
    },
    scales: {
y: {
    beginAtZero: true,
    ticks: {
callback: function(value) {
    return value.toLocaleString();
}
    }
},
x: {
    ticks: {
maxRotation: 45,
minRotation: 45
    }
}
    }
}
    });
}

function drawPrefectureChart(prefectureStats) {
    const ctx = document.getElementById('prefecture-chart');
    if (!ctx) return;
    
    const prefectures = Object.keys(prefectureStats);
    const counts = Object.values(prefectureStats);
    
    // 既存のチャートを破棄
    if (prefectureChart) {
prefectureChart.destroy();
    }
    
    prefectureChart = new Chart(ctx, {
type: 'bar',
data: {
    labels: prefectures,
    datasets: [{
        label: '店舗数',
        data: counts,
        backgroundColor: 'rgba(16, 185, 129, 0.6)',
        borderColor: 'rgba(16, 185, 129, 1)',
        borderWidth: 1
    }]
},
options: {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',  // 横棒グラフ
    plugins: {
legend: {
    display: false
},
tooltip: {
    callbacks: {
        // 都道府県名と件数を揃えて表示
        label: function(context) {
            const label = context.label || '';
            const value = context.parsed.x || 0;
            return `${label}: ${value.toLocaleString()}件`;
        }
    }
}
    },
    scales: {
x: {
    beginAtZero: true,
    ticks: {
callback: function(value) {
    return value.toLocaleString();
}
    }
},
y: {
    ticks: {
font: {
    size: 11
}
    }
}
    }
}
    });
}

function drawAreaChart(areaStats) {
    const ctx = document.getElementById('area-chart');
    if (!ctx) return;
    
    const areas = Object.keys(areaStats);
    const counts = Object.values(areaStats);
    
    // カラーパレット
    const colors = [
'rgba(59, 130, 246, 0.6)',   // 青
'rgba(16, 185, 129, 0.6)',   // 緑
'rgba(245, 158, 11, 0.6)',   // 黄
'rgba(239, 68, 68, 0.6)',    // 赤
'rgba(139, 92, 246, 0.6)',   // 紫
'rgba(236, 72, 153, 0.6)',   // ピンク
'rgba(20, 184, 166, 0.6)',   // ティール
'rgba(251, 146, 60, 0.6)',   // オレンジ
'rgba(99, 102, 241, 0.6)',   // インディゴ
'rgba(168, 85, 247, 0.6)'    // バイオレット
    ];
    
    // 既存のチャートを破棄
    if (areaChart) {
areaChart.destroy();
    }
    
    areaChart = new Chart(ctx, {
type: 'doughnut',
data: {
    labels: areas,
    datasets: [{
label: '店舗数',
data: counts,
backgroundColor: areas.map((_, i) => colors[i % colors.length]),
borderColor: areas.map((_, i) => colors[i % colors.length].replace('0.6', '1')),
borderWidth: 2
    }]
},
options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
legend: {
    position: 'right',
    labels: {
padding: 15,
font: {
    size: 12
}
    }
},
tooltip: {
    callbacks: {
label: function(context) {
    const label = context.label || '';
    const value = context.parsed || 0;
    const total = context.dataset.data.reduce((a, b) => a + b, 0);
    const percentage = ((value / total) * 100).toFixed(1);
    return `${label}: ${value.toLocaleString()}件 (${percentage}%)`;
}
    }
}
    }
}
    });
}

async function loadAreas() {
    try {
const response = await fetch(`${STORE_API_BASE}/api/areas`);
const data = await response.json();
const container = document.getElementById('area-filter-container');
container.innerHTML = '';
data.areas.forEach(area => {
    const label = document.createElement('label');
    label.className = 'flex items-center p-1.5 hover:bg-gray-100 cursor-pointer rounded';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = area;
    checkbox.className = 'mr-2 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500';
    checkbox.addEventListener('change', handleAreaChange);
    const span = document.createElement('span');
    span.textContent = area;
    span.className = 'text-xs text-gray-700 font-medium';
    label.appendChild(checkbox);
    label.appendChild(span);
    container.appendChild(label);
});
    } catch (error) {
console.error('エリアリストの読み込みエラー:', error);
    }
}

async function handleAreaChange(e) {
    const area = e.target.value;
    const isChecked = e.target.checked;
    try {
const response = await fetch(`${STORE_API_BASE}/api/areas`);
const data = await response.json();
if (isChecked) {
    const areaPrefectures = data.area_prefectures[area] || [];
    areaPrefectures.forEach(pref => {
if (!currentFilters.prefectures.includes(pref)) {
    currentFilters.prefectures.push(pref);
}
const checkbox = document.querySelector(`#prefecture-filter-container input[value="${pref}"]`);
if (checkbox) checkbox.checked = true;
    });
} else {
    const areaPrefectures = data.area_prefectures[area] || [];
    areaPrefectures.forEach(pref => {
const index = currentFilters.prefectures.indexOf(pref);
if (index > -1) currentFilters.prefectures.splice(index, 1);
const checkbox = document.querySelector(`#prefecture-filter-container input[value="${pref}"]`);
if (checkbox) checkbox.checked = false;
    });
}
await updateCitiesFromPrefectures();
loadStores(1);
    } catch (error) {
console.error('エリア変更エラー:', error);
    }
}

async function loadPrefectures() {
    try {
const response = await fetch(`${STORE_API_BASE}/api/prefectures`);
const data = await response.json();
const container = document.getElementById('prefecture-filter-container');
container.innerHTML = '';
data.prefectures.forEach(prefecture => {
    const label = document.createElement('label');
    label.className = 'flex items-center p-1.5 hover:bg-gray-100 cursor-pointer rounded';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = prefecture;
    checkbox.className = 'mr-2 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500';
    checkbox.addEventListener('change', handlePrefectureChange);
    const span = document.createElement('span');
    span.textContent = prefecture;
    span.className = 'text-xs text-gray-700';
    label.appendChild(checkbox);
    label.appendChild(span);
    container.appendChild(label);
});
    } catch (error) {
console.error('都道府県リストの読み込みエラー:', error);
    }
}

async function handlePrefectureChange(e) {
    const prefecture = e.target.value;
    const isChecked = e.target.checked;
    if (isChecked) {
if (!currentFilters.prefectures.includes(prefecture)) {
    currentFilters.prefectures.push(prefecture);
}
    } else {
const index = currentFilters.prefectures.indexOf(prefecture);
if (index > -1) currentFilters.prefectures.splice(index, 1);
    }
    await updateCitiesFromPrefectures();
    loadStores(1);
}

let allCitiesData = [];

async function updateCitiesFromPrefectures() {
    const citySearchInput = document.getElementById('city-search-input');
    if (currentFilters.prefectures.length === 0) {
document.getElementById('city-filter-container').innerHTML = '<p class="text-xs text-gray-500">都道府県を選択してください</p>';
citySearchInput.style.display = 'none';
allCitiesData = [];
currentFilters.cities = [];
return;
    }
    allCitiesData = [];
    for (const pref of currentFilters.prefectures) {
try {
    const response = await fetch(`${STORE_API_BASE}/api/cities?prefecture=${encodeURIComponent(pref)}`);
    const data = await response.json();
    allCitiesData.push(...data.cities);
} catch (error) {
    console.error(`市区町村取得エラー (${pref}):`, error);
}
    }
    allCitiesData = [...new Set(allCitiesData)].sort();
    citySearchInput.style.display = 'block';
    filterAndDisplayCities();
    updateSelectedCitiesDisplay();
}

function updateSelectedCitiesDisplay() {
    const displaySection = document.getElementById('selected-cities-display');
    const container = document.getElementById('selected-cities-container');
    if (currentFilters.cities.length === 0) {
displaySection.style.display = 'none';
return;
    }
    displaySection.style.display = 'block';
    container.innerHTML = '';
    currentFilters.cities.forEach((city, index) => {
const tag = document.createElement('div');
tag.className = 'inline-flex items-center px-3 py-1.5 bg-blue-600 text-white rounded-full text-xs font-medium mr-2 mb-2';
const span = document.createElement('span');
span.textContent = city;
span.className = 'mr-2';
const removeBtn = document.createElement('button');
removeBtn.textContent = '×';
removeBtn.className = 'hover:bg-blue-700 rounded-full w-5 h-5 flex items-center justify-center font-bold';
removeBtn.type = 'button';
removeBtn.addEventListener('click', () => {
    const cityIndex = currentFilters.cities.indexOf(city);
    if (cityIndex > -1) currentFilters.cities.splice(cityIndex, 1);
    const checkbox = document.querySelector(`#city-filter-container input[value="${city}"]`);
    if (checkbox) checkbox.checked = false;
    updateSelectedCitiesDisplay();
    filterAndDisplayCities();
    loadStores(1);
});
tag.appendChild(span);
tag.appendChild(removeBtn);
container.appendChild(tag);
    });
}

function filterAndDisplayCities() {
    const searchQuery = document.getElementById('city-search-input').value.toLowerCase().trim();
    const container = document.getElementById('city-filter-container');
    container.innerHTML = '';
    if (allCitiesData.length === 0) {
container.innerHTML = '<p class="text-xs text-gray-500">市区町村データがありません</p>';
return;
    }
    const filteredCities = searchQuery
? allCitiesData.filter(city => city.toLowerCase().includes(searchQuery))
: allCitiesData;
    if (filteredCities.length === 0) {
container.innerHTML = '<p class="text-xs text-gray-500">該当する市区町村がありません</p>';
return;
    }
    filteredCities.forEach(city => {
const isChecked = currentFilters.cities.includes(city);
const label = document.createElement('label');
label.className = `flex items-center p-2 hover:bg-gray-100 cursor-pointer rounded ${isChecked ? 'bg-blue-50' : ''}`;
const checkbox = document.createElement('input');
checkbox.type = 'checkbox';
checkbox.value = city;
checkbox.className = 'mr-2 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500';
checkbox.checked = isChecked;
checkbox.addEventListener('change', (e) => {
    const cityValue = e.target.value;
    const isNowChecked = e.target.checked;
    if (isNowChecked) {
if (!currentFilters.cities.includes(cityValue)) {
    currentFilters.cities.push(cityValue);
}
    } else {
const index = currentFilters.cities.indexOf(cityValue);
if (index > -1) currentFilters.cities.splice(index, 1);
    }
    updateSelectedCitiesDisplay();
    filterAndDisplayCities();
    loadStores(1);
});
const span = document.createElement('span');
span.textContent = city;
span.className = `text-sm ${isChecked ? 'text-blue-700 font-semibold' : 'text-gray-700'}`;
label.appendChild(checkbox);
label.appendChild(span);
container.appendChild(label);
    });
}

async function loadCategories() {
    try {
const response = await fetch(`${STORE_API_BASE}/api/categories`);
const data = await response.json();
allCategoriesData = [];
for (const [group, categories] of Object.entries(data.categories)) {
    categories.forEach(cat => {
if (!allCategoriesData.includes(cat)) {
    allCategoriesData.push(cat);
}
    });
}
allCategoriesData.sort();
document.getElementById('category-search-input').style.display = 'block';
filterAndDisplayCategories();
    } catch (error) {
console.error('カテゴリリストの読み込みエラー:', error);
    }
}

function filterAndDisplayCategories() {
    const searchQuery = document.getElementById('category-search-input').value.toLowerCase().trim();
    const container = document.getElementById('category-filter-container');
    container.innerHTML = '';
    if (allCategoriesData.length === 0) {
container.innerHTML = '<p class="text-xs text-gray-500">カテゴリーデータがありません</p>';
return;
    }
    const filteredCategories = searchQuery
? allCategoriesData.filter(cat => cat.toLowerCase().includes(searchQuery))
: allCategoriesData;
    if (filteredCategories.length === 0) {
container.innerHTML = '<p class="text-xs text-gray-500">該当するカテゴリーがありません</p>';
return;
    }
    filteredCategories.forEach(category => {
const isChecked = currentFilters.categories.includes(category);
const label = document.createElement('label');
label.className = `flex items-center p-2 hover:bg-gray-100 cursor-pointer rounded ${isChecked ? 'bg-purple-50' : ''}`;
const checkbox = document.createElement('input');
checkbox.type = 'checkbox';
checkbox.value = category;
checkbox.className = 'mr-2 w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500';
checkbox.checked = isChecked;
checkbox.addEventListener('change', (e) => {
    const categoryValue = e.target.value;
    const isNowChecked = e.target.checked;
    if (isNowChecked) {
if (!currentFilters.categories.includes(categoryValue)) {
    currentFilters.categories.push(categoryValue);
}
    } else {
const index = currentFilters.categories.indexOf(categoryValue);
if (index > -1) currentFilters.categories.splice(index, 1);
    }
    updateSelectedCategoriesDisplay();
    filterAndDisplayCategories();
    loadStores(1);
});
const span = document.createElement('span');
span.textContent = category;
span.className = `text-sm ${isChecked ? 'text-purple-700 font-semibold' : 'text-gray-700'}`;
label.appendChild(checkbox);
label.appendChild(span);
container.appendChild(label);
    });
}

function updateSelectedCategoriesDisplay() {
    const displaySection = document.getElementById('selected-categories-display');
    const container = document.getElementById('selected-categories-container');
    if (currentFilters.categories.length === 0) {
displaySection.style.display = 'none';
return;
    }
    displaySection.style.display = 'block';
    container.innerHTML = '';
    currentFilters.categories.forEach((category) => {
const tag = document.createElement('div');
tag.className = 'inline-flex items-center px-3 py-1.5 bg-purple-600 text-white rounded-full text-xs font-medium mr-2 mb-2';
const span = document.createElement('span');
span.textContent = category;
span.className = 'mr-2';
const removeBtn = document.createElement('button');
removeBtn.textContent = '×';
removeBtn.className = 'hover:bg-purple-700 rounded-full w-5 h-5 flex items-center justify-center font-bold';
removeBtn.type = 'button';
removeBtn.addEventListener('click', () => {
    const categoryIndex = currentFilters.categories.indexOf(category);
    if (categoryIndex > -1) currentFilters.categories.splice(categoryIndex, 1);
    const checkbox = document.querySelector(`#category-filter-container input[value="${category}"]`);
    if (checkbox) checkbox.checked = false;
    updateSelectedCategoriesDisplay();
    filterAndDisplayCategories();
    loadStores(1);
});
tag.appendChild(span);
tag.appendChild(removeBtn);
container.appendChild(tag);
    });
}

async function loadStores(page = 1) {
    const loading = document.getElementById('loading');
    const container = document.getElementById('stores-container');
    loading.style.display = 'block';
    container.innerHTML = '';
    try {
const params = new URLSearchParams({
    page: page,
    per_page: 100,
    search: currentFilters.search,
    search_mode: currentFilters.searchMode,
    match_type: currentFilters.matchType
});
currentFilters.categories.forEach(cat => params.append('categories', cat));
currentFilters.prefectures.forEach(pref => params.append('prefectures', pref));
currentFilters.cities.forEach(city => params.append('cities', city));
// データソースフィルター
if (currentFilters.dataSources.length > 0 && currentFilters.dataSources.length < DATA_SOURCES.length) {
    currentFilters.dataSources.forEach(source => params.append('data_sources', source));
}
if (currentFilters.phone) params.append('phone', currentFilters.phone);
if (currentFilters.website) params.append('website', currentFilters.website);
if (currentFilters.ratingValue) {
    params.append('rating_operator', currentFilters.ratingOperator);
    params.append('rating_value', currentFilters.ratingValue);
}
const response = await fetch(`${STORE_API_BASE}/api/stores?${params}`);
if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
const data = await response.json();
loading.style.display = 'none';
if (!data || !data.stores) {
    // 列数を動的に取得
    const headerRow = document.querySelector('thead tr');
    const columnCount = headerRow ? headerRow.querySelectorAll('th').length : 15;
    container.innerHTML = `<tr><td colspan="${columnCount}" class="px-6 py-8 text-center text-gray-500">データの読み込みに失敗しました。</td></tr>`;
    return;
}
if (data.stores.length === 0) {
    // 列数を動的に取得
    const headerRow = document.querySelector('thead tr');
    const columnCount = headerRow ? headerRow.querySelectorAll('th').length : 15;
    container.innerHTML = `<tr><td colspan="${columnCount}" class="px-6 py-8 text-center text-gray-500">店舗が見つかりませんでした。</td></tr>`;
    return;
}

// ヘッダーフィルターを適用
let filteredStores = data.stores;

// 店舗名フィルター（複数値対応）
if (currentFilters.headerName) {
    const nameFilters = currentFilters.headerName.split('|').filter(f => f);
    if (nameFilters.length > 0) {
filteredStores = filteredStores.filter(store => 
    nameFilters.some(filter => (store.name || '').includes(filter))
);
    }
}

// 住所フィルター（複数値対応）
if (currentFilters.headerAddress) {
    const addressFilters = currentFilters.headerAddress.split('|').filter(f => f);
    if (addressFilters.length > 0) {
filteredStores = filteredStores.filter(store => 
    addressFilters.some(filter => (store.address || '').includes(filter))
);
    }
}

// 連絡先フィルター（複数値対応）
if (currentFilters.headerContact) {
    const contactFilters = currentFilters.headerContact.split('|').filter(f => f);
    if (contactFilters.length > 0) {
filteredStores = filteredStores.filter(store => 
    contactFilters.some(filter => 
(store.phone || '').includes(filter) ||
(store.website || '').includes(filter)
    )
);
    }
}

// カテゴリーフィルター（複数値対応）
if (currentFilters.headerCategory) {
    const categoryFilters = currentFilters.headerCategory.split('|').filter(f => f);
    if (categoryFilters.length > 0) {
filteredStores = filteredStores.filter(store => 
    categoryFilters.some(filter => (store.category || '').includes(filter))
);
    }
}

// データソースフィルター（複数値対応）
if (currentFilters.dataSources.length > 0 && currentFilters.dataSources.length < DATA_SOURCES.length) {
    filteredStores = filteredStores.filter(store => {
const storeDataSource = store.data_source || '';
return currentFilters.dataSources.some(source => {
    // データソースの値を正規化して比較
    const normalizedStoreSource = normalizeDataSourceName(storeDataSource);
    const normalizedFilterSource = normalizeDataSourceName(source);
    return normalizedStoreSource === normalizedFilterSource;
});
    });
}

// デリバリーサービスフィルター（ヘッダーフィルター用、複数値対応）
if (currentFilters.headerDelivery) {
    const deliveryFilters = currentFilters.headerDelivery.split(',').filter(f => f);
    if (deliveryFilters.length > 0) {
filteredStores = filteredStores.filter(store => {
    const services = store.delivery_services || [];
    // URLからも判定（ubereats.comが含まれている場合）
    if (store.url && store.url.includes('ubereats.com')) {
services.push('Uber Eats');
    }
    // 正規化されたサービス名で比較
    const normalizedServices = services.map(normalizeDataSourceName);
    return deliveryFilters.some(filter => {
const normalizedFilter = normalizeDataSourceName(filter);
return normalizedServices.some(s => s === normalizedFilter);
    });
});
    }
}

// ステータスフィルター（複数値対応）
if (currentFilters.headerStatus) {
    const statusFilters = currentFilters.headerStatus.split(',').filter(f => f);
    if (statusFilters.length > 0) {
filteredStores = await Promise.all(
    filteredStores.map(async (store) => {
const storeStatus = await getStoreStatus(store.store_id || store.name);
return { store, status: storeStatus };
    })
);
filteredStores = filteredStores
    .filter(({ status }) => statusFilters.includes(status))
    .map(({ store }) => store);
    }
}

// 定休日フィルター（複数値対応）
if (currentFilters.headerClosedDay) {
    const closedDayFilters = currentFilters.headerClosedDay.split('|').filter(f => f);
    if (closedDayFilters.length > 0) {
filteredStores = filteredStores.filter(store => 
    closedDayFilters.some(filter => (store.closed_day || '').includes(filter))
);
    }
}

// オープン日フィルター（複数値対応）
if (currentFilters.headerOpeningDate) {
    const openingDateFilters = currentFilters.headerOpeningDate.split('|').filter(f => f);
    if (openingDateFilters.length > 0) {
filteredStores = filteredStores.filter(store => 
    openingDateFilters.some(filter => (store.opening_date || '').includes(filter))
);
    }
}

// 交通手段フィルター（複数値対応）
if (currentFilters.headerTransport) {
    const transportFilters = currentFilters.headerTransport.split('|').filter(f => f);
    if (transportFilters.length > 0) {
filteredStores = filteredStores.filter(store => 
    transportFilters.some(filter => (store.transport || '').includes(filter))
);
    }
}

// 営業時間フィルター（複数値対応）
if (currentFilters.headerBusinessHours) {
    const businessHoursFilters = currentFilters.headerBusinessHours.split('|').filter(f => f);
    if (businessHoursFilters.length > 0) {
filteredStores = filteredStores.filter(store => 
    businessHoursFilters.some(filter => (store.business_hours || '').includes(filter))
);
    }
}

// 公式アカウントフィルター（複数値対応）
if (currentFilters.headerOfficialAccount) {
    const officialAccountFilters = currentFilters.headerOfficialAccount.split('|').filter(f => f);
    if (officialAccountFilters.length > 0) {
filteredStores = filteredStores.filter(store => {
    const accounts = Array.isArray(store.official_account) 
? store.official_account.join(', ') 
: (store.official_account || '');
    return officialAccountFilters.some(filter => accounts.includes(filter));
});
    }
}

// リスト収集日フィルター（複数値対応）
if (currentFilters.headerCollectedAt) {
    const collectedAtFilters = currentFilters.headerCollectedAt.split('|').filter(f => f);
    if (collectedAtFilters.length > 0) {
filteredStores = filteredStores.filter(store => 
    collectedAtFilters.some(filter => (store.collected_at || '').includes(filter))
);
    }
}

// データソースフィルター（左側フィルターとヘッダーフィルターの両方に対応）
if (currentFilters.dataSources.length > 0 && currentFilters.dataSources.length < DATA_SOURCES.length) {
    filteredStores = filteredStores.filter(store => {
const storeDataSource = (store.data_source || '').toLowerCase();
return currentFilters.dataSources.some(source => {
    const normalizedSource = normalizeDataSourceName(source);
    return storeDataSource === normalizedSource;
});
    });
}

if (filteredStores.length === 0) {
    // 列数を動的に取得（チェックボックス列 + データ列）
    const headerRow = document.querySelector('thead tr');
    const columnCount = headerRow ? headerRow.querySelectorAll('th').length : 15;
    
    container.innerHTML = `
<tr>
    <td colspan="${columnCount}" class="px-6 py-16">
<div class="flex flex-col items-center justify-center text-center">
    <div class="mb-4">
        <svg class="w-16 h-16 text-gray-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
    </div>
    <h3 class="text-lg font-semibold text-gray-700 mb-2">該当する店舗が見つかりませんでした</h3>
    <p class="text-sm text-gray-500 mb-6 max-w-md">
        現在のフィルター条件に一致する店舗がありません。<br>
        フィルター条件を変更するか、リセットして再度検索してください。
    </p>
    <button 
        onclick="resetFilters()" 
        class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 font-medium shadow-sm"
    >
        フィルターをリセット
    </button>
</div>
    </td>
</tr>
    `;
    
    // ページネーション情報を更新
    const paginationInfo = document.getElementById('pagination-info');
    if (paginationInfo) {
paginationInfo.textContent = '0件中 0-0件を表示';
    }
    
    // ページネーションを非表示
    const pagination = document.getElementById('pagination');
    if (pagination) {
pagination.innerHTML = '';
    }
    
    return;
}

// 店舗データを保持（保存機能用）
if (!window.currentStores) {
    window.currentStores = {};
}

// データを保存
for (const store of filteredStores) {
    window.currentStores[store.store_id || store.name] = store;
}

// ソートが設定されている場合は適用
if (currentSortColumn && currentSortDirection) {
    applySort();
} else {
    // ソートが設定されていない場合は通常通り表示
    for (const store of filteredStores) {
const row = await createStoreTableRow(store);
container.appendChild(row);
    }
}

// ページネーション情報を更新（フィルター適用後の件数）
let paginationInfo = document.getElementById('pagination-info');
if (paginationInfo) {
    paginationInfo.textContent = 
`${filteredStores.length}件中 ${((page - 1) * (data.per_page || 100)) + 1}-${Math.min(page * (data.per_page || 100), filteredStores.length)}件を表示`;
}

// アクティブフィルター概要を更新
updateActiveFiltersBar(filteredStores.length, data.total || filteredStores.length);

if (data.total_pages) renderPagination(page, data.total_pages);
currentPage = page;
    } catch (error) {
loading.style.display = 'none';
// 列数を動的に取得
const headerRow = document.querySelector('thead tr');
const columnCount = headerRow ? headerRow.querySelectorAll('th').length : 15;
container.innerHTML = `<tr><td colspan="${columnCount}" class="px-6 py-8 text-center text-red-500">エラーが発生しました。Flaskアプリが起動しているか確認してください。</td></tr>`;
console.error('店舗データの読み込みエラー:', error);
    }
}

// 現在の検索結果を保存（改善版）
async function saveCurrentSearchResults() {
    if (!window.currentStores || Object.keys(window.currentStores).length === 0) {
alert('保存する店舗がありません');
return;
    }
    
    const listName = prompt('リスト名を入力してください:');
    if (!listName) return;
    
    // ステータスを選択
    const statusChoice = confirm('成約済みリストとして保存しますか？\n（「キャンセル」を選択するとアプローチリストとして保存されます）');
    const status = statusChoice ? 'contracted' : 'approach';
    
    const stores = Object.values(window.currentStores);
    // 各店舗のステータスを取得して保存
    for (const store of stores) {
const storeId = store.store_id || store.name;
const currentStoreStatus = await getStoreStatus(storeId);
if (currentStoreStatus !== 'none') {
    store.status = currentStoreStatus;
}
    }
    
    await saveList(listName, stores, status);
    alert(`「${listName}」に${stores.length}件の店舗を${status === 'contracted' ? '成約済みとして' : 'アプローチ中として'}保存しました`);
}

async function createStoreTableRow(store) {
    const row = document.createElement('tr');
    row.className = 'hover:bg-gray-50 transition-colors border-b border-gray-100';
    row.dataset.storeId = store.store_id || store.name;
    
    // チェックボックスセル
    const checkboxCell = document.createElement('td');
    checkboxCell.className = 'px-6 py-4';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'store-checkbox w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500';
    checkbox.dataset.storeId = store.store_id || store.name;
    checkbox.addEventListener('change', updateSelectedCount);
    checkboxCell.appendChild(checkbox);
    
    const nameCell = document.createElement('td');
    nameCell.className = 'px-6 py-4 align-top';
    const nameDiv = document.createElement('div');
    nameDiv.className = 'text-sm font-medium text-gray-900 store-name-cell';
    nameDiv.style.wordBreak = 'break-word';
    nameDiv.style.maxWidth = '320px'; // 20文字分の幅（日本語1文字約16px × 20文字）
    nameDiv.style.minWidth = '320px';
    nameDiv.style.lineHeight = '1.5';
    const nameText = store.name || '名称不明';
    // 20文字ごとに改行を挿入
    let formattedName = '';
    for (let i = 0; i < nameText.length; i += 20) {
if (i > 0) formattedName += '\n';
formattedName += nameText.substring(i, i + 20);
    }
    nameDiv.textContent = formattedName;
    // フランチャイズ店舗の場合はバッジを表示
    if (store.is_franchise) {
        const badge = document.createElement('span');
        badge.className = 'ml-2 inline-flex items-center px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 text-[10px] font-semibold';
        badge.textContent = 'FC';
        nameDiv.appendChild(badge);
    }
    nameDiv.style.whiteSpace = 'pre-wrap';
    nameCell.appendChild(nameDiv);
    if (store.url) {
const link = document.createElement('a');
link.href = store.url;
link.target = '_blank';
link.className = 'text-xs text-blue-600 hover:underline ml-2';
link.textContent = '→';
nameDiv.appendChild(link);
    }
    const addressCell = document.createElement('td');
    addressCell.className = 'px-6 py-4 store-address-cell';
    const addressDiv = document.createElement('div');
    addressDiv.className = 'text-sm text-gray-900';
    addressDiv.style.wordBreak = 'break-word';
    addressDiv.style.maxWidth = '320px'; // 20文字分の幅（日本語1文字約16px × 20文字）
    addressDiv.style.minWidth = '320px';
    addressDiv.style.lineHeight = '1.5';
    let addressText = store.address || '未取得';
    
    // 表示用に住所文字列を簡易正規化（重複や "Japan," を除去）
    addressText = normalizeAddressToJapanese(addressText);
    // 20文字ごとに改行を挿入
    let formattedAddress = '';
    for (let i = 0; i < addressText.length; i += 20) {
if (i > 0) formattedAddress += '\n';
formattedAddress += addressText.substring(i, i + 20);
    }
    addressDiv.textContent = formattedAddress;
    addressDiv.style.whiteSpace = 'pre-wrap';
    
    // Googleマップへのリンクを追加（店舗名を優先、住所・座標を補助的に使用）
    if (store.name || store.address || (store.location_lat && store.location_lng)) {
const mapLink = document.createElement('a');
let mapUrl = '';
const storeName = store.name || '';

// 優先順位: 1. 店舗名 + 住所, 2. 店舗名のみ, 3. 座標, 4. 住所のみ
if (storeName && addressText && addressText !== '未取得') {
    // 店舗名と住所の両方がある場合は、店舗名を優先して検索（精度が高い）
    const query = `${storeName} ${addressText}`;
    mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
} else if (storeName) {
    // 店舗名のみ
    mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(storeName)}`;
} else if (store.location_lat && store.location_lng) {
    // 座標
    mapUrl = `https://www.google.com/maps?q=${store.location_lat},${store.location_lng}`;
} else if (addressText && addressText !== '未取得') {
    // 住所のみ
    mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressText)}`;
}

if (mapUrl) {
    mapLink.href = mapUrl;
    mapLink.target = '_blank';
    mapLink.rel = 'noopener noreferrer';
    mapLink.className = 'ml-2 text-blue-600 hover:underline text-xs';
    mapLink.innerHTML = '🗺️ 地図';
    mapLink.title = 'Googleマップで開く';
    addressDiv.appendChild(mapLink);
}
    }
    addressCell.appendChild(addressDiv);
    const contactCell = document.createElement('td');
    contactCell.className = 'px-6 py-4';
    const contactDiv = document.createElement('div');
    contactDiv.className = 'text-sm text-gray-900 space-y-2';
    const phoneDiv = document.createElement('div');
    phoneDiv.className = 'flex items-center';
    if (store.phone) {
const phoneIcon = document.createElement('span');
phoneIcon.className = 'mr-2 text-gray-500';
phoneIcon.textContent = '📞';
const phoneLink = document.createElement('a');
phoneLink.href = `tel:${store.phone}`;
phoneLink.className = 'text-blue-600 hover:underline font-medium';
phoneLink.textContent = store.phone;
phoneDiv.appendChild(phoneIcon);
phoneDiv.appendChild(phoneLink);
    } else {
phoneDiv.className = 'text-gray-400 text-xs';
phoneDiv.textContent = '📞 未取得';
    }
    contactDiv.appendChild(phoneDiv);
    const websiteDiv = document.createElement('div');
    websiteDiv.className = 'flex items-center';
    if (store.website) {
const websiteIcon = document.createElement('span');
websiteIcon.className = 'mr-2 text-gray-500';
websiteIcon.textContent = '🌐';
const websiteLink = document.createElement('a');
websiteLink.href = store.website;
websiteLink.target = '_blank';
websiteLink.rel = 'noopener noreferrer';
websiteLink.className = 'text-blue-600 hover:underline break-all max-w-xs';
let displayUrl = store.website.replace(/^https?:\/\//, '').replace(/^www\./, '');
if (displayUrl.length > 35) displayUrl = displayUrl.substring(0, 35) + '...';
websiteLink.textContent = displayUrl;
websiteLink.title = store.website;
websiteDiv.appendChild(websiteIcon);
websiteDiv.appendChild(websiteLink);
    } else {
websiteDiv.className = 'text-gray-400 text-xs';
websiteDiv.textContent = '🌐 未取得';
    }
    contactDiv.appendChild(websiteDiv);
    contactCell.appendChild(contactDiv);
            // カテゴリーセル（10文字ごとに折り返し）
            const categoryCell = document.createElement('td');
            categoryCell.className = 'px-6 py-4 whitespace-nowrap';
            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'text-sm text-gray-900';
            const categoryText = store.category || '未設定';
            let formattedCategory = '';
            for (let i = 0; i < categoryText.length; i += 10) {
                if (i > 0) formattedCategory += '\n';
                formattedCategory += categoryText.substring(i, i + 10);
            }
            categoryDiv.textContent = formattedCategory;
            categoryDiv.style.whiteSpace = 'pre-wrap';
            categoryCell.appendChild(categoryDiv);
    // 定休日セル
    const closedCell = document.createElement('td');
    closedCell.className = 'px-6 py-4 whitespace-nowrap';
    const closedDiv = document.createElement('div');
    closedDiv.className = 'text-sm text-gray-900';
    if (store.closed_day) {
closedDiv.textContent = store.closed_day;
    } else {
closedDiv.className = 'text-gray-400 text-xs';
closedDiv.textContent = '未設定';
    }
    closedCell.appendChild(closedDiv);
    // オープン日セル
    const openingCell = document.createElement('td');
    openingCell.className = 'px-6 py-4 whitespace-nowrap';
    const openingDiv = document.createElement('div');
    openingDiv.className = 'text-sm text-gray-900';
    if (store.opening_date) {
openingDiv.textContent = store.opening_date;
    } else {
openingDiv.className = 'text-gray-400 text-xs';
openingDiv.textContent = '未取得';
    }
    openingCell.appendChild(openingDiv);
            // 交通手段セル（10文字ごとに折り返し）
            const transportCell = document.createElement('td');
            transportCell.className = 'px-6 py-4 whitespace-nowrap';
            const transportDiv = document.createElement('div');
            transportDiv.className = 'text-sm text-gray-900';
            if (store.transport) {
                const transportText = store.transport;
                let formattedTransport = '';
                for (let i = 0; i < transportText.length; i += 10) {
                    if (i > 0) formattedTransport += '\n';
                    formattedTransport += transportText.substring(i, i + 10);
                }
                transportDiv.textContent = formattedTransport;
                transportDiv.style.whiteSpace = 'pre-wrap';
            } else {
                transportDiv.className = 'text-gray-400 text-xs';
                transportDiv.textContent = '未取得';
            }
            transportCell.appendChild(transportDiv);
            // 営業時間セル（10文字ごとに折り返し）
            const businessHoursCell = document.createElement('td');
            businessHoursCell.className = 'px-6 py-4';
            const businessHoursDiv = document.createElement('div');
            businessHoursDiv.className = 'text-sm text-gray-900 max-w-xs';
            if (store.business_hours) {
                const bhText = store.business_hours;
                let formattedBH = '';
                for (let i = 0; i < bhText.length; i += 10) {
                    if (i > 0) formattedBH += '\n';
                    formattedBH += bhText.substring(i, i + 10);
                }
                businessHoursDiv.textContent = formattedBH;
                businessHoursDiv.title = store.business_hours;
                businessHoursDiv.style.whiteSpace = 'pre-wrap';
            } else {
                businessHoursDiv.className = 'text-gray-400 text-xs';
                businessHoursDiv.textContent = '未取得';
            }
            businessHoursCell.appendChild(businessHoursDiv);
    // 公式アカウントセル
    const officialAccountCell = document.createElement('td');
    officialAccountCell.className = 'px-6 py-4 store-official-account-cell';
    const officialAccountDiv = document.createElement('div');
    officialAccountDiv.className = 'flex flex-nowrap gap-1 overflow-hidden';
    officialAccountDiv.style.whiteSpace = 'nowrap';
    const officialAccounts = Array.isArray(store.official_account) ? store.official_account : (store.official_account ? store.official_account.split(',') : []);
    if (officialAccounts.length > 0) {
officialAccounts.forEach(url => {
    if (url.trim()) {
const link = document.createElement('a');
link.href = url.trim();
link.target = '_blank';
link.rel = 'noopener noreferrer';
link.className = 'inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800 hover:bg-blue-200';
let icon = '🔗';
if (url.includes('twitter.com') || url.includes('x.com')) icon = '🐦';
else if (url.includes('instagram.com')) icon = '📷';
else if (url.includes('facebook.com')) icon = '👥';
link.textContent = icon;
link.title = url.trim();
officialAccountDiv.appendChild(link);
    }
});
    } else {
const noAccount = document.createElement('span');
noAccount.className = 'text-gray-400 text-xs';
noAccount.textContent = '未取得';
officialAccountDiv.appendChild(noAccount);
    }
    officialAccountCell.appendChild(officialAccountDiv);
    // データソースセル
    const dataSourceCell = document.createElement('td');
    dataSourceCell.className = 'px-6 py-4 whitespace-nowrap';
    const dataSourceDiv = document.createElement('div');
    const sourceBadge = document.createElement('span');
    sourceBadge.className = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium';
    const dataSource = store.data_source || '';
    if (dataSource === 'tabelog') {
sourceBadge.className += ' bg-orange-100 text-orange-800';
sourceBadge.textContent = '食べログ';
    } else if (dataSource === 'google_places_api') {
sourceBadge.className += ' bg-blue-100 text-blue-800';
sourceBadge.textContent = 'Googleマップ';
    } else if (dataSource === 'ubereats') {
sourceBadge.className += ' bg-green-100 text-green-800';
sourceBadge.textContent = 'Uber Eats';
    } else {
sourceBadge.className += ' bg-gray-100 text-gray-800';
sourceBadge.textContent = dataSource || 'その他';
    }
    dataSourceDiv.appendChild(sourceBadge);
    dataSourceCell.appendChild(dataSourceDiv);
    // リスト収集日セル
    const collectedAtCell = document.createElement('td');
    collectedAtCell.className = 'px-6 py-4 store-collected-at-cell';
    const collectedAtDiv = document.createElement('div');
    collectedAtDiv.className = 'text-sm text-gray-900';
    collectedAtDiv.style.whiteSpace = 'nowrap';
    collectedAtDiv.style.overflow = 'hidden';
    collectedAtDiv.style.textOverflow = 'ellipsis';
    if (store.collected_at) {
collectedAtDiv.textContent = store.collected_at;
    } else {
collectedAtDiv.className = 'text-gray-400 text-xs';
collectedAtDiv.textContent = '未設定';
    }
    collectedAtCell.appendChild(collectedAtDiv);
    const deliveryCell = document.createElement('td');
    deliveryCell.className = 'px-6 py-4 store-delivery-cell';
    const deliveryDiv = document.createElement('div');
    deliveryDiv.className = 'flex flex-nowrap gap-1 overflow-hidden';
    deliveryDiv.style.whiteSpace = 'nowrap';
    const deliveryServices = store.delivery_services || [];
    const serviceSet = new Set();
    deliveryServices.forEach(service => serviceSet.add(service));
    if (store.url && store.url.includes('ubereats.com')) serviceSet.add('Uber Eats');
    if (serviceSet.size > 0) {
const serviceNames = {
    'ubereats': 'Uber Eats',
    'Uber Eats': 'Uber Eats',
    'wolt': 'ウォルト',
    'ウォルト': 'ウォルト',
    'demaecan': '出前館',
    '出前館': '出前館'
};
Array.from(serviceSet).forEach(service => {
    const badge = document.createElement('span');
    badge.className = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800';
    badge.textContent = serviceNames[service] || service;
    deliveryDiv.appendChild(badge);
});
    } else {
const noService = document.createElement('span');
noService.className = 'text-gray-400 text-xs';
noService.textContent = '未取得';
deliveryDiv.appendChild(noService);
    }
    deliveryCell.appendChild(deliveryDiv);
    
    // ステータスセル
    const statusCell = document.createElement('td');
    statusCell.className = 'px-6 py-4 whitespace-nowrap';
    const statusDiv = document.createElement('div');
    statusDiv.className = 'flex items-center gap-2';
    
    // 店舗のステータスを取得（storeオブジェクトにstatusがある場合はそれを使用）
    const storeStatus = store.status || await getStoreStatus(store.store_id || store.name);
    
    // ステータスバッジ（ドロップダウン形式）
    const statusSelect = document.createElement('select');
    statusSelect.className = `status-badge ${getStatusClass(storeStatus)} border-0 outline-none cursor-pointer`;
    statusSelect.style.appearance = 'none';
    statusSelect.style.padding = '4px 12px';
    statusSelect.style.borderRadius = '16px';
    statusSelect.style.fontSize = '12px';
    statusSelect.style.fontWeight = '500';
    
    // オプションを追加
    const options = [
{ value: 'none', label: '未設定', class: 'status-none' },
{ value: 'approach', label: '📋 アプローチ中', class: 'status-approach' },
{ value: 'contracted', label: '✅ 成約済み', class: 'status-contracted' }
    ];
    
    options.forEach(opt => {
const option = document.createElement('option');
option.value = opt.value;
option.textContent = opt.label;
option.selected = opt.value === storeStatus;
statusSelect.appendChild(option);
    });
    
    statusSelect.onchange = async () => {
const newStatus = statusSelect.value;
await saveStoreStatus(store.store_id || store.name, newStatus);
statusSelect.className = `status-badge ${getStatusClass(newStatus)} border-0 outline-none cursor-pointer`;
statusSelect.style.appearance = 'none';
statusSelect.style.padding = '4px 12px';
statusSelect.style.borderRadius = '16px';
statusSelect.style.fontSize = '12px';
statusSelect.style.fontWeight = '500';
updateStoreInLists(store.store_id || store.name, newStatus);
    };
    
    statusDiv.appendChild(statusSelect);
    
    statusCell.appendChild(statusDiv);
    
    row.appendChild(checkboxCell);
    row.appendChild(nameCell);
    row.appendChild(addressCell);
    row.appendChild(contactCell);
    row.appendChild(categoryCell);
    row.appendChild(closedCell);
    row.appendChild(openingCell);
    row.appendChild(transportCell);
    row.appendChild(businessHoursCell);
    row.appendChild(officialAccountCell);
    row.appendChild(dataSourceCell);
    row.appendChild(collectedAtCell);
    row.appendChild(deliveryCell);
    row.appendChild(statusCell);
    return row;
}

// 店舗のステータスを取得（API経由）
let cachedStoreStatuses = {};
async function getStoreStatus(storeId) {
    try {
if (Object.keys(cachedStoreStatuses).length === 0) {
    const currentPartnerId = sessionStorage.getItem("currentPartnerId");
    const data = await apiCall(`/store-statuses?rep_id=${currentPartnerId}`);
    cachedStoreStatuses = data.statuses || {};
}
return cachedStoreStatuses[storeId] || 'none';
    } catch (error) {
console.error('ステータス取得エラー:', error);
// フォールバック: localStorageから取得
const key = getPartnerStorageKey('storeStatuses');
const data = localStorage.getItem(key);
const statuses = data ? JSON.parse(data) : {};
return statuses[storeId] || 'none';
    }
}

// 店舗のステータスを保存（API経由）
async function saveStoreStatus(storeId, status) {
    try {
const currentPartnerId = sessionStorage.getItem("currentPartnerId");
await apiCall('/store-statuses', {
    method: 'POST',
    body: JSON.stringify({
rep_id: currentPartnerId,
store_id: storeId,
status: status
    })
});
cachedStoreStatuses[storeId] = status;
    } catch (error) {
console.error('ステータス保存エラー:', error);
// フォールバック: localStorageに保存
const key = getPartnerStorageKey('storeStatuses');
const data = localStorage.getItem(key);
const statuses = data ? JSON.parse(data) : {};
statuses[storeId] = status;
localStorage.setItem(key, JSON.stringify(statuses));
    }
}

// ステータスのクラス名を取得
function getStatusClass(status) {
    if (status === 'contracted') return 'status-contracted';
    if (status === 'approach') return 'status-approach';
    return 'status-none';
}

// ステータスのラベルを取得
function getStatusLabel(status) {
    if (status === 'contracted') return '✅ 成約済み';
    if (status === 'approach') return '📋 アプローチ中';
    return '未設定';
}


// リスト内の店舗ステータスを更新
async function updateStoreInLists(storeId, newStatus) {
    const lists = await getSavedLists();
    let updated = false;
    
    lists.forEach(list => {
list.stores.forEach(store => {
    const sId = store.store_id || store.name;
    if (sId === storeId) {
store.status = newStatus;
updated = true;
    }
});
    });
    
    if (updated) {
const key = getPartnerStorageKey('savedLists');
localStorage.setItem(key, JSON.stringify(lists));
    }
}

// パートナーID毎のストレージキー生成（後方互換性のため保持）
function getPartnerStorageKey(key) {
    const currentPartnerId = sessionStorage.getItem("currentPartnerId");
    return `partner_${currentPartnerId}_${key}`;
}

// ==================== API呼び出しヘルパー関数 ====================
// パートナー管理用APIのベースURL
const PARTNER_API_BASE = '/api/partner';
// 店舗データなどの既存APIのベースURL
const STORE_API_BASE = '';

async function apiCall(endpoint, options = {}) {
    try {
const response = await fetch(`${PARTNER_API_BASE}${endpoint}`, {
    headers: {
'Content-Type': 'application/json',
...options.headers
    },
    ...options
});

if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'API呼び出しエラー');
}

return await response.json();
    } catch (error) {
console.error('API呼び出しエラー:', error);
throw error;
    }
}

// 保存したリストを取得（API経由）
let cachedLists = [];
async function getSavedLists() {
    try {
const currentPartnerId = sessionStorage.getItem("currentPartnerId");
if (!currentPartnerId) {
    console.warn('パートナーIDが取得できません');
    return [];
}
console.log('リスト取得中...', currentPartnerId);
const data = await apiCall(`/saved-lists?rep_id=${currentPartnerId}`);
console.log('リスト取得成功:', data);
cachedLists = (data.lists || []).map(l => ({
    id: l.list_id,
    name: l.name,
    stores: Array.isArray(l.stores) ? l.stores : (typeof l.stores === 'string' ? JSON.parse(l.stores) : []),
    status: l.status || 'approach',
    createdAt: l.created_at,
    updatedAt: l.updated_at
}));
return cachedLists;
    } catch (error) {
console.error('リスト取得エラー:', error);
// フォールバック: localStorageから取得
const key = getPartnerStorageKey('savedLists');
const data = localStorage.getItem(key);
return data ? JSON.parse(data) : [];
    }
}

// リストを保存（API経由）
async function saveList(listName, stores, status = 'approach') {
    try {
const currentPartnerId = sessionStorage.getItem("currentPartnerId");
await apiCall('/saved-lists', {
    method: 'POST',
    body: JSON.stringify({
rep_id: currentPartnerId,
name: listName,
stores: stores,
status: status
    })
});
await displaySavedLists();
    } catch (error) {
console.error('リスト保存エラー:', error);
// フォールバック: localStorageに保存
const lists = await getSavedLists();
const newList = {
    id: Date.now().toString(),
    name: listName,
    stores: stores,
    status: status,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
};
lists.push(newList);
const key = getPartnerStorageKey('savedLists');
localStorage.setItem(key, JSON.stringify(lists));
await displaySavedLists();
    }
}

// リストのステータスを変更
async function changeListStatus(listId, newStatus) {
    const lists = await getSavedLists();
    const list = lists.find(l => l.id === listId);
    if (list) {
list.status = newStatus;
list.updatedAt = new Date().toISOString();
const key = getPartnerStorageKey('savedLists');
localStorage.setItem(key, JSON.stringify(lists));
await displaySavedLists();
    }
}

// ステータスでフィルター
let currentStatusFilter = 'all';

window.filterListsByStatus = async function(status) {
    currentStatusFilter = status;
    
    // ボタンのスタイルを更新
    document.querySelectorAll('[id^="filter-"]').forEach(btn => {
btn.classList.remove('bg-blue-600', 'bg-yellow-500', 'bg-green-600');
btn.classList.add('bg-gray-400');
    });
    
    const activeBtn = document.getElementById(`filter-${status}`);
    if (activeBtn) {
activeBtn.classList.remove('bg-gray-400');
if (status === 'all') {
    activeBtn.classList.add('bg-blue-600');
} else if (status === 'approach') {
    activeBtn.classList.add('bg-yellow-500');
} else if (status === 'contracted') {
    activeBtn.classList.add('bg-green-600');
}
    }
    
    await displaySavedLists();
};

// 店舗をリストに保存
async function saveStoreToList(store) {
    const listName = prompt('リスト名を入力してください（既存のリスト名を入力すると追加されます）:');
    if (!listName) return;
    
    // ステータスを選択
    const statusChoice = confirm('成約済みリストとして保存しますか？\n（「キャンセル」を選択するとアプローチリストとして保存されます）');
    const status = statusChoice ? 'contracted' : 'approach';
    
    // 店舗の現在のステータスを取得
    const storeId = store.store_id || store.name;
    const currentStoreStatus = await getStoreStatus(storeId);
    if (currentStoreStatus !== 'none') {
store.status = currentStoreStatus;
    }
    
    const lists = await getSavedLists();
    let targetList = lists.find(l => l.name === listName);
    
    if (targetList) {
// 既存のリストに追加（重複チェック）
const exists = targetList.stores.some(s => 
    (s.store_id && store.store_id && s.store_id === store.store_id) ||
    (!s.store_id && !store.store_id && s.name === store.name)
);
if (!exists) {
    targetList.stores.push(store);
    targetList.updatedAt = new Date().toISOString();
    // ステータスが異なる場合は更新
    if (targetList.status !== status) {
targetList.status = status;
    }
} else {
    alert('この店舗は既にリストに含まれています');
    return;
}
    } else {
// 新しいリストを作成
targetList = {
    id: Date.now().toString(),
    name: listName,
    stores: [store],
    status: status,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
};
lists.push(targetList);
    }
    
    const key = getPartnerStorageKey('savedLists');
    localStorage.setItem(key, JSON.stringify(lists));
    await displaySavedLists();
    alert(`「${listName}」に${status === 'contracted' ? '成約済みとして' : 'アプローチ中として'}保存しました`);
}

// 保存したリストを表示
async function displaySavedLists() {
    const container = document.getElementById('saved-lists-container');
    if (!container) {
console.error('saved-lists-container要素が見つかりません');
return;
    }
    
    try {
let lists = await getSavedLists();
const allMapBtn = document.getElementById('btn-show-all-on-map');

// ステータスでフィルター
if (currentStatusFilter !== 'all') {
    lists = lists.filter(list => list.status === currentStatusFilter);
}

if (lists.length === 0) {
    container.innerHTML = '<p class="text-center text-gray-500 py-4">保存したリストがありません</p>';
    if (allMapBtn) allMapBtn.style.display = 'none';
    return;
}

// 地図表示可能なリストがあるかチェック
const allLists = await getSavedLists(); // フィルター前の全リスト
    const hasMappableLists = allLists.some(list => {
return list.stores.some(s => (s.location_lat && s.location_lng) || s.address);
    });
    
    if (allMapBtn) {
allMapBtn.style.display = hasMappableLists ? 'block' : 'none';
    }
    
    container.innerHTML = lists.map(list => {
const date = new Date(list.updatedAt).toLocaleString('ja-JP');
// 座標情報がある店舗数をカウント
const storesWithLocation = list.stores.filter(s => 
    (s.location_lat && s.location_lng) || s.address
).length;

// ステータスに応じた色分け（apclo風のシンプルなデザイン）
const statusInfo = list.status === 'contracted' 
    ? { label: '成約済み', badgeClass: 'status-contracted' }
    : { label: 'アプローチ中', badgeClass: 'status-approach' };

return `
    <div class="apclo-card p-5 border-l-4 ${list.status === 'contracted' ? 'border-green-500' : 'border-yellow-500'}">
<div class="flex items-center justify-between">
    <div class="flex-1">
<div class="flex items-center gap-3 mb-2">
    <h3 class="text-lg font-semibold text-gray-900">${list.name}</h3>
    <span class="status-badge ${statusInfo.badgeClass}">
        ${statusInfo.label}
    </span>
</div>
<div class="flex items-center gap-4 text-sm text-gray-600 mt-2">
    <span>${list.stores.length}件の店舗</span>
    ${storesWithLocation > 0 ? `<span class="text-gray-400">•</span><span>${storesWithLocation}件が地図表示可能</span>` : ''}
    <span class="text-gray-400">•</span>
    <span class="text-gray-500">更新: ${date}</span>
</div>
    </div>
    <div class="flex gap-2">
<button
    onclick="viewSavedList('${list.id}')"
    class="apclo-button px-4 py-2 bg-gray-900 text-white text-sm font-medium"
>
    閲覧
</button>
${storesWithLocation > 0 ? `
<button
    onclick="showListOnMap('${list.id}')"
    class="apclo-button px-4 py-2 bg-white text-gray-700 border border-gray-300 text-sm font-medium"
>
    地図表示
</button>
` : ''}
${list.status === 'approach' ? `
<button
    onclick="changeListStatus('${list.id}', 'contracted')"
    class="apclo-button px-4 py-2 bg-white text-gray-700 border border-gray-300 text-sm font-medium"
    title="成約済みに変更"
>
    成約
</button>
` : `
<button
    onclick="changeListStatus('${list.id}', 'approach')"
    class="apclo-button px-4 py-2 bg-white text-gray-700 border border-gray-300 text-sm font-medium"
    title="アプローチ中に戻す"
>
    アプローチ
</button>
`}
<button
    onclick="exportSavedList('${list.id}')"
    class="apclo-button px-4 py-2 bg-white text-gray-700 border border-gray-300 text-sm font-medium"
>
    エクスポート
</button>
<button
    onclick="deleteSavedList('${list.id}')"
    class="apclo-button px-4 py-2 bg-white text-red-600 border border-red-300 text-sm font-medium hover:bg-red-50"
>
    削除
</button>
    </div>
</div>
    </div>
`;
    }).join('');
    } catch (error) {
console.error('リスト表示エラー:', error);
if (container) {
    container.innerHTML = '<p class="text-center text-red-500 py-4">リストの読み込みに失敗しました。ページをリロードしてください。</p>';
}
    }
}

// リストのステータス変更（グローバル関数）
window.changeListStatus = async function(listId, newStatus) {
    if (confirm(`このリストを「${newStatus === 'contracted' ? '成約済み' : 'アプローチ中'}」に変更しますか？`)) {
await changeListStatus(listId, newStatus);
    }
};

// Googleマップでリストを表示
let map = null;
let markers = [];
const geocoder = new google.maps.Geocoder();

window.showListOnMap = async function(listId) {
    const lists = await getSavedLists();
    const list = lists.find(l => l.id === listId);
    if (!list) return;
    
    // 住所または座標情報がある店舗をフィルター
    const storesWithLocation = list.stores.filter(s => 
(s.location_lat && s.location_lng) || s.address
    );
    
    if (storesWithLocation.length === 0) {
alert('地図表示可能な店舗がありません（住所または座標情報が必要です）');
return;
    }
    
    // モーダルを表示
    const modal = document.getElementById('mapModal');
    const modalTitle = document.getElementById('mapModalTitle');
    const statusLabel = list.status === 'contracted' ? '✅ 成約済み' : '📋 アプローチ中';
    modalTitle.textContent = `${list.name} (${statusLabel}) - 地図表示 (${storesWithLocation.length}件)`;
    modal.style.display = 'block';
    
    // 地図を初期化（リストのステータスを渡す）
    setTimeout(async () => {
await initMap(storesWithLocation, list.name, list.status);
    }, 100);
};

// 住所から座標を取得
function geocodeAddress(address) {
    return new Promise((resolve, reject) => {
geocoder.geocode({ address: address }, (results, status) => {
    if (status === 'OK' && results[0]) {
resolve({
    lat: results[0].geometry.location.lat(),
    lng: results[0].geometry.location.lng()
});
    } else {
reject(new Error('Geocoding failed: ' + status));
    }
});
    });
}

// 地図を初期化
async function initMap(stores, listName, listStatus = 'approach') {
    // 既存のマーカーを削除
    markers.forEach(marker => marker.setMap(null));
    markers = [];
    
    // 地図の中心を決定（デフォルト: 東京）
    let center = { lat: 35.6812, lng: 139.7671 };
    let bounds = new google.maps.LatLngBounds();
    let hasValidBounds = false;
    
    // 地図を作成
    const mapElement = document.getElementById('map');
    map = new google.maps.Map(mapElement, {
zoom: 10,
center: center,
mapTypeId: 'roadmap'
    });
    
    // ローディング表示
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'map-loading';
    loadingDiv.innerHTML = '<div style="text-align: center; padding: 20px; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"><p>地図を読み込み中...</p></div>';
    mapElement.appendChild(loadingDiv);
    
    // 各店舗にマーカーを追加（非同期処理）
    let processedCount = 0;
    const totalStores = stores.length;
    
    for (let index = 0; index < stores.length; index++) {
const store = stores[index];
let position = null;
let address = store.address || '';

try {
    // 座標情報がある場合はそれを使用
    if (store.location_lat && store.location_lng) {
position = {
    lat: parseFloat(store.location_lat),
    lng: parseFloat(store.location_lng)
};
    } else if (address) {
// 住所から座標を取得
try {
    position = await geocodeAddress(address);
    // 取得した座標を保存（オプション）
    store.location_lat = position.lat;
    store.location_lng = position.lng;
} catch (error) {
    console.warn(`住所の座標取得に失敗: ${address}`, error);
    continue; // 座標取得に失敗した場合はスキップ
}
    } else {
continue; // 座標も住所もない場合はスキップ
    }
    
    // マーカーの色を決定（リストのステータスに応じて）
    const markerColor = listStatus === 'contracted' 
? '#34A853'  // 成約済み: 緑
: '#FBBC04';  // アプローチ中: 黄色
    
    // マーカーを作成
    const marker = new google.maps.Marker({
position: position,
map: map,
title: store.name || '店舗',
label: {
    text: (markers.length + 1).toString(),
    color: 'white',
    fontSize: '12px',
    fontWeight: 'bold'
},
icon: {
    path: google.maps.SymbolPath.CIRCLE,
    scale: 12,
    fillColor: markerColor,
    fillOpacity: 1,
    strokeColor: '#FFFFFF',
    strokeWeight: 2
}
    });
    
    // 情報ウィンドウを作成
    const statusBadge = listStatus === 'contracted' 
? '<span style="background: #34A853; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px; margin-left: 5px;">✅ 成約済み</span>'
: '<span style="background: #FBBC04; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px; margin-left: 5px;">📋 アプローチ中</span>';
    
    const infoWindow = new google.maps.InfoWindow({
content: `
    <div style="padding: 10px; max-width: 300px;">
<h3 style="font-weight: bold; margin-bottom: 5px; display: flex; align-items: center;">
    ${store.name || '名称不明'}
    ${statusBadge}
</h3>
${address ? `<p style="margin: 5px 0; color: #666;">📍 ${address}</p>` : ''}
${store.phone ? `<p style="margin: 5px 0;">📞 <a href="tel:${store.phone}" style="color: #0066cc;">${store.phone}</a></p>` : ''}
${store.category ? `<p style="margin: 5px 0; color: #666;">${store.category}</p>` : ''}
${store.website ? `<p style="margin: 5px 0;"><a href="${store.website}" target="_blank" style="color: #0066cc;">🌐 ウェブサイト</a></p>` : ''}
<p style="margin: 5px 0;">
    <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(store.name || '')}${store.address ? ' ' + encodeURIComponent(store.address) : ''}" target="_blank" style="color: #0066cc;">
        🗺️ Googleマップで開く
    </a>
</p>
    </div>
`
    });
    
    // マーカークリックで情報ウィンドウを表示
    marker.addListener('click', () => {
infoWindow.open(map, marker);
    });
    
    markers.push(marker);
    bounds.extend(position);
    hasValidBounds = true;
    
    processedCount++;
    
    // 進捗表示（オプション）
    if (loadingDiv) {
loadingDiv.innerHTML = `<div style="text-align: center; padding: 20px; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"><p>地図を読み込み中... (${processedCount}/${totalStores})</p></div>`;
    }
    
    // レート制限を考慮して少し待機
    if (index < stores.length - 1) {
await new Promise(resolve => setTimeout(resolve, 100));
    }
} catch (error) {
    console.error(`店舗の処理エラー: ${store.name}`, error);
}
    }
    
    // ローディング表示を削除
    if (loadingDiv && loadingDiv.parentNode) {
loadingDiv.parentNode.removeChild(loadingDiv);
    }
    
    // すべてのマーカーが表示されるように地図を調整
    if (hasValidBounds && markers.length > 0) {
map.fitBounds(bounds);
// ズームレベルが広すぎる場合は調整
google.maps.event.addListenerOnce(map, 'bounds_changed', () => {
    if (map.getZoom() > 15) {
map.setZoom(15);
    }
});
    } else if (markers.length === 1) {
// マーカーが1つの場合はその位置にズーム
map.setCenter(markers[0].getPosition());
map.setZoom(15);
    } else if (markers.length === 0) {
alert('地図表示可能な店舗が見つかりませんでした');
    }
}

// 複数リストを地図に表示（ステータス別に色分け）
async function initMapWithMultipleLists(stores, title) {
    // 既存のマーカーを削除
    markers.forEach(marker => marker.setMap(null));
    markers = [];
    
    // 地図を作成
    const mapElement = document.getElementById('map');
    map = new google.maps.Map(mapElement, {
zoom: 10,
center: { lat: 35.6812, lng: 139.7671 },
mapTypeId: 'roadmap'
    });
    
    // ローディング表示
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'map-loading';
    loadingDiv.innerHTML = '<div style="text-align: center; padding: 20px; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"><p>地図を読み込み中...</p></div>';
    mapElement.appendChild(loadingDiv);
    
    // 全リストを取得して、各店舗のステータスを取得
    const lists = await getSavedLists();
    const storeStatusMap = {};
    lists.forEach(list => {
list.stores.forEach(store => {
    const storeKey = store.store_id || store.name;
    if (!storeStatusMap[storeKey]) {
storeStatusMap[storeKey] = list.status;
    }
});
    });
    
    let bounds = new google.maps.LatLngBounds();
    let hasValidBounds = false;
    let processedCount = 0;
    
    for (let index = 0; index < stores.length; index++) {
const store = stores[index];
let position = null;
let address = store.address || '';
const storeKey = store.store_id || store.name;
const storeStatus = storeStatusMap[storeKey] || 'approach';

try {
    if (store.location_lat && store.location_lng) {
position = {
    lat: parseFloat(store.location_lat),
    lng: parseFloat(store.location_lng)
};
    } else if (address) {
try {
    position = await geocodeAddress(address);
    store.location_lat = position.lat;
    store.location_lng = position.lng;
} catch (error) {
    console.warn(`住所の座標取得に失敗: ${address}`, error);
    continue;
}
    } else {
continue;
    }
    
    // ステータスに応じたマーカー色
    const markerColor = storeStatus === 'contracted' 
? '#34A853'  // 成約済み: 緑
: '#FBBC04';  // アプローチ中: 黄色
    
    const marker = new google.maps.Marker({
position: position,
map: map,
title: store.name || '店舗',
label: {
    text: (markers.length + 1).toString(),
    color: 'white',
    fontSize: '12px',
    fontWeight: 'bold'
},
icon: {
    path: google.maps.SymbolPath.CIRCLE,
    scale: 12,
    fillColor: markerColor,
    fillOpacity: 1,
    strokeColor: '#FFFFFF',
    strokeWeight: 2
}
    });
    
    const statusBadge = storeStatus === 'contracted' 
? '<span style="background: #34A853; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px; margin-left: 5px;">✅ 成約済み</span>'
: '<span style="background: #FBBC04; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px; margin-left: 5px;">📋 アプローチ中</span>';
    
    // 店舗情報を詳細に表示
    const storeInfo = {
name: store.name || '名称不明',
address: store.address || '住所未取得',
phone: store.phone || '電話番号未取得',
website: store.website || '',
category: store.category || 'カテゴリー未設定',
rating: store.rating || '',
deliveryServices: Array.isArray(store.delivery_services) ? store.delivery_services : (store.delivery_services ? [store.delivery_services] : [])
    };
    
    // Googleマップ検索URL（店舗名を優先）
    const mapQuery = storeInfo.name ? (storeInfo.address !== '住所未取得' ? `${storeInfo.name} ${storeInfo.address}` : storeInfo.name) : (storeInfo.address !== '住所未取得' ? storeInfo.address : `${position.lat},${position.lng}`);
    const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`;
    
    const infoWindow = new google.maps.InfoWindow({
content: `
    <div style="padding: 12px; max-width: 350px; font-family: 'Noto Sans JP', sans-serif;">
<h3 style="font-weight: bold; margin-bottom: 8px; font-size: 16px; display: flex; align-items: center; flex-wrap: wrap;">
    ${storeInfo.name}
    ${statusBadge}
</h3>
<div style="border-top: 1px solid #e5e7eb; padding-top: 8px; margin-top: 8px;">
    <div style="margin-bottom: 6px;">
        <span style="font-weight: 600; color: #6b7280; font-size: 12px;">📍 住所:</span>
        <div style="margin-top: 2px; font-size: 13px; color: #1f2937;">${storeInfo.address}</div>
    </div>
    ${storeInfo.phone !== '電話番号未取得' ? `
    <div style="margin-bottom: 6px;">
        <span style="font-weight: 600; color: #6b7280; font-size: 12px;">📞 電話:</span>
        <div style="margin-top: 2px; font-size: 13px; color: #1f2937;"><a href="tel:${storeInfo.phone}" style="color: #2563eb; text-decoration: none;">${storeInfo.phone}</a></div>
    </div>
    ` : ''}
    ${storeInfo.website ? `
    <div style="margin-bottom: 6px;">
        <span style="font-weight: 600; color: #6b7280; font-size: 12px;">🌐 ウェブサイト:</span>
        <div style="margin-top: 2px;">
            <a href="${storeInfo.website}" target="_blank" style="font-size: 13px; color: #2563eb; text-decoration: none;">${storeInfo.website}</a>
        </div>
    </div>
    ` : ''}
    <div style="margin-bottom: 6px;">
        <span style="font-weight: 600; color: #6b7280; font-size: 12px;">🏷️ カテゴリー:</span>
        <div style="margin-top: 2px; font-size: 13px; color: #1f2937;">${storeInfo.category}</div>
    </div>
    ${storeInfo.rating ? `
    <div style="margin-bottom: 6px;">
        <span style="font-weight: 600; color: #6b7280; font-size: 12px;">⭐ 評価:</span>
        <div style="margin-top: 2px; font-size: 13px; color: #1f2937;">${storeInfo.rating} / 5.0</div>
    </div>
    ` : ''}
    ${storeInfo.deliveryServices.length > 0 ? `
    <div style="margin-bottom: 6px;">
        <span style="font-weight: 600; color: #6b7280; font-size: 12px;">🚚 デリバリー:</span>
        <div style="margin-top: 2px; font-size: 12px; color: #1f2937;">
            ${storeInfo.deliveryServices.map(s => `<span style="display: inline-block; background: #f3f4f6; padding: 2px 6px; border-radius: 4px; margin-right: 4px; margin-bottom: 4px;">${s}</span>`).join('')}
        </div>
    </div>
    ` : ''}
    <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid #e5e7eb;">
        <div style="font-size: 11px; color: #9ca3af;">
            座標: ${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}
        </div>
        <div style="margin-top: 4px;">
            <a href="${mapUrl}" target="_blank" style="font-size: 12px; color: #2563eb; text-decoration: none;">
                🗺️ Googleマップで開く
            </a>
        </div>
    </div>
</div>
    </div>
`
    });
    
    marker.addListener('click', () => {
infoWindow.open(map, marker);
    });
    
    markers.push(marker);
    bounds.extend(position);
    hasValidBounds = true;
    processedCount++;
    
    if (loadingDiv) {
loadingDiv.innerHTML = `<div style="text-align: center; padding: 20px; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"><p>地図を読み込み中... (${processedCount}/${stores.length})</p></div>`;
    }
    
    if (index < stores.length - 1) {
await new Promise(resolve => setTimeout(resolve, 100));
    }
} catch (error) {
    console.error(`店舗の処理エラー: ${store.name}`, error);
}
    }
    
    if (loadingDiv && loadingDiv.parentNode) {
loadingDiv.parentNode.removeChild(loadingDiv);
    }
    
    // 凡例を追加
    const legend = document.createElement('div');
    legend.innerHTML = `
<div style="position: absolute; top: 10px; right: 10px; background: white; padding: 10px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.2); z-index: 1000;">
    <div style="font-weight: bold; margin-bottom: 5px;">凡例</div>
    <div style="display: flex; align-items: center; margin: 5px 0;">
<div style="width: 20px; height: 20px; background: #FBBC04; border-radius: 50%; border: 2px solid white; margin-right: 8px;"></div>
<span>📋 アプローチ中</span>
    </div>
    <div style="display: flex; align-items: center; margin: 5px 0;">
<div style="width: 20px; height: 20px; background: #34A853; border-radius: 50%; border: 2px solid white; margin-right: 8px;"></div>
<span>✅ 成約済み</span>
    </div>
</div>
    `;
    legend.style.position = 'relative';
    mapElement.appendChild(legend);
    
    if (hasValidBounds && markers.length > 0) {
map.fitBounds(bounds);
google.maps.event.addListenerOnce(map, 'bounds_changed', () => {
    if (map.getZoom() > 15) {
map.setZoom(15);
    }
});
    } else if (markers.length === 1) {
map.setCenter(markers[0].getPosition());
map.setZoom(15);
    } else if (markers.length === 0) {
alert('地図表示可能な店舗が見つかりませんでした');
    }
}

// モーダルを閉じる
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('mapModal');
    const closeBtn = document.querySelector('.close');
    
    if (closeBtn) {
closeBtn.onclick = () => {
    modal.style.display = 'none';
};
    }
    
    // モーダル外をクリックで閉じる
    window.onclick = (event) => {
if (event.target === modal) {
    modal.style.display = 'none';
}
    };
});

// 保存したリストを閲覧
window.viewSavedList = async function(listId) {
    try {
const lists = await getSavedLists();
const list = lists.find(l => l.id === listId);
if (!list) return;

// 店舗データを保持（ステータスも含める）
window.currentStores = {};
for (const store of list.stores) {
    const storeId = store.store_id || store.name;
    // 保存されたステータスがない場合は、現在のステータスを取得
    if (!store.status) {
store.status = await getStoreStatus(storeId);
    }
    window.currentStores[storeId] = store;
}

// テーブルに表示
const container = document.getElementById('stores-container');
container.innerHTML = '';
for (const store of list.stores) {
    const row = await createStoreTableRow(store);
    container.appendChild(row);
}

// ページネーション情報を更新
const paginationInfo = document.getElementById('pagination-info');
if (paginationInfo) {
    paginationInfo.textContent = `${list.stores.length}件を表示（保存したリスト: ${list.name}）`;
}

// ページネーションを非表示
const pagination = document.getElementById('pagination');
if (pagination) {
    pagination.innerHTML = '';
}

// スクロールして表示
container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
console.error('リスト表示エラー:', error);
const container = document.getElementById('stores-container');
if (container) {
    container.innerHTML = `
<tr>
    <td colspan="15" class="px-6 py-16">
<div class="flex flex-col items-center justify-center text-center">
    <div class="mb-4">
        <svg class="w-16 h-16 text-red-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
    </div>
    <h3 class="text-lg font-semibold text-red-600 mb-2">リストの読み込みに失敗しました</h3>
    <p class="text-sm text-gray-500 mb-6">
        ページをリロードして再度お試しください。
    </p>
    <button 
        onclick="window.location.reload()" 
        class="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200 font-medium shadow-sm"
    >
        ページをリロード
    </button>
</div>
    </td>
</tr>
    `;
}
    }
};

// 保存したリストをエクスポート
window.exportSavedList = async function(listId) {
    const lists = await getSavedLists();
    const list = lists.find(l => l.id === listId);
    if (!list) return;
    
    // CSV形式でエクスポート
    const headers = ['店舗名', '電話番号', 'ウェブサイト', '住所', 'カテゴリ', '評価', '都市', 'Place ID', 'URL', 'オープン日'];
    const csvRows = [headers.join(',')];
    
    list.stores.forEach(store => {
const row = [
    `"${(store.name || '').replace(/"/g, '""')}"`,
    `"${(store.phone || '').replace(/"/g, '""')}"`,
    `"${(store.website || '').replace(/"/g, '""')}"`,
    `"${(store.address || '').replace(/"/g, '""')}"`,
    `"${(store.category || '').replace(/"/g, '""')}"`,
    `"${(store.rating || '').replace(/"/g, '""')}"`,
    `"${(store.city || '').replace(/"/g, '""')}"`,
    `"${(store.place_id || '').replace(/"/g, '""')}"`,
    `"${(store.url || '').replace(/"/g, '""')}"`,
    `"${(store.closed_day || '').replace(/"/g, '""')}",` +
    `"${(store.opening_date || '').replace(/"/g, '""')}"`
];
csvRows.push(row.join(','));
    });
    
    const csvContent = '\ufeff' + csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${list.name}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
};

// 保存したリストを削除
window.deleteSavedList = async function(listId) {
    if (!confirm('このリストを削除しますか？')) return;
    
    const lists = await getSavedLists();
    const filtered = lists.filter(l => l.id !== listId);
    const key = getPartnerStorageKey('savedLists');
    localStorage.setItem(key, JSON.stringify(filtered));
    await displaySavedLists();
};

// 選択された店舗数を更新
function updateSelectedCount() {
    const checkboxes = document.querySelectorAll('.store-checkbox:checked');
    const saveBtn = document.getElementById('btn-save-selected');
    if (checkboxes.length > 0) {
saveBtn.style.display = 'block';
saveBtn.textContent = `💾 ${checkboxes.length}件を保存`;
    } else {
saveBtn.style.display = 'none';
    }
}

// 選択した店舗を保存
async function saveSelectedStores() {
    const checkboxes = document.querySelectorAll('.store-checkbox:checked');
    if (checkboxes.length === 0) {
alert('保存する店舗を選択してください');
return;
    }
    
    const listName = prompt('リスト名を入力してください（既存のリスト名を入力すると追加されます）:');
    if (!listName) return;
    
    // ステータスを選択
    const statusChoice = confirm('成約済みリストとして保存しますか？\n（「キャンセル」を選択するとアプローチリストとして保存されます）');
    const status = statusChoice ? 'contracted' : 'approach';
    
    const stores = [];
    for (const checkbox of checkboxes) {
const storeId = checkbox.dataset.storeId;
// 保持されている店舗データから取得
if (window.currentStores && window.currentStores[storeId]) {
    const store = window.currentStores[storeId];
    // 店舗の現在のステータスを取得
    const currentStoreStatus = await getStoreStatus(storeId);
    if (currentStoreStatus !== 'none') {
store.status = currentStoreStatus;
    }
    stores.push(store);
}
    }
    
    if (stores.length === 0) {
alert('店舗データの取得に失敗しました');
return;
    }
    
    // 既存のリストに追加するか、新規作成
    const lists = await getSavedLists();
    let targetList = lists.find(l => l.name === listName);
    
    if (targetList) {
// 既存のリストに追加（重複チェック）
stores.forEach(store => {
    const exists = targetList.stores.some(s => 
(s.store_id && store.store_id && s.store_id === store.store_id) ||
(!s.store_id && !store.store_id && s.name === store.name)
    );
    if (!exists) {
targetList.stores.push(store);
    }
});
targetList.updatedAt = new Date().toISOString();
// ステータスが異なる場合は更新
if (targetList.status !== status) {
    targetList.status = status;
}
const key = getPartnerStorageKey('savedLists');
localStorage.setItem(key, JSON.stringify(lists));
    } else {
saveList(listName, stores, status);
    }
    
    // チェックボックスをリセット
    checkboxes.forEach(cb => cb.checked = false);
    updateSelectedCount();
    await displaySavedLists();
    alert(`「${listName}」に${stores.length}件の店舗を${status === 'contracted' ? '成約済みとして' : 'アプローチ中として'}保存しました`);
}

function renderPagination(current, total) {
    const pagination = document.getElementById('pagination');
    pagination.innerHTML = '';
    if (total <= 1) return;
    const prevBtn = document.createElement('button');
    prevBtn.textContent = '前へ';
    prevBtn.className = 'px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50';
    prevBtn.disabled = current === 1;
    prevBtn.addEventListener('click', () => loadStores(current - 1));
    pagination.appendChild(prevBtn);
    const start = Math.max(1, current - 2);
    const end = Math.min(total, current + 2);
    for (let i = start; i <= end; i++) {
const btn = document.createElement('button');
btn.textContent = i;
btn.className = `px-4 py-2 border rounded-lg ${
    i === current 
? 'bg-blue-600 text-white border-blue-600' 
: 'border-gray-300 hover:bg-gray-50'
}`;
btn.addEventListener('click', () => loadStores(i));
pagination.appendChild(btn);
    }
    const nextBtn = document.createElement('button');
    nextBtn.textContent = '次へ';
    nextBtn.className = 'px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50';
    nextBtn.disabled = current === total;
    nextBtn.addEventListener('click', () => loadStores(current + 1));
    pagination.appendChild(nextBtn);
}

function updateSearchKeywordsDisplay() {
    const container = document.getElementById('search-keywords');
    container.innerHTML = '';
    searchKeywords.forEach((keyword, index) => {
const tag = document.createElement('div');
tag.className = 'inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm';
tag.innerHTML = `
    <span>${escapeHtml(keyword)}</span>
    <button 
type="button"
onclick="removeKeyword(${index})"
class="ml-2 text-blue-600 hover:text-blue-800 font-bold"
    >×</button>
`;
container.appendChild(tag);
    });
}

function addKeyword(keyword) {
    const trimmed = keyword.trim();
    if (trimmed && !searchKeywords.includes(trimmed)) {
searchKeywords.push(trimmed);
updateSearchKeywordsDisplay();
updateSearchQuery();
loadStores(1);
    }
}

window.removeKeyword = function(index) {
    searchKeywords.splice(index, 1);
    updateSearchKeywordsDisplay();
    updateSearchQuery();
    loadStores(1);
};

function updateSearchQuery() {
    currentFilters.search = searchKeywords.join(' ');
}

function handleSearchKeyDown(e) {
    if (e.key === 'Enter') {
e.preventDefault();
const value = e.target.value.trim();
if (value) {
    addKeyword(value);
    e.target.value = '';
}
    } else if (e.key === 'Backspace' && e.target.value === '' && searchKeywords.length > 0) {
removeKeyword(searchKeywords.length - 1);
    }
}

function resetFilters() {
    document.getElementById('search-input').value = '';
    searchKeywords = [];
    updateSearchKeywordsDisplay();
    const areaCheckboxes = document.querySelectorAll('#area-filter-container input[type="checkbox"]');
    areaCheckboxes.forEach(cb => cb.checked = false);
    const prefectureCheckboxes = document.querySelectorAll('#prefecture-filter-container input[type="checkbox"]');
    prefectureCheckboxes.forEach(cb => cb.checked = false);
    document.getElementById('city-search-input').value = '';
    document.getElementById('city-search-input').style.display = 'none';
    const cityCheckboxes = document.querySelectorAll('#city-filter-container input[type="checkbox"]');
    cityCheckboxes.forEach(cb => cb.checked = false);
    document.getElementById('city-filter-container').innerHTML = '<p class="text-xs text-gray-500">都道府県を選択してください</p>';
    document.getElementById('selected-cities-display').style.display = 'none';
    allCitiesData = [];
    document.getElementById('category-search-input').value = '';
    const categoryCheckboxes = document.querySelectorAll('#category-filter-container input[type="checkbox"]');
    categoryCheckboxes.forEach(cb => cb.checked = false);
    document.getElementById('selected-categories-display').style.display = 'none';
    
    // データソースフィルターをリセット
    document.querySelectorAll('.delivery-service-checkbox').forEach(cb => cb.checked = false);
    
    // 全項目フィルターをリセット
    document.getElementById('phone-filter-input').value = '';
    document.getElementById('website-filter-input').value = '';
    document.getElementById('rating-filter-operator').value = '>=';
    document.getElementById('rating-filter-value').value = '';
    
    // ヘッダーフィルターをリセット
    ['name', 'address', 'contact', 'category', 'delivery', 'status'].forEach(column => {
if (headerFilterData[column]) {
    headerFilterData[column].selected = [];
}
const menu = document.getElementById(`header-filter-menu-${column}`);
if (menu) {
    menu.classList.remove('show');
}
if (column === 'delivery' || column === 'status') {
    const checkboxes = document.querySelectorAll(`#header-filter-values-${column} input[type="checkbox"]`);
    checkboxes.forEach(cb => cb.checked = true);
}
    });
    
    // ヘッダーフィルターの状態をリセット
    currentFilters.headerName = '';
    currentFilters.headerAddress = '';
    currentFilters.headerContact = '';
    currentFilters.headerCategory = '';
    currentFilters.headerDelivery = '';
    currentFilters.headerStatus = '';
    currentFilters.headerClosedDay = '';
    currentFilters.headerOpeningDate = '';
    currentFilters.headerTransport = '';
    currentFilters.headerBusinessHours = '';
    currentFilters.headerOfficialAccount = '';
    currentFilters.headerCollectedAt = '';
    
    document.querySelector('input[name="search-mode"][value="AND"]').checked = true;
    document.querySelector('input[name="match-type"][value="partial"]').checked = true;
    currentFilters = { prefectures: [], cities: [], categories: [], dataSources: DATA_SOURCES.map(s => s.value), search: '', searchMode: 'AND', matchType: 'partial', phone: '', website: '', ratingOperator: '>=', ratingValue: '', headerName: '', headerAddress: '', headerContact: '', headerCategory: '', headerDelivery: '', headerStatus: '', headerClosedDay: '', headerOpeningDate: '', headerTransport: '', headerBusinessHours: '', headerOfficialAccount: '', headerCollectedAt: '' };
    filterAndDisplayCategories();
    loadStores(1);
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
const later = () => {
    clearTimeout(timeout);
    func(...args);
};
clearTimeout(timeout);
timeout = setTimeout(later, wait);
    };
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// エクスポート処理中のモーダル表示
function showExportModal(format) {
    const modal = document.createElement('div');
    modal.id = 'export-modal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
<div class="bg-white rounded-lg p-8 max-w-md w-full mx-4">
    <div class="text-center">
<div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
<h3 class="text-lg font-semibold text-gray-900 mb-2">${format === 'CSV' ? 'CSV' : 'JSON'}エクスポート処理中</h3>
<p class="text-sm text-gray-600 mb-4">データを準備しています...</p>
<div class="w-full bg-gray-200 rounded-full h-2.5 mb-2">
    <div id="export-progress-bar" class="bg-blue-600 h-2.5 rounded-full transition-all duration-300" style="width: 0%"></div>
</div>
<p id="export-progress-text" class="text-xs text-gray-500">0%</p>
    </div>
</div>
    `;
    document.body.appendChild(modal);
    
    // プログレスバーを初期状態から少し進める（視覚的フィードバック）
    let progress = 0;
    const progressInterval = setInterval(() => {
// 90%まで徐々に進める（実際の処理が完了するまで）
if (progress < 25) {
    progress = Math.min(progress + Math.random() * 3, 25);
}
const progressBar = document.getElementById('export-progress-bar');
const progressText = document.getElementById('export-progress-text');
if (progressBar && progressText && progressBar.style.width !== '100%') {
    const currentWidth = parseFloat(progressBar.style.width) || 0;
    if (currentWidth < 25) {
progressBar.style.width = `${progress}%`;
progressText.textContent = `${Math.floor(progress)}%`;
    }
}
    }, 300);
    
    return { modal, progressInterval };
}

function hideExportModal(modal, progressInterval) {
    if (progressInterval) {
clearInterval(progressInterval);
    }
    if (modal) {
modal.remove();
    }
}

async function handleExportCSV() {
    try {
const params = new URLSearchParams({
    search: currentFilters.search || '',
    search_mode: currentFilters.searchMode || 'AND',
    match_type: currentFilters.matchType || 'partial'
});

// フィルターパラメータを追加
if (currentFilters.prefectures && currentFilters.prefectures.length > 0) {
    currentFilters.prefectures.forEach(pref => params.append('prefectures', pref));
}
if (currentFilters.cities && currentFilters.cities.length > 0) {
    currentFilters.cities.forEach(city => params.append('cities', city));
}
if (currentFilters.categories && currentFilters.categories.length > 0) {
    currentFilters.categories.forEach(cat => params.append('categories', cat));
}
if (currentFilters.deliveryServices && currentFilters.deliveryServices.length > 0) {
    // データソースフィルター
if (currentFilters.dataSources.length > 0 && currentFilters.dataSources.length < DATA_SOURCES.length) {
    currentFilters.dataSources.forEach(source => params.append('data_sources', source));
}
}

const url = `${STORE_API_BASE}/api/export/csv?${params}`;

console.log('CSVエクスポート開始:', {
    url: url,
    filters: currentFilters,
    params: params.toString()
});

// モーダル表示
const modalResult = showExportModal('CSV');
modal = modalResult.modal;
progressInterval = modalResult.progressInterval;

const progressBar = document.getElementById('export-progress-bar');
const progressText = document.getElementById('export-progress-text');

// プログレスバーを30%に
if (progressBar && progressText) {
    progressBar.style.width = '30%';
    progressText.textContent = '30% - リクエスト送信中...';
}

// fetch APIでリクエスト（タイムアウト設定を延長）
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 600000); // 10分タイムアウト

// 進捗をシミュレート（実際のレスポンスを待つ間）
const progressSimulation = setInterval(() => {
    const currentWidth = parseFloat(progressBar?.style.width || '30');
    if (currentWidth < 70) {
const newWidth = Math.min(currentWidth + 0.5, 70);
if (progressBar && progressText) {
    progressBar.style.width = `${newWidth}%`;
    progressText.textContent = `${Math.floor(newWidth)}% - サーバー処理中...`;
}
    }
}, 500);

let response;
try {
    response = await fetch(url, {
        signal: controller.signal
    });
} catch (fetchError) {
    clearTimeout(timeoutId);
    clearInterval(progressSimulation);
    // エラー時も進捗を更新
    if (progressBar && progressText) {
        progressBar.style.width = '100%';
        progressText.textContent = 'エラー発生';
    }
    throw fetchError;
}

clearTimeout(timeoutId);
clearInterval(progressSimulation);

// プログレスバーを75%に
if (progressBar && progressText) {
    progressBar.style.width = '75%';
    progressText.textContent = '75% - データ受信中...';
}

if (!response.ok) {
    // エラー時も進捗を更新
    if (progressBar && progressText) {
        progressBar.style.width = '100%';
        progressText.textContent = `エラー: ${response.status}`;
    }
    throw new Error(`HTTP error! status: ${response.status}`);
}

// プログレスバーを85%に
if (progressBar && progressText) {
    progressBar.style.width = '85%';
    progressText.textContent = '85% - データ処理中...';
}

// Blobとして取得（ストリーミング対応）
const reader = response.body.getReader();
const chunks = [];
let receivedBytes = 0;

try {
    while (true) {
const { done, value } = await reader.read();
if (done) break;

if (value) {
    chunks.push(value);
    receivedBytes += value.length;
    
    // 進捗を更新（85%から95%まで）
    if (progressBar && progressText) {
const estimatedProgress = 85 + Math.min((receivedBytes / 1000000) * 10, 10); // 1MBごとに10%増加（最大95%）
progressBar.style.width = `${estimatedProgress}%`;
progressText.textContent = `${Math.floor(estimatedProgress)}% - データ受信中... (${(receivedBytes / 1024 / 1024).toFixed(1)}MB)`;
    }
}
    }
} catch (readError) {
    console.error('ストリーム読み込みエラー:', readError);
    // エラーが発生しても、既に受信したデータで続行
    if (chunks.length === 0) {
throw readError;
    }
}

// プログレスバーを95%に
if (progressBar && progressText) {
    progressBar.style.width = '95%';
    progressText.textContent = '95% - ダウンロード準備中...';
}

// Blobを構築
if (chunks.length === 0) {
    throw new Error('データが受信されませんでした。サーバーから空のレスポンスが返されました。');
}

const blob = new Blob(chunks, { type: 'text/csv; charset=utf-8' });

// Blobサイズの確認
if (blob.size === 0) {
    throw new Error('ダウンロードファイルのサイズが0バイトです。データが正しく取得できていません。');
}

console.log(`CSVファイルサイズ: ${(blob.size / 1024).toFixed(2)}KB`);

// ダウンロードリンクを作成
const downloadUrl = window.URL.createObjectURL(blob);
const filename = `restaurants_export_${new Date().getTime()}.csv`;
const a = document.createElement('a');
a.href = downloadUrl;
a.download = filename;
document.body.appendChild(a);
a.click();
document.body.removeChild(a);
window.URL.revokeObjectURL(downloadUrl);

// ダウンロード履歴を保存
const currentPartnerId = sessionStorage.getItem("currentPartnerId");
let estimatedCount = 0;
if (currentPartnerId) {
    const downloadHistoryKey = `download_history_${currentPartnerId}`;
    const downloadHistory = JSON.parse(localStorage.getItem(downloadHistoryKey) || '[]');
    // ファイルサイズを推定（バイト数から）
    estimatedCount = Math.floor(receivedBytes / 200); // 1件あたり約200バイトと仮定
    downloadHistory.unshift({
filename: filename,
downloadedAt: new Date().toISOString(),
count: estimatedCount,
type: 'CSV',
size: blob.size
    });
    // 最新100件のみ保持
    if (downloadHistory.length > 100) {
downloadHistory.splice(100);
    }
    localStorage.setItem(downloadHistoryKey, JSON.stringify(downloadHistory));
}

// プログレスバーを100%に
if (progressBar && progressText) {
    progressBar.style.width = '100%';
    progressText.textContent = '100% - 完了！';
}

// 少し待ってからモーダルを閉じる
setTimeout(() => {
    hideExportModal(modal, progressInterval);
}, 1000);

console.log('CSVエクスポート完了:', {
    filename: filename,
    size: `${(blob.size / 1024).toFixed(2)}KB`,
    records: estimatedCount || '不明'
});

    } catch (error) {
console.error('CSVエクスポートエラー:', error);
console.error('エラー詳細:', {
    name: error.name,
    message: error.message,
    stack: error.stack,
    url: url || '未定義'
});

// モーダルが存在する場合のみ閉じる
if (modal && progressInterval) {
    hideExportModal(modal, progressInterval);
}

let errorMessage = 'CSVエクスポートに失敗しました。\n';

if (error.name === 'AbortError') {
    errorMessage = 'CSVエクスポートがタイムアウトしました。\nデータ量が多い場合は、フィルターを適用して件数を減らしてください。';
} else if (error.message && error.message.includes('HTTP error')) {
    const statusMatch = error.message.match(/status: (\d+)/);
    const status = statusMatch ? statusMatch[1] : '不明';
    
    if (status === '403') {
        errorMessage = 'CSVエクスポートに失敗しました。\nアクセスが拒否されました（403エラー）。\n\nngrokを使用している場合、ブラウザの警告ページをスキップしてください。\nまたは、サーバーのログを確認してください。';
    } else {
        errorMessage = `CSVエクスポートに失敗しました。\nサーバーエラーが発生しました（HTTP ${status}）。\n\n${error.message}\n\nブラウザのコンソール（F12）で詳細を確認してください。`;
    }
} else {
    errorMessage += error.message || '不明なエラーが発生しました。';
    errorMessage += '\n\nブラウザのコンソール（F12）で詳細を確認してください。';
}

alert(errorMessage);
    }
}

async function handleExportJSON() {
    const params = new URLSearchParams({
search: currentFilters.search,
search_mode: currentFilters.searchMode,
match_type: currentFilters.matchType
    });
    currentFilters.prefectures.forEach(pref => params.append('prefectures', pref));
    currentFilters.cities.forEach(city => params.append('cities', city));
    currentFilters.categories.forEach(cat => params.append('categories', cat));
    currentFilters.deliveryServices.forEach(service => params.append('delivery_services', service));
    
    const url = `${STORE_API_BASE}/api/export/json?${params}`;
    
    // モーダル表示
    const { modal, progressInterval } = showExportModal('JSON');
    
    try {
const progressBar = document.getElementById('export-progress-bar');
const progressText = document.getElementById('export-progress-text');

// プログレスバーを30%に
if (progressBar && progressText) {
    progressBar.style.width = '30%';
    progressText.textContent = '30% - リクエスト送信中...';
}

// fetch APIでリクエスト（タイムアウト設定を延長）
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 600000); // 10分タイムアウト

// 進捗をシミュレート（実際のレスポンスを待つ間）
const progressSimulation = setInterval(() => {
    const currentWidth = parseFloat(progressBar?.style.width || '30');
    if (currentWidth < 70) {
const newWidth = Math.min(currentWidth + 0.5, 70);
if (progressBar && progressText) {
    progressBar.style.width = `${newWidth}%`;
    progressText.textContent = `${Math.floor(newWidth)}% - サーバー処理中...`;
}
    }
}, 500);

let response;
try {
    response = await fetch(url, {
        signal: controller.signal
    });
} catch (fetchError) {
    clearTimeout(timeoutId);
    clearInterval(progressSimulation);
    // エラー時も進捗を更新
    if (progressBar && progressText) {
        progressBar.style.width = '100%';
        progressText.textContent = 'エラー発生';
    }
    throw fetchError;
}

clearTimeout(timeoutId);
clearInterval(progressSimulation);

// プログレスバーを75%に
if (progressBar && progressText) {
    progressBar.style.width = '75%';
    progressText.textContent = '75% - データ受信中...';
}

if (!response.ok) {
    // エラー時も進捗を更新
    if (progressBar && progressText) {
        progressBar.style.width = '100%';
        progressText.textContent = `エラー: ${response.status}`;
    }
    throw new Error(`HTTP error! status: ${response.status}`);
}

// プログレスバーを85%に
if (progressBar && progressText) {
    progressBar.style.width = '85%';
    progressText.textContent = '85% - データ処理中...';
}

// Blobとして取得（ストリーミング対応）
const reader = response.body.getReader();
const chunks = [];
let receivedBytes = 0;

try {
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        chunks.push(value);
        receivedBytes += value.length;
        
        // 進捗を更新（85%から95%まで）
        if (progressBar && progressText) {
            const estimatedProgress = 85 + Math.min((receivedBytes / 1000000) * 10, 10); // 1MBごとに10%増加（最大95%）
            progressBar.style.width = `${estimatedProgress}%`;
            progressText.textContent = `${Math.floor(estimatedProgress)}% - データ受信中... (${(receivedBytes / 1024 / 1024).toFixed(1)}MB)`;
        }
    }
} catch (readError) {
    console.error('ストリーム読み込みエラー:', readError);
    // エラーが発生しても、既に受信したデータで続行
    if (chunks.length === 0) {
        if (progressBar && progressText) {
            progressBar.style.width = '100%';
            progressText.textContent = 'エラー: データ読み込み失敗';
        }
        throw readError;
    }
}

// プログレスバーを95%に
if (progressBar && progressText) {
    progressBar.style.width = '95%';
    progressText.textContent = '95% - ダウンロード準備中...';
}

// Blobを構築
const blob = new Blob(chunks, { type: 'application/json; charset=utf-8' });

// ダウンロードリンクを作成
const downloadUrl = window.URL.createObjectURL(blob);
const filename = `restaurants_export_${new Date().getTime()}.json`;
const a = document.createElement('a');
a.href = downloadUrl;
a.download = filename;
document.body.appendChild(a);
a.click();
document.body.removeChild(a);
window.URL.revokeObjectURL(downloadUrl);

// ダウンロード履歴を保存
const currentPartnerId = sessionStorage.getItem("currentPartnerId");
if (currentPartnerId) {
    const downloadHistoryKey = `download_history_${currentPartnerId}`;
    const downloadHistory = JSON.parse(localStorage.getItem(downloadHistoryKey) || '[]');
    // ファイルサイズから件数を推定
    const estimatedCount = Math.floor(receivedBytes / 500); // JSONは1件あたり約500バイトと仮定
    downloadHistory.unshift({
filename: filename,
downloadedAt: new Date().toISOString(),
count: estimatedCount,
type: 'JSON'
    });
    // 最新100件のみ保持
    if (downloadHistory.length > 100) {
downloadHistory.splice(100);
    }
    localStorage.setItem(downloadHistoryKey, JSON.stringify(downloadHistory));
}

// プログレスバーを100%に
if (progressBar && progressText) {
    progressBar.style.width = '100%';
    progressText.textContent = '100% - 完了！';
}

// 少し待ってからモーダルを閉じる
setTimeout(() => {
    hideExportModal(modal, progressInterval);
}, 1000);

    } catch (error) {
console.error('JSONエクスポートエラー:', error);
hideExportModal(modal, progressInterval);

if (error.name === 'AbortError') {
    alert('JSONエクスポートがタイムアウトしました。\nデータ量が多い場合は、フィルターを適用して件数を減らしてください。');
} else {
    alert('JSONエクスポートに失敗しました。\n' + error.message);
}
    }
}

// ヘッダーフィルターメニューの管理
let currentHeaderFilterMenu = null;
let headerFilterData = {
    name: { values: [], selected: [] },
    address: { values: [], selected: [] },
    contact: { values: [], selected: [] },
    category: { values: [], selected: [] },
    delivery: { values: [], selected: [] },
    status: { values: [], selected: [] },
    closed_day: { values: [], selected: [] },
    opening_date: { values: [], selected: [] },
    transport: { values: [], selected: [] },
    business_hours: { values: [], selected: [] },
    official_account: { values: [], selected: [] },
    collected_at: { values: [], selected: [] },
    data_source: { values: [], selected: [] }
};

// フィルターアイコンをクリックしてフィルターメニューを表示
function setupHeaderFilterIcons() {
    document.querySelectorAll('.header-filter-icon').forEach(icon => {
// 既存のイベントリスナーを削除（重複防止）
const newIcon = icon.cloneNode(true);
icon.parentNode.replaceChild(newIcon, icon);

newIcon.addEventListener('click', (e) => {
    e.stopPropagation(); // イベントの伝播を停止
    e.preventDefault(); // デフォルト動作を防止
    
    // 親のth要素から列名を取得
    const th = newIcon.closest('.header-filter-th');
    if (!th) {
console.warn('header-filter-th not found');
return;
    }
    
    const column = th.dataset.column;
    if (!column) {
console.warn('data-column not found');
return;
    }
    
    const menu = document.getElementById(`header-filter-menu-${column}`);
    if (!menu) {
console.warn(`Menu not found: header-filter-menu-${column}`);
return;
    }
    
    // 他のメニューを閉じる
    document.querySelectorAll('.header-filter-menu').forEach(m => {
if (m !== menu) {
    m.classList.remove('show');
}
    });
    
    // 現在のメニューを開く/閉じる
    menu.classList.toggle('show');
    currentHeaderFilterMenu = menu.classList.contains('show') ? column : null;
    
    // メニューが開いたら、位置を調整して値のリストを更新
    if (menu.classList.contains('show')) {
updateHeaderFilterValues(column);
// 少し遅延を入れて、メニューのサイズが確定してから位置を調整
setTimeout(() => {
    adjustMenuPosition(menu, th);
    // スクロール時にも位置を再調整
    const adjustOnScroll = () => {
if (menu.classList.contains('show')) {
    adjustMenuPosition(menu, th);
}
    };
    window.addEventListener('scroll', adjustOnScroll, { once: true });
    window.addEventListener('resize', adjustOnScroll, { once: true });
}, 50);
    }
});
    });
}

// DOMContentLoadedとsetTimeoutの両方で実行
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
setTimeout(setupHeaderFilterIcons, 100);
    });
} else {
    setTimeout(setupHeaderFilterIcons, 100);
}

// 動的に追加される要素にも対応するため、定期的に再設定
setTimeout(() => {
    setupHeaderFilterIcons();
}, 500);

// メニュー外をクリックで閉じる
document.addEventListener('click', (e) => {
    // フィルターアイコンやメニュー内のクリックは除外
    if (e.target.closest('.header-filter-icon') || e.target.closest('.header-filter-menu') || e.target.closest('.header-filter-th')) {
return;
    }
    
    document.querySelectorAll('.header-filter-menu').forEach(m => {
m.classList.remove('show');
    });
    currentHeaderFilterMenu = null;
});

// 列の値リストを更新
function updateHeaderFilterValues(column) {
    const container = document.getElementById(`header-filter-values-${column}`);
    if (!container) return;
    
    // データソースは設定から動的に生成されるため、固定値として扱う
    if (column === 'data_source') {
headerFilterData[column].values = DATA_SOURCES.map(s => s.value);
    }
    // デリバリーサービスとステータスは固定値なので更新不要
    if (column === 'delivery' || column === 'status') {
return;
    }
    
    if (!window.currentStores || Object.keys(window.currentStores).length === 0) {
// データがまだ読み込まれていない場合は、全データから取得
loadStores(1).then(() => {
    updateHeaderFilterValues(column);
});
return;
    }
    
    const stores = Object.values(window.currentStores);
    let values = [];
    
    if (column === 'name') {
values = [...new Set(stores.map(s => s.name || '').filter(v => v))];
    } else if (column === 'address') {
values = [...new Set(stores.map(s => s.address || '').filter(v => v))];
    } else if (column === 'contact') {
values = [...new Set([
    ...stores.map(s => s.phone || '').filter(v => v),
    ...stores.map(s => s.website || '').filter(v => v)
])];
    } else if (column === 'category') {
values = [...new Set(stores.map(s => s.category || '').filter(v => v))];
    } else if (column === 'closed_day') {
values = [...new Set(stores.map(s => s.closed_day || '').filter(v => v))];
    } else if (column === 'opening_date') {
values = [...new Set(stores.map(s => s.opening_date || '').filter(v => v))];
    } else if (column === 'transport') {
values = [...new Set(stores.map(s => s.transport || '').filter(v => v))];
    } else if (column === 'business_hours') {
values = [...new Set(stores.map(s => s.business_hours || '').filter(v => v))];
    } else if (column === 'official_account') {
// 公式アカウントは配列または文字列の可能性がある
values = [...new Set(stores.map(s => {
    if (Array.isArray(s.official_account)) {
return s.official_account.join(', ');
    }
    return s.official_account || '';
}).filter(v => v))];
    } else if (column === 'collected_at') {
values = [...new Set(stores.map(s => s.collected_at || '').filter(v => v))];
    } else if (column === 'data_source') {
// データソースは設定から動的に生成
values = DATA_SOURCES.map(s => s.value);
    } else {
// 将来追加される列にも自動的に対応（汎用的な処理）
values = [...new Set(stores.map(s => {
    const value = s[column];
    if (Array.isArray(value)) {
return value.join(', ');
    }
    return value || '';
}).filter(v => v))];
    }
    
    // データソース列の場合は設定から生成した値を使用（既に設定済みの場合はスキップ）
    if (column !== 'data_source') {
headerFilterData[column].values = values.sort();
    }
    
    // 値のリストを表示
    container.innerHTML = '';
    const searchInput = document.getElementById(`header-filter-search-${column}`);
    const searchQuery = searchInput ? searchInput.value.toLowerCase() : '';
    
    // データソース列の場合は設定から生成した値を使用
    const valuesToUse = column === 'data_source' ? DATA_SOURCES.map(s => s.value) : values;
    const filteredValues = searchQuery 
? valuesToUse.filter(v => {
    const source = DATA_SOURCES.find(s => s.value === v);
    const displayValue = source ? source.label : v;
    return displayValue.toLowerCase().includes(searchQuery);
})
: valuesToUse;
    
    if (filteredValues.length === 0) {
container.innerHTML = '<div class="header-filter-value-item" style="padding: 12px; color: #6b7280; text-align: center;">該当する値がありません</div>';
return;
    }
    
    // 「すべて選択」リンク
    const selectAllDiv = document.createElement('div');
    selectAllDiv.className = 'header-filter-value-item';
    selectAllDiv.style.padding = '8px 12px';
    selectAllDiv.style.borderBottom = '1px solid #e5e7eb';
    const selectAllLink = document.createElement('a');
    selectAllLink.href = '#';
    selectAllLink.style.color = '#2563eb';
    selectAllLink.style.textDecoration = 'none';
    selectAllLink.textContent = `${filteredValues.length}をすべて選択`;
    selectAllLink.onclick = (e) => {
e.preventDefault();
filteredValues.forEach(val => {
    if (!headerFilterData[column].selected.includes(val)) {
headerFilterData[column].selected.push(val);
    }
});
renderHeaderFilterValues(column);
    };
    selectAllDiv.appendChild(selectAllLink);
    container.appendChild(selectAllDiv);
    
    // 各値のチェックボックス
    filteredValues.forEach(value => {
const item = document.createElement('div');
item.className = 'header-filter-value-item';
const checkbox = document.createElement('input');
checkbox.type = 'checkbox';
checkbox.id = `header-filter-${column}-${value.replace(/[^a-zA-Z0-9]/g, '_')}`;
checkbox.value = value;
checkbox.checked = headerFilterData[column].selected.length === 0 || headerFilterData[column].selected.includes(value);
checkbox.onchange = () => {
    if (checkbox.checked) {
if (!headerFilterData[column].selected.includes(value)) {
    headerFilterData[column].selected.push(value);
}
    } else {
const index = headerFilterData[column].selected.indexOf(value);
if (index > -1) {
    headerFilterData[column].selected.splice(index, 1);
}
    }
    
    // データソース列の場合、左側フィルターも同期
    if (column === 'data_source') {
syncLeftDataSourceFilter();
    }
};
const label = document.createElement('label');
label.htmlFor = checkbox.id;
// データソース列の場合は表示名を使用
if (column === 'data_source') {
    const source = DATA_SOURCES.find(s => s.value === value);
    label.textContent = source ? source.label : value || '(空白)';
} else {
    label.textContent = value || '(空白)';
}
label.style.cursor = 'pointer';
item.appendChild(checkbox);
item.appendChild(label);
container.appendChild(item);
    });
}

// ヘッダーフィルター値の表示を更新
function renderHeaderFilterValues(column) {
    const container = document.getElementById(`header-filter-values-${column}`);
    if (!container) return;
    
    const checkboxes = container.querySelectorAll('input[type="checkbox"]:not([id*="all"])');
    checkboxes.forEach(cb => {
cb.checked = headerFilterData[column].selected.length === 0 || headerFilterData[column].selected.includes(cb.value);
    });
}

// ヘッダーフィルター値の検索
function filterHeaderValues(column) {
    updateHeaderFilterValues(column);
}

// フィルターメニューの位置を調整（画面端で見切れないように）
function adjustMenuPosition(menu, thElement) {
    if (!menu || !thElement) return;
    
    const thRect = thElement.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const menuWidth = menuRect.width || menu.offsetWidth || 280;
    const menuHeight = menuRect.height || menu.offsetHeight || 400;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const scrollY = window.scrollY || window.pageYOffset;
    const scrollX = window.scrollX || window.pageXOffset;
    const margin = 10; // マージン
    
    let left = thRect.left + scrollX;
    let top = thRect.bottom + scrollY + 5; // 5pxの間隔
    
    // 右端で見切れる場合、左側に調整
    if (left + menuWidth > viewportWidth + scrollX - margin) {
left = Math.max(margin, viewportWidth + scrollX - menuWidth - margin);
    }
    
    // 左端で見切れる場合、右側に調整
    if (left < scrollX + margin) {
left = scrollX + margin;
    }
    
    // 下端で見切れる場合、上側に表示
    const spaceBelow = viewportHeight + scrollY - (thRect.bottom + scrollY);
    const spaceAbove = (thRect.top + scrollY) - scrollY;
    
    if (spaceBelow < menuHeight + margin && spaceAbove > spaceBelow) {
// 上側に表示する方がスペースがある場合
top = thRect.top + scrollY - menuHeight - 5;
// 上側でも見切れる場合、画面内に収める
if (top < scrollY + margin) {
    top = scrollY + margin;
    const maxHeight = Math.min(menuHeight, viewportHeight - margin * 2);
    menu.style.maxHeight = maxHeight + 'px';
}
    } else if (spaceBelow < menuHeight + margin) {
// 下側のスペースが足りない場合、画面内に収める
const maxHeight = Math.max(200, spaceBelow - margin * 2);
menu.style.maxHeight = maxHeight + 'px';
    } else {
// 十分なスペースがある場合、デフォルトの最大高さに戻す
menu.style.maxHeight = '500px';
    }
    
    // 位置を設定
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
    menu.style.position = 'fixed'; // fixedに変更して確実に表示
    
    // 視認性を向上させるため、背景とシャドウを強化
    menu.style.backgroundColor = '#ffffff';
    menu.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
    menu.style.border = '1px solid #e5e7eb';
}

// すべて選択/解除
function toggleHeaderFilterAll(column, checkbox) {
    const container = document.getElementById(`header-filter-values-${column}`);
    if (!container) return;
    
    const checkboxes = container.querySelectorAll('input[type="checkbox"]:not([id*="all"])');
    checkboxes.forEach(cb => {
cb.checked = checkbox.checked;
if (checkbox.checked) {
    if (!headerFilterData[column].selected.includes(cb.value)) {
headerFilterData[column].selected.push(cb.value);
    }
} else {
    const index = headerFilterData[column].selected.indexOf(cb.value);
    if (index > -1) {
headerFilterData[column].selected.splice(index, 1);
    }
}
    });

    // データソース列の「すべて」は即時適用
    if (column === 'data_source') {
// 左側フィルターも同期
syncLeftDataSourceFilter();
// 「すべて」はOKボタン無しで即時反映
applyHeaderFilter('data_source');
    }
    
    // デリバリーサービス列の「すべて」は即時適用＆ラベル更新
    if (column === 'delivery') {
const label = document.getElementById('header-filter-delivery-selected-label');
if (label) {
    if (checkbox.checked) {
label.textContent = 'すべてのデリバリーサービスを表示中';
    } else {
label.textContent = 'デリバリーサービスでフィルタは適用されていません';
    }
}
// 「すべて」はOKボタン無しで即時反映
applyHeaderFilter('delivery');
    }
}

// ヘッダーフィルターを適用
function applyHeaderFilter(column) {
    const menu = document.getElementById(`header-filter-menu-${column}`);
    if (menu) {
menu.classList.remove('show');
    }
    
    // フィルターを適用
    if (column === 'name') {
currentFilters.headerName = headerFilterData[column].selected.length > 0 
    ? headerFilterData[column].selected.join('|') 
    : '';
    } else if (column === 'address') {
currentFilters.headerAddress = headerFilterData[column].selected.length > 0 
    ? headerFilterData[column].selected.join('|') 
    : '';
    } else if (column === 'contact') {
currentFilters.headerContact = headerFilterData[column].selected.length > 0 
    ? headerFilterData[column].selected.join('|') 
    : '';
    } else if (column === 'category') {
currentFilters.headerCategory = headerFilterData[column].selected.length > 0 
    ? headerFilterData[column].selected.join('|') 
    : '';
    } else if (column === 'closed_day') {
currentFilters.headerClosedDay = headerFilterData[column].selected.length > 0 
    ? headerFilterData[column].selected.join('|') 
    : '';
    } else if (column === 'opening_date') {
currentFilters.headerOpeningDate = headerFilterData[column].selected.length > 0 
    ? headerFilterData[column].selected.join('|') 
    : '';
    } else if (column === 'transport') {
currentFilters.headerTransport = headerFilterData[column].selected.length > 0 
    ? headerFilterData[column].selected.join('|') 
    : '';
    } else if (column === 'business_hours') {
currentFilters.headerBusinessHours = headerFilterData[column].selected.length > 0 
    ? headerFilterData[column].selected.join('|') 
    : '';
    } else if (column === 'official_account') {
currentFilters.headerOfficialAccount = headerFilterData[column].selected.length > 0 
    ? headerFilterData[column].selected.join('|') 
    : '';
    } else if (column === 'collected_at') {
currentFilters.headerCollectedAt = headerFilterData[column].selected.length > 0 
    ? headerFilterData[column].selected.join('|') 
    : '';
    } else if (column === 'delivery') {
const checkboxes = document.querySelectorAll(`#header-filter-values-delivery input[type="checkbox"]:not([id*="all"])`);
const selected = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);
// 3つすべて選択 or 0件の場合はフィルターなし扱い
if (selected.length === 0 || selected.length === 3) {
    currentFilters.headerDelivery = '';
} else {
    currentFilters.headerDelivery = selected.join(',');
}

// 選択中ラベルを更新
const label = document.getElementById('header-filter-delivery-selected-label');
if (label) {
    if (selected.length === 0 || selected.length === 3) {
label.textContent = 'すべてのデリバリーサービスを表示中';
    } else {
const serviceLabels = selected.map(s => {
    const norm = normalizeDeliveryServiceName(s);
    if (norm === 'ubereats') return 'Uber Eats';
    if (norm === 'wolt') return 'ウォルト';
    if (norm === 'demaecan') return '出前館';
    return s;
});
label.textContent = `選択中: ${serviceLabels.join(', ')}`;
    }
}
    } else if (column === 'status') {
const checkboxes = document.querySelectorAll(`#header-filter-values-status input[type="checkbox"]:not([id*="all"])`);
const selected = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);
currentFilters.headerStatus = selected.length > 0 ? selected.join(',') : '';
    }
    
    loadStores(1);
}

// ヘッダーフィルターをクリア
function clearHeaderFilter(column) {
    headerFilterData[column].selected = [];
    const container = document.getElementById(`header-filter-values-${column}`);
    if (container) {
const checkboxes = container.querySelectorAll('input[type="checkbox"]');
checkboxes.forEach(cb => cb.checked = true);
    }
    
    if (column === 'delivery' || column === 'status') {
const checkboxes = document.querySelectorAll(`#header-filter-values-${column} input[type="checkbox"]:not([id*="all"])`);
checkboxes.forEach(cb => cb.checked = true);
    }
    
    if (column === 'name') currentFilters.headerName = '';
    else if (column === 'address') currentFilters.headerAddress = '';
    else if (column === 'contact') currentFilters.headerContact = '';
    else if (column === 'category') currentFilters.headerCategory = '';
    else if (column === 'delivery') currentFilters.headerDelivery = '';
    else if (column === 'status') currentFilters.headerStatus = '';
    else if (column === 'closed_day') currentFilters.headerClosedDay = '';
    else if (column === 'opening_date') currentFilters.headerOpeningDate = '';
    else if (column === 'transport') currentFilters.headerTransport = '';
    else if (column === 'business_hours') currentFilters.headerBusinessHours = '';
    else if (column === 'official_account') currentFilters.headerOfficialAccount = '';
    else if (column === 'collected_at') currentFilters.headerCollectedAt = '';
    else if (column === 'data_source') {
// データソースフィルターをリセット
currentFilters.dataSources = DATA_SOURCES.map(s => s.value);
syncLeftDataSourceFilter();
    } else {
// 将来追加される列にも自動的に対応（汎用的な処理）
const filterKey = `header${column.charAt(0).toUpperCase() + column.slice(1).replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())}`;
if (currentFilters.hasOwnProperty(filterKey)) {
    currentFilters[filterKey] = '';
}
    }

    // デリバリーサービスの選択ラベルをリセット
    if (column === 'delivery') {
const label = document.getElementById('header-filter-delivery-selected-label');
if (label) {
    label.textContent = 'すべてのデリバリーサービスを表示中';
}
    }
    
    const menu = document.getElementById(`header-filter-menu-${column}`);
    if (menu) {
menu.classList.remove('show');
    }
    
    // フィルター適用後に確実にリストを再読み込み
    // 少し遅延を入れて、DOM更新とフィルター状態の更新を確実にする
    setTimeout(() => {
// 現在のページをリセットして最初のページから表示
loadStores(1);
    }, 150);
}

// ソート状態を保持
let currentSortColumn = null;
let currentSortDirection = null;

// 列をソート
function sortColumn(column, direction) {
    // ソート状態を更新
    currentSortColumn = column;
    currentSortDirection = direction;
    
    // メニューを閉じる
    const menu = document.getElementById(`header-filter-menu-${column}`);
    if (menu) {
menu.classList.remove('show');
    }
    
    // 現在表示されているデータを取得
    if (!window.currentStores || Object.keys(window.currentStores).length === 0) {
// データがまだ読み込まれていない場合は、先に読み込む
loadStores(currentPage || 1).then(() => {
    applySort();
});
return;
    }
    
    // ソートを適用
    applySort();
}

// ソートを適用してテーブルを再描画
function applySort() {
    if (!window.currentStores || !currentSortColumn) {
return;
    }
    
    const container = document.getElementById('stores-container');
    if (!container) return;
    
    // 現在のストアデータを配列に変換
    let stores = Object.values(window.currentStores);
    
    // ソートを実行
    stores.sort((a, b) => {
let aValue, bValue;

// 列に応じて値を取得
switch (currentSortColumn) {
    case 'name':
aValue = (a.name || '').toString().toLowerCase();
bValue = (b.name || '').toString().toLowerCase();
break;
    case 'address':
aValue = (a.address || '').toString().toLowerCase();
bValue = (b.address || '').toString().toLowerCase();
break;
    case 'contact':
// 電話番号またはウェブサイトで比較
aValue = ((a.phone || '') + (a.website || '')).toLowerCase();
bValue = ((b.phone || '') + (b.website || '')).toLowerCase();
break;
    case 'category':
aValue = (a.category || '').toString().toLowerCase();
bValue = (b.category || '').toString().toLowerCase();
break;
    case 'delivery':
// デリバリーサービスの数を比較
aValue = (a.delivery_services || []).length;
bValue = (b.delivery_services || []).length;
break;
    case 'status':
// ステータスは後で非同期で取得する必要があるため、一旦名前でソート
aValue = (a.status || 'none').toString().toLowerCase();
bValue = (b.status || 'none').toString().toLowerCase();
break;
    default:
return 0;
}

// 数値の場合は数値として比較
if (currentSortColumn === 'delivery') {
    if (currentSortDirection === 'asc') {
return aValue - bValue;
    } else {
return bValue - aValue;
    }
}

// 文字列の場合は文字列として比較
if (aValue < bValue) {
    return currentSortDirection === 'asc' ? -1 : 1;
} else if (aValue > bValue) {
    return currentSortDirection === 'asc' ? 1 : -1;
} else {
    return 0;
}
    });
    
    // テーブルをクリア
    container.innerHTML = '';
    
    // ソート済みデータを再表示
    (async () => {
for (const store of stores) {
    const row = await createStoreTableRow(store);
    container.appendChild(row);
}
    })();
}

// お気に入りリストを読み込む
async function loadFavoritesLists() {
    const container = document.getElementById('favorites-lists-container');
    if (!container) return;
    
    try {
const lists = await getSavedLists();
// お気に入りは、is_favoriteフラグがあるリスト、または特定の条件で判定
const favoriteLists = lists.filter(list => {
    // お気に入りフラグがある場合はそれを使用
    if (list.is_favorite !== undefined) {
return list.is_favorite === true;
    }
    // デフォルトでは、すべてのリストを表示（後でお気に入り機能を追加）
    return true;
});

if (favoriteLists.length === 0) {
    container.innerHTML = '<p class="text-center text-gray-500 py-8">お気に入りリストがありません</p>';
    return;
}

container.innerHTML = '';
favoriteLists.forEach(list => {
    const listCard = createListCard(list);
    container.appendChild(listCard);
});
    } catch (error) {
console.error('お気に入りリストの読み込みエラー:', error);
container.innerHTML = '<p class="text-center text-red-500 py-8">お気に入りリストの読み込みに失敗しました</p>';
    }
}

// ダウンロード済みリストを読み込む
async function loadDownloadedLists() {
    const container = document.getElementById('downloaded-lists-container');
    if (!container) return;
    
    try {
// ダウンロード履歴をlocalStorageから取得
const currentPartnerId = sessionStorage.getItem("currentPartnerId");
const downloadHistoryKey = `download_history_${currentPartnerId}`;
const downloadHistory = JSON.parse(localStorage.getItem(downloadHistoryKey) || '[]');

if (downloadHistory.length === 0) {
    container.innerHTML = '<p class="text-center text-gray-500 py-8">ダウンロード済みリストがありません</p>';
    return;
}

container.innerHTML = '';
downloadHistory.forEach(item => {
    const historyCard = document.createElement('div');
    historyCard.className = 'apclo-card p-4 border border-gray-200';
    historyCard.innerHTML = `
<div class="flex justify-between items-start">
    <div>
<h3 class="font-semibold text-gray-900">${escapeHtml(item.filename || '無題のリスト')}</h3>
<p class="text-sm text-gray-500 mt-1">ダウンロード日時: ${new Date(item.downloadedAt).toLocaleString('ja-JP')}</p>
<p class="text-sm text-gray-500">件数: ${item.count || 0}件</p>
    </div>
    <div class="flex gap-2">
<button
    onclick="reDownloadList('${escapeHtml(item.filename)}', ${item.count || 0})"
    class="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
>
    再ダウンロード
</button>
    </div>
</div>
    `;
    container.appendChild(historyCard);
});
    } catch (error) {
console.error('ダウンロード済みリストの読み込みエラー:', error);
container.innerHTML = '<p class="text-center text-red-500 py-8">ダウンロード済みリストの読み込みに失敗しました</p>';
    }
}

// リストカードを作成（お気に入り用）
function createListCard(list) {
    const card = document.createElement('div');
    card.className = 'apclo-card p-4 border border-gray-200';
    card.innerHTML = `
<div class="flex justify-between items-start">
    <div class="flex-1">
<h3 class="font-semibold text-gray-900">${escapeHtml(list.name)}</h3>
<p class="text-sm text-gray-500 mt-1">${list.stores ? list.stores.length : 0}件</p>
<p class="text-xs text-gray-400 mt-1">作成日: ${new Date(list.createdAt).toLocaleString('ja-JP')}</p>
    </div>
    <div class="flex gap-2">
<button
    onclick="viewSavedList('${list.id}')"
    class="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
>
    表示
</button>
<button
    onclick="toggleFavorite('${list.id}')"
    class="px-3 py-1 text-xs bg-yellow-500 text-white rounded hover:bg-yellow-600"
>
    ${list.is_favorite ? '★ お気に入り解除' : '☆ お気に入り'}
</button>
    </div>
</div>
    `;
    return card;
}

// お気に入りを切り替え
async function toggleFavorite(listId) {
    const lists = await getSavedLists();
    const list = lists.find(l => l.id === listId);
    if (list) {
list.is_favorite = !list.is_favorite;
const key = getPartnerStorageKey('savedLists');
localStorage.setItem(key, JSON.stringify(lists));
await loadFavoritesLists();
    }
}

// 再ダウンロード（ダウンロード履歴から）
window.reDownloadList = function(filename, count) {
    alert(`「${filename}」の再ダウンロード機能は準備中です。\n件数: ${count}件`);
}
