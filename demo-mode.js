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
        console.log('[DEMO] sessionStorageに保存:', key);
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
        console.log('[DEMO] sessionStorageから取得:', key);
        return sessionStorage.getItem(key);
    }
    
    // 通常モードならlocalStorageから取得
    return localStorage.getItem(key);
}

// デモモード用の削除処理（実際には削除しない）
function demoDeleteFromLocalStorage(key) {
    if (isDemoMode()) {
        console.log('[DEMO] 削除をスキップ:', key);
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
    badge.textContent = '🎭 DEMOモード';
    
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
