/**
 * デモモード管理
 * 会社コード「TAMJ」でログインした場合、sessionStorageに保存（ブラウザを閉じるまで有効）
 */

// デモモード判定
function isDemoMode() {
    try {
        const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
        if (!currentUser) return false;
        
        // 会社コードが「TAMJ」の場合はデモモード
        if (currentUser.companyCode === 'TAMJ') return true;
        // 業者ログインでTAMJに紐づいている場合もデモモード
        if (currentUser.isDemoMode) return true;
        return false;
    } catch (e) {
        return false;
    }
}

// 会社ロゴ取得
function getCompanyLogo() {
    try {
        const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
        if (!currentUser) return null;
        
        // DEMOモードの場合
        if (currentUser.companyCode === 'TAMJ') {
            return sessionStorage.getItem('demo.companyLogo');
        }
        
        // 通常モード
        const companies = JSON.parse(localStorage.getItem('companies') || '[]');
        const company = companies.find(c => c.code === currentUser.companyCode);
        return company?.logoUrl || null;
    } catch (e) {
        console.error('ロゴ取得エラー:', e);
        return null;
    }
}

// アバター/ロゴHTMLを生成
function getAvatarHTML(userName) {
    const logoUrl = getCompanyLogo();
    
    if (logoUrl) {
        // ロゴがある場合
        return `<img src="${logoUrl}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;" alt="Company Logo">`;
    } else {
        // ロゴがない場合は頭文字（背景色: 白、文字色: #9B2335）
        const initial = userName ? userName.charAt(0) : '-';
        return `<span style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; background: white; color: #9B2335; font-weight: 700; border: 2px solid #9B2335;">${initial}</span>`;
    }
}

// デモモード警告メッセージ
function showDemoWarning(action) {
    const messages = {
        delete: 'デモモードでは、データの削除はできません。',
        export: 'デモモードでは、データのエクスポートはできません。',
        import: 'デモモードでは、データのインポートはできません。\nOCR/AI機能のコストがかかるため、制限しています。'
    };
    
    alert(messages[action] || 'デモモードでは、この操作は実行できません。');
}

// デモモード用のストレージ保存（sessionStorageに保存）
function demoSaveToLocalStorage(key, value) {
    if (isDemoMode()) {
        sessionStorage.setItem(key, value);
        return true;
    }
    
    // 通常モードならlocalStorageに保存
    localStorage.setItem(key, value);
    return true;
}

// デモモード用のストレージ読み込み
function demoGetFromLocalStorage(key) {
    if (isDemoMode()) {
        return sessionStorage.getItem(key);
    }
    
    // 通常モードならlocalStorageから取得
    return localStorage.getItem(key);
}

// デモモード用の削除処理（実際には削除しない）
function demoDeleteFromLocalStorage(key) {
    if (isDemoMode()) {
        showDemoWarning('delete');
        return false;
    }
    
    // 通常モードなら削除
    localStorage.removeItem(key);
    return true;
}

// デモモード用のエクスポート処理（実行しない）
function demoExportData() {
    if (isDemoMode()) {
        showDemoWarning('export');
        return false;
    }
    
    return true;
}

// デモモード用のインポート処理（実行しない）
function demoImportData() {
    if (isDemoMode()) {
        showDemoWarning('import');
        return false;
    }
    
    return true;
}

