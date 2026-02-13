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
        return currentUser.companyCode === 'TAMJ';
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
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
    contractor: {
        companyCode: 'PN001', id: 'pn001-yamada', password: 'demo',
        name: '山田 太郎', role: 'contractor',
        companyName: '東京設備工業株式会社', partnerId: 'PN001',
        partnerCode: 'PN001', categories: ['空調', '給湯', '電気'],
        assignedCompanies: ['TAMJ'], status: 'active', isDemoMode: true
    }
};

window.DEMO_PARTNERS = [
    {
        id: 'PN001', name: '東京設備工業株式会社', partnerCode: 'PN001',
        categories: ['空調', '給湯', '電気'], assignedCompanies: ['TAMJ'],
        status: 'active', contactName: '山田 太郎',
        loginId: 'pn001-yamada', password: 'demo'
    },
    {
        id: 'PN002', name: '関東水道サービス', partnerCode: 'PN002',
        categories: ['水道', '給湯', '排水'], assignedCompanies: ['TAMJ'],
        status: 'active', contactName: '佐藤 花子',
        loginId: 'p002-sato', password: 'demo'
    },
    {
        id: 'PN003', name: '日本電気工事', partnerCode: 'PN003',
        categories: ['電気', '照明', '設備'], assignedCompanies: ['TAMJ'],
        status: 'active', contactName: '鈴木 一郎',
        loginId: 'p003-suzuki', password: 'demo'
    }
];