// デモモードバッジを表示
// ※ 統一ヘッダー（unified-header.js）がヘッダー中央にバッジを表示するため、
//    この関数は統一ヘッダー未適用の画面のみで使用。
//    統一ヘッダー適用画面では自動実行しない。
function showDemoModeBadge() {
    if (!isDemoMode()) return;
    
    // 統一ヘッダーが存在する場合はスキップ（二重表示防止）
    if (document.getElementById('unified-header-mount')) return;
    
    // 既に表示されている場合はスキップ
    if (document.getElementById('demoModeBadge')) return;
    
    const badge = document.createElement('div');
    badge.id = 'demoModeBadge';
    badge.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: #1e3a5f;
        color: white;
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 14px;
        font-weight: 600;
        z-index: 9999;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        pointer-events: none;
    `;
    badge.textContent = 'DEMOモード';
    
    document.body.appendChild(badge);
}

// ページ読み込み時にデモモードバッジを表示
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showDemoModeBadge);
} else {
    showDemoModeBadge();
}

// グローバルに公開
window.DEMO = {
    isDemo: isDemoMode,
    showWarning: showDemoWarning,
    save: demoSaveToLocalStorage,
    get: demoGetFromLocalStorage,
    delete: demoDeleteFromLocalStorage,
    exportData: demoExportData,
    importData: demoImportData
};

// ========== DEMOデータ集約 ==========
// 全画面で共通のDEMOデータをここに定義
window.DEMO_ACCOUNTS = {
    staff: {
        companyCode: 'TAMJ', id: 'demo-staff', password: 'demo',
        name: 'デモスタッフ', role: 'staff', scope: 'office',
        companyName: 'タムジ株式会社', officeCode: 'TAMJ-J0001', officeName: '東京事業所',
        status: 'active', isFirstLogin: false, isDemoMode: true
    },
    office_admin: {
        companyCode: 'TAMJ', id: 'demo-office', password: 'demo',
        name: 'デモ事業所管理者', role: 'office_admin', scope: 'office',
        companyName: 'タムジ株式会社', officeCode: 'TAMJ-J0001', officeName: '東京事業所',
        status: 'active', isFirstLogin: false, isDemoMode: true
    },
    company_admin: {
        companyCode: 'TAMJ', id: 'TAMJ-H001', password: 'demo',
        name: 'デモ本社管理者', role: 'company_admin', scope: 'company',
        companyName: 'タムジ株式会社', officeCode: 'TAMJ-H001', officeName: '本社',
        status: 'active', isFirstLogin: false, isDemoMode: true
    },
    system_admin: {
        companyCode: 'SYSTEM', id: 'admin', password: 'admin',
        name: 'システム管理者', role: 'system_admin', scope: 'system',
        companyName: 'ワンタッチ管理運営', officeCode: '', officeName: '',
        status: 'active', isFirstLogin: false, isDemoMode: true
    },
    contractor: {
        companyCode: 'PN001', id: 'pn001-yamada', password: 'demo',
        name: '山田 太郎', role: 'contractor',
        companyName: '東京設備工業株式会社', partnerId: 'PN001',
        partnerCode: 'PN001', categories: ['居室・生活', '厨房・食事', '介護・医療'],
        assignedCompanies: ['TAMJ'], status: 'active', isDemoMode: true
    }
};

window.DEMO_PARTNERS = [
    {
        id: 'PN001', name: '東京設備工業株式会社', partnerCode: 'PN001',
        categories: ['居室・生活', '厨房・食事', '介護・医療'],
        status: 'active',
        contactName: '山田 太郎', loginId: 'pn001-yamada', password: 'demo',
        contacts: [
            { name: '山田 太郎', loginId: 'pn001-yamada', password: 'demo', phone: '090-1234-5678', isMain: true },
            { name: '高橋 次郎', loginId: 'pn001-takahashi', password: 'demo', phone: '090-8765-4321', isMain: false }
        ]
    },
    {
        id: 'PN002', name: '関東水道サービス', partnerCode: 'PN002',
        categories: ['建物インフラ'],
        status: 'active',
        contactName: '佐藤 花子', loginId: 'p002-sato', password: 'demo',
        contacts: [
            { name: '佐藤 花子', loginId: 'p002-sato', password: 'demo', phone: '090-1111-2222', isMain: true }
        ]
    },
    {
        id: 'PN003', name: '日本電気工事', partnerCode: 'PN003',
        categories: ['IT・安全'],
        status: 'active',
        contactName: '鈴木 一郎', loginId: 'p003-suzuki', password: 'demo',
        contacts: [
            { name: '鈴木 一郎', loginId: 'p003-suzuki', password: 'demo', phone: '090-3333-4444', isMain: true }
        ]
    }
];

// DEMOモードのカテゴリ別担当業者設定
window.DEMO_CATEGORY_PARTNERS = {
    '建物インフラ': 'PN002',
    '居室・生活': 'PN001',
    '介護・医療': 'PN001',
    '厨房・食事': 'PN001',
    'IT・安全': 'PN003',
    'その他': null
};

// 契約テーブル（DEMOデータ）
window.DEMO_CONTRACTS = [
    { id: 'CNT-001', partnerId: 'PN001', companyCode: 'TAMJ', officeCode: '', categories: ['居室・生活','厨房・食事','介護・医療'], status: 'active', createdAt: new Date().toISOString() },
    { id: 'CNT-002', partnerId: 'PN002', companyCode: 'TAMJ', officeCode: '', categories: ['建物インフラ'], status: 'active', createdAt: new Date().toISOString() },
    { id: 'CNT-003', partnerId: 'PN003', companyCode: 'TAMJ', officeCode: '', categories: ['IT・安全'], status: 'active', createdAt: new Date().toISOString() }
];

// カテゴリ一覧（全画面共通）
window.SYSTEM_CATEGORIES = [
    '建物インフラ', '居室・生活', '介護・医療', '厨房・食事', 'IT・安全', 'その他'
];

/**
 * 業者振り分けロジック（提案書3.3準拠）
 * 優先1: 商品のassignedPartnerId
 * 優先2: 事業所のcategoryPartners
 * 優先3: null（未割当）
 */
function resolvePartner(item, officeCode) {
    // 優先1: 商品に直接設定された業者
    if (item.assignedPartnerId) {
        return { partnerId: item.assignedPartnerId, partnerName: item.assignedPartnerName || '' };
    }
    
    // 優先2: 契約テーブルから解決（会社+事業所+カテゴリ）
    if (item.category && item.companyCode) {
        var contracts = [];
        try { contracts = JSON.parse(sessionStorage.getItem('onetouch.contracts') || '[]'); } catch(e) {}
        try {
            var contractsL = JSON.parse(localStorage.getItem('onetouch.contracts') || '[]');
            contractsL.forEach(function(c) { if (!contracts.find(function(x) { return x.id === c.id; })) contracts.push(c); });
        } catch(e) {}
        
        var matched = contracts.filter(function(c) {
            if (c.status !== 'active') return false;
            if (c.companyCode !== item.companyCode) return false;
            if (c.categories && c.categories.indexOf(item.category) === -1) return false;
            if (c.officeCode && c.officeCode !== officeCode) return false;
            return true;
        });
        
        if (matched.length > 0) {
            var contract = matched[0];
            var partners = getPartnersData();
            var partner = partners.find(function(p) { return p.id === contract.partnerId || p.partnerCode === contract.partnerId; });
            return { partnerId: contract.partnerId, partnerName: partner ? partner.name : '' };
        }
    }
    
    // 優先3: 事業所のcategoryPartners（後方互換）
    if (item.category && officeCode) {
        var offices = [];
        try { offices = JSON.parse(sessionStorage.getItem('offices') || '[]'); } catch(e) {}
        try {
            var officesL = JSON.parse(localStorage.getItem('offices') || '[]');
            officesL.forEach(function(o) { if (!offices.find(function(x) { return x.code === o.code; })) offices.push(o); });
        } catch(e) {}
        var office = offices.find(function(o) { return o.code === officeCode; });
        if (office && office.categoryPartners) {
            var partnerId = office.categoryPartners[item.category];
            if (partnerId) {
                var partners2 = getPartnersData();
                var partner2 = partners2.find(function(p) { return p.id === partnerId || p.partnerCode === partnerId; });
                return { partnerId: partnerId, partnerName: partner2 ? partner2.name : '' };
            }
        }
    }
    // 優先4: 未割当
    return { partnerId: null, partnerName: '' };
}

// 業者データ取得ヘルパー
function getPartnersData() {
    var partners = [];
    try { partners = JSON.parse(sessionStorage.getItem('partners') || '[]'); } catch(e) {}
    try {
        var partnersL = JSON.parse(localStorage.getItem('partners') || '[]');
        partnersL.forEach(function(p) { if (!partners.find(function(x) { return x.id === p.id; })) partners.push(p); });
    } catch(e) {}
    return partners;
}

// 契約テーブルから業者の担当会社を取得（assignedCompanies代替）
function getPartnerCompanies(partnerId) {
    var contracts = [];
    try { contracts = JSON.parse(sessionStorage.getItem('onetouch.contracts') || '[]'); } catch(e) {}
    try {
        var contractsL = JSON.parse(localStorage.getItem('onetouch.contracts') || '[]');
        contractsL.forEach(function(c) { if (!contracts.find(function(x) { return x.id === c.id; })) contracts.push(c); });
    } catch(e) {}
    var companies = [];
    contracts.forEach(function(c) {
        if (c.partnerId === partnerId && c.status === 'active' && companies.indexOf(c.companyCode) === -1) {
            companies.push(c.companyCode);
        }
    });
    return companies;
}
