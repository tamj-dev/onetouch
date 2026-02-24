/**
 * デモモード管理 v3
 * 
 * ■ ストレージ戦略:
 *   - マスタデータ（初期値）: localStorage 'demo_snapshot_*' キーに保存
 *   - システム管理者: localStorage直接操作 → 変更はマスタに反映（永続）
 *   - DEMOユーザー: localStorage直接操作 → ログイン時にスナップショット保存、
 *     ログアウト時にスナップショットから復元（リセット）
 * 
 * ■ 各画面のlocalStorage/sessionStorageの読み書きは一切変更不要
 */

// ========== デモモード判定 ==========
function isDemoMode() {
    try {
        var cu = JSON.parse(sessionStorage.getItem('currentUser'));
        if (!cu) return false;
        if (cu.companyCode === 'TAMJ' || cu.companyCode === 'JMAT' || cu.companyCode === 'SYSTEM') return true;
        if (cu.isDemoMode) return true;
        return false;
    } catch (e) { return false; }
}

function isSystemAdmin() {
    try {
        var cu = JSON.parse(sessionStorage.getItem('currentUser'));
        return cu && cu.role === 'system_admin';
    } catch (e) { return false; }
}

// ========== スナップショット管理 ==========
// DEMOユーザーログイン時: localStorageの現状を退避
// DEMOユーザーログアウト/ブラウザ閉じ: 退避から復元
var SNAPSHOT_KEYS = ['companies','offices','accounts','partners','onetouch.contracts','onetouch.items','onetouch.reports','officeCounter'];

function saveDemoSnapshot() {
    SNAPSHOT_KEYS.forEach(function(key) {
        var data = localStorage.getItem(key);
        if (data !== null) {
            sessionStorage.setItem('demo_snapshot_' + key, data);
        }
    });
}

function restoreDemoSnapshot() {
    SNAPSHOT_KEYS.forEach(function(key) {
        var snap = sessionStorage.getItem('demo_snapshot_' + key);
        if (snap !== null) {
            localStorage.setItem(key, snap);
        }
    });
    // スナップショットをクリア
    SNAPSHOT_KEYS.forEach(function(key) {
        sessionStorage.removeItem('demo_snapshot_' + key);
    });
}

// ブラウザを閉じた時/タブを閉じた時にスナップショットから復元
// beforeunload時にsessionStorageから読み出して復元
window.addEventListener('beforeunload', function() {
    // DEMOユーザー（非システム管理者）の場合のみ復元
    try {
        var cu = JSON.parse(sessionStorage.getItem('currentUser'));
        if (cu && cu.isDemoMode && cu.role !== 'system_admin') {
            restoreDemoSnapshot();
        }
    } catch(e) {}
});

// ========== ストレージ操作（各画面との互換性維持） ==========
// 既存の各画面はlocalStorage/sessionStorageを直接使っている
// この関数はdemo-mode.js内のヘルパーとして使用
function demoSaveToLocalStorage(key, value) {
    localStorage.setItem(key, value);
    return true;
}

function demoGetFromLocalStorage(key) {
    return localStorage.getItem(key);
}

function demoDeleteFromLocalStorage(key) {
    if (isDemoMode() && !isSystemAdmin()) { showDemoWarning('delete'); return false; }
    localStorage.removeItem(key);
    return true;
}

// ========== ロゴ関連 ==========
function getCompanyLogo() {
    try {
        var cu = JSON.parse(sessionStorage.getItem('currentUser'));
        if (!cu) return null;
        if (cu.companyCode === 'TAMJ' || cu.companyCode === 'JMAT') {
            return sessionStorage.getItem('demo.companyLogo');
        }
        var companies = JSON.parse(localStorage.getItem('companies') || '[]');
        var company = companies.find(function(c) { return c.code === cu.companyCode; });
        return company ? (company.logoUrl || null) : null;
    } catch (e) { return null; }
}

function getAvatarHTML(userName) {
    var logoUrl = getCompanyLogo();
    if (logoUrl) {
        return '<img src="' + logoUrl + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" alt="Logo">';
    }
    var initial = userName ? userName.charAt(0) : '-';
    return '<span style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;background:white;color:#9B2335;font-weight:700;border:2px solid #9B2335;">' + initial + '</span>';
}

// ========== 警告 ==========
function showDemoWarning(action) {
    var messages = { delete:'デモモードでは、データの削除はできません。', export:'デモモードでは、データのエクスポートはできません。', import:'デモモードでは、データのインポートはできません。\nOCR/AI機能のコストがかかるため、制限しています。' };
    alert(messages[action] || 'デモモードでは、この操作は実行できません。');
}
function demoExportData() { if (isDemoMode() && !isSystemAdmin()) { showDemoWarning('export'); return false; } return true; }
function demoImportData() { if (isDemoMode() && !isSystemAdmin()) { showDemoWarning('import'); return false; } return true; }

// ========== バッジ表示 ==========
function showDemoModeBadge() {
    if (!isDemoMode()) return;
    if (document.getElementById('unified-header-mount')) return;
    if (document.getElementById('demoModeBadge')) return;
    var badge = document.createElement('div');
    badge.id = 'demoModeBadge';
    badge.style.cssText = 'position:fixed;top:10px;right:10px;background:#1e3a5f;color:white;padding:8px 16px;border-radius:20px;font-size:14px;font-weight:600;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,0.2);pointer-events:none;';
    badge.textContent = 'DEMOモード';
    document.body.appendChild(badge);
}
if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', showDemoModeBadge); }
else { showDemoModeBadge(); }

// ========== グローバル公開 ==========
window.DEMO = { isDemo:isDemoMode, showWarning:showDemoWarning, save:demoSaveToLocalStorage, get:demoGetFromLocalStorage, delete:demoDeleteFromLocalStorage, exportData:demoExportData, importData:demoImportData };

// ========== カテゴリ ==========
window.SYSTEM_CATEGORIES = ['建物・外', '部屋・共用部', '介護医療備品', '厨房', 'ネットワーク', '浴室', '福祉用具', 'その他'];

// カテゴリ別業者は契約テーブル（DEMO_CONTRACTS）で管理

// ========== アカウント ==========
window.DEMO_ACCOUNTS = {
    // TAMJ さくら苑
    'tamj-j1-admin':  {companyCode:'TAMJ',id:'tamj-j1-admin',password:'demo',name:'さくら苑 管理者',role:'office_admin',companyName:'タムジ株式会社',officeCode:'TAMJ-J0001',officeName:'さくら苑',status:'active',isFirstLogin:false,isDemoMode:true},
    'tamj-j1-staff1': {companyCode:'TAMJ',id:'tamj-j1-staff1',password:'demo',name:'さくら苑スタッフ1',role:'staff',companyName:'タムジ株式会社',officeCode:'TAMJ-J0001',officeName:'さくら苑',status:'active',isFirstLogin:false,isDemoMode:true},
    'tamj-j1-staff2': {companyCode:'TAMJ',id:'tamj-j1-staff2',password:'demo',name:'さくら苑スタッフ2',role:'staff',companyName:'タムジ株式会社',officeCode:'TAMJ-J0001',officeName:'さくら苑',status:'active',isFirstLogin:false,isDemoMode:true},
    'tamj-j1-staff3': {companyCode:'TAMJ',id:'tamj-j1-staff3',password:'demo',name:'さくら苑スタッフ3',role:'staff',companyName:'タムジ株式会社',officeCode:'TAMJ-J0001',officeName:'さくら苑',status:'active',isFirstLogin:false,isDemoMode:true},
    'tamj-j1-staff4': {companyCode:'TAMJ',id:'tamj-j1-staff4',password:'demo',name:'さくら苑スタッフ4',role:'staff',companyName:'タムジ株式会社',officeCode:'TAMJ-J0001',officeName:'さくら苑',status:'active',isFirstLogin:false,isDemoMode:true},
    'tamj-j1-staff5': {companyCode:'TAMJ',id:'tamj-j1-staff5',password:'demo',name:'さくら苑スタッフ5',role:'staff',companyName:'タムジ株式会社',officeCode:'TAMJ-J0001',officeName:'さくら苑',status:'active',isFirstLogin:false,isDemoMode:true},
    // TAMJ ひまわり荘
    'tamj-j2-admin':  {companyCode:'TAMJ',id:'tamj-j2-admin',password:'demo',name:'ひまわり荘 管理者',role:'office_admin',companyName:'タムジ株式会社',officeCode:'TAMJ-J0002',officeName:'ひまわり荘',status:'active',isFirstLogin:false,isDemoMode:true},
    'tamj-j2-staff1': {companyCode:'TAMJ',id:'tamj-j2-staff1',password:'demo',name:'ひまわり荘スタッフ1',role:'staff',companyName:'タムジ株式会社',officeCode:'TAMJ-J0002',officeName:'ひまわり荘',status:'active',isFirstLogin:false,isDemoMode:true},
    'tamj-j2-staff2': {companyCode:'TAMJ',id:'tamj-j2-staff2',password:'demo',name:'ひまわり荘スタッフ2',role:'staff',companyName:'タムジ株式会社',officeCode:'TAMJ-J0002',officeName:'ひまわり荘',status:'active',isFirstLogin:false,isDemoMode:true},
    'tamj-j2-staff3': {companyCode:'TAMJ',id:'tamj-j2-staff3',password:'demo',name:'ひまわり荘スタッフ3',role:'staff',companyName:'タムジ株式会社',officeCode:'TAMJ-J0002',officeName:'ひまわり荘',status:'active',isFirstLogin:false,isDemoMode:true},
    'tamj-j2-staff4': {companyCode:'TAMJ',id:'tamj-j2-staff4',password:'demo',name:'ひまわり荘スタッフ4',role:'staff',companyName:'タムジ株式会社',officeCode:'TAMJ-J0002',officeName:'ひまわり荘',status:'active',isFirstLogin:false,isDemoMode:true},
    'tamj-j2-staff5': {companyCode:'TAMJ',id:'tamj-j2-staff5',password:'demo',name:'ひまわり荘スタッフ5',role:'staff',companyName:'タムジ株式会社',officeCode:'TAMJ-J0002',officeName:'ひまわり荘',status:'active',isFirstLogin:false,isDemoMode:true},
    // TAMJ あおぞらの家
    'tamj-j3-admin':  {companyCode:'TAMJ',id:'tamj-j3-admin',password:'demo',name:'あおぞらの家 管理者',role:'office_admin',companyName:'タムジ株式会社',officeCode:'TAMJ-J0003',officeName:'あおぞらの家',status:'active',isFirstLogin:false,isDemoMode:true},
    'tamj-j3-staff1': {companyCode:'TAMJ',id:'tamj-j3-staff1',password:'demo',name:'あおぞらの家スタッフ1',role:'staff',companyName:'タムジ株式会社',officeCode:'TAMJ-J0003',officeName:'あおぞらの家',status:'active',isFirstLogin:false,isDemoMode:true},
    'tamj-j3-staff2': {companyCode:'TAMJ',id:'tamj-j3-staff2',password:'demo',name:'あおぞらの家スタッフ2',role:'staff',companyName:'タムジ株式会社',officeCode:'TAMJ-J0003',officeName:'あおぞらの家',status:'active',isFirstLogin:false,isDemoMode:true},
    'tamj-j3-staff3': {companyCode:'TAMJ',id:'tamj-j3-staff3',password:'demo',name:'あおぞらの家スタッフ3',role:'staff',companyName:'タムジ株式会社',officeCode:'TAMJ-J0003',officeName:'あおぞらの家',status:'active',isFirstLogin:false,isDemoMode:true},
    'tamj-j3-staff4': {companyCode:'TAMJ',id:'tamj-j3-staff4',password:'demo',name:'あおぞらの家スタッフ4',role:'staff',companyName:'タムジ株式会社',officeCode:'TAMJ-J0003',officeName:'あおぞらの家',status:'active',isFirstLogin:false,isDemoMode:true},
    'tamj-j3-staff5': {companyCode:'TAMJ',id:'tamj-j3-staff5',password:'demo',name:'あおぞらの家スタッフ5',role:'staff',companyName:'タムジ株式会社',officeCode:'TAMJ-J0003',officeName:'あおぞらの家',status:'active',isFirstLogin:false,isDemoMode:true},
    'TAMJ-H001': {companyCode:'TAMJ',id:'TAMJ-H001',password:'demo',name:'タムジ 本社管理者',role:'company_admin',companyName:'タムジ株式会社',officeCode:'TAMJ-H001',officeName:'本社',status:'active',isFirstLogin:false,isDemoMode:true},

    // JMAT グリーンヒル
    'jmat-j1-admin':  {companyCode:'JMAT',id:'jmat-j1-admin',password:'demo',name:'グリーンヒル 管理者',role:'office_admin',companyName:'ジェイマットジャパン合同会社',officeCode:'JMAT-J0001',officeName:'グリーンヒル',status:'active',isFirstLogin:false,isDemoMode:true},
    'jmat-j1-staff1': {companyCode:'JMAT',id:'jmat-j1-staff1',password:'demo',name:'グリーンヒルスタッフ1',role:'staff',companyName:'ジェイマットジャパン合同会社',officeCode:'JMAT-J0001',officeName:'グリーンヒル',status:'active',isFirstLogin:false,isDemoMode:true},
    'jmat-j1-staff2': {companyCode:'JMAT',id:'jmat-j1-staff2',password:'demo',name:'グリーンヒルスタッフ2',role:'staff',companyName:'ジェイマットジャパン合同会社',officeCode:'JMAT-J0001',officeName:'グリーンヒル',status:'active',isFirstLogin:false,isDemoMode:true},
    'jmat-j1-staff3': {companyCode:'JMAT',id:'jmat-j1-staff3',password:'demo',name:'グリーンヒルスタッフ3',role:'staff',companyName:'ジェイマットジャパン合同会社',officeCode:'JMAT-J0001',officeName:'グリーンヒル',status:'active',isFirstLogin:false,isDemoMode:true},
    'jmat-j1-staff4': {companyCode:'JMAT',id:'jmat-j1-staff4',password:'demo',name:'グリーンヒルスタッフ4',role:'staff',companyName:'ジェイマットジャパン合同会社',officeCode:'JMAT-J0001',officeName:'グリーンヒル',status:'active',isFirstLogin:false,isDemoMode:true},
    'jmat-j1-staff5': {companyCode:'JMAT',id:'jmat-j1-staff5',password:'demo',name:'グリーンヒルスタッフ5',role:'staff',companyName:'ジェイマットジャパン合同会社',officeCode:'JMAT-J0001',officeName:'グリーンヒル',status:'active',isFirstLogin:false,isDemoMode:true},
    // JMAT コスモス園
    'jmat-j2-admin':  {companyCode:'JMAT',id:'jmat-j2-admin',password:'demo',name:'コスモス園 管理者',role:'office_admin',companyName:'ジェイマットジャパン合同会社',officeCode:'JMAT-J0002',officeName:'コスモス園',status:'active',isFirstLogin:false,isDemoMode:true},
    'jmat-j2-staff1': {companyCode:'JMAT',id:'jmat-j2-staff1',password:'demo',name:'コスモス園スタッフ1',role:'staff',companyName:'ジェイマットジャパン合同会社',officeCode:'JMAT-J0002',officeName:'コスモス園',status:'active',isFirstLogin:false,isDemoMode:true},
    'jmat-j2-staff2': {companyCode:'JMAT',id:'jmat-j2-staff2',password:'demo',name:'コスモス園スタッフ2',role:'staff',companyName:'ジェイマットジャパン合同会社',officeCode:'JMAT-J0002',officeName:'コスモス園',status:'active',isFirstLogin:false,isDemoMode:true},
    'jmat-j2-staff3': {companyCode:'JMAT',id:'jmat-j2-staff3',password:'demo',name:'コスモス園スタッフ3',role:'staff',companyName:'ジェイマットジャパン合同会社',officeCode:'JMAT-J0002',officeName:'コスモス園',status:'active',isFirstLogin:false,isDemoMode:true},
    'jmat-j2-staff4': {companyCode:'JMAT',id:'jmat-j2-staff4',password:'demo',name:'コスモス園スタッフ4',role:'staff',companyName:'ジェイマットジャパン合同会社',officeCode:'JMAT-J0002',officeName:'コスモス園',status:'active',isFirstLogin:false,isDemoMode:true},
    'jmat-j2-staff5': {companyCode:'JMAT',id:'jmat-j2-staff5',password:'demo',name:'コスモス園スタッフ5',role:'staff',companyName:'ジェイマットジャパン合同会社',officeCode:'JMAT-J0002',officeName:'コスモス園',status:'active',isFirstLogin:false,isDemoMode:true},
    // JMAT やすらぎの丘
    'jmat-j3-admin':  {companyCode:'JMAT',id:'jmat-j3-admin',password:'demo',name:'やすらぎの丘 管理者',role:'office_admin',companyName:'ジェイマットジャパン合同会社',officeCode:'JMAT-J0003',officeName:'やすらぎの丘',status:'active',isFirstLogin:false,isDemoMode:true},
    'jmat-j3-staff1': {companyCode:'JMAT',id:'jmat-j3-staff1',password:'demo',name:'やすらぎの丘スタッフ1',role:'staff',companyName:'ジェイマットジャパン合同会社',officeCode:'JMAT-J0003',officeName:'やすらぎの丘',status:'active',isFirstLogin:false,isDemoMode:true},
    'jmat-j3-staff2': {companyCode:'JMAT',id:'jmat-j3-staff2',password:'demo',name:'やすらぎの丘スタッフ2',role:'staff',companyName:'ジェイマットジャパン合同会社',officeCode:'JMAT-J0003',officeName:'やすらぎの丘',status:'active',isFirstLogin:false,isDemoMode:true},
    'jmat-j3-staff3': {companyCode:'JMAT',id:'jmat-j3-staff3',password:'demo',name:'やすらぎの丘スタッフ3',role:'staff',companyName:'ジェイマットジャパン合同会社',officeCode:'JMAT-J0003',officeName:'やすらぎの丘',status:'active',isFirstLogin:false,isDemoMode:true},
    'jmat-j3-staff4': {companyCode:'JMAT',id:'jmat-j3-staff4',password:'demo',name:'やすらぎの丘スタッフ4',role:'staff',companyName:'ジェイマットジャパン合同会社',officeCode:'JMAT-J0003',officeName:'やすらぎの丘',status:'active',isFirstLogin:false,isDemoMode:true},
    'jmat-j3-staff5': {companyCode:'JMAT',id:'jmat-j3-staff5',password:'demo',name:'やすらぎの丘スタッフ5',role:'staff',companyName:'ジェイマットジャパン合同会社',officeCode:'JMAT-J0003',officeName:'やすらぎの丘',status:'active',isFirstLogin:false,isDemoMode:true},
    'JMAT-H001': {companyCode:'JMAT',id:'JMAT-H001',password:'demo',name:'JMAT 本社管理者',role:'company_admin',companyName:'ジェイマットジャパン合同会社',officeCode:'JMAT-H001',officeName:'本社',status:'active',isFirstLogin:false,isDemoMode:true},

    // システム管理者
    'admin': {companyCode:'SYSTEM',id:'admin',password:'admin',name:'システム管理者',role:'system_admin',scope:'system',companyName:'ワンタッチ管理運営',officeCode:'',officeName:'',status:'active',isFirstLogin:false,isDemoMode:true},

    // 管理会社ログイン用（15社）
    'pn001-yamada':     {companyCode:'PN001',id:'pn001-yamada',password:'demo',name:'山田 太郎',role:'contractor',companyName:'TAMJ建設',partnerId:'PN001',partnerCode:'PN001',categories:['建物・外','部屋・共用部','介護医療備品','厨房','ネットワーク'],assignedCompanies:['TAMJ','JMAT'],status:'active',isDemoMode:true},
    'pn002-aoki':       {companyCode:'PN002',id:'pn002-aoki',password:'demo',name:'青木 一郎',role:'contractor',companyName:'ACタムジ',partnerId:'PN002',partnerCode:'PN002',categories:['建物・外'],assignedCompanies:['TAMJ','JMAT'],status:'active',isDemoMode:true},
    'pn003-eto':        {companyCode:'PN003',id:'pn003-eto',password:'demo',name:'江藤 健太',role:'contractor',companyName:'EVタムジ',partnerId:'PN003',partnerCode:'PN003',categories:['建物・外'],assignedCompanies:['TAMJ','JMAT'],status:'active',isDemoMode:true},
    'pn004-tamura':     {companyCode:'PN004',id:'pn004-tamura',password:'demo',name:'田村 美咲',role:'contractor',companyName:'タムタム家具',partnerId:'PN004',partnerCode:'PN004',categories:['部屋・共用部','介護医療備品','厨房','ネットワーク'],assignedCompanies:['TAMJ','JMAT'],status:'active',isDemoMode:true},
    'pn005-hayashi':    {companyCode:'PN005',id:'pn005-hayashi',password:'demo',name:'林 誠',role:'contractor',companyName:'リネンTAMJ',partnerId:'PN005',partnerCode:'PN005',categories:['部屋・共用部'],assignedCompanies:['TAMJ','JMAT'],status:'active',isDemoMode:true},
    'pn006-fukuda':     {companyCode:'PN006',id:'pn006-fukuda',password:'demo',name:'福田 裕子',role:'contractor',companyName:'福たむ',partnerId:'PN006',partnerCode:'PN006',categories:['部屋・共用部','介護医療備品','厨房'],assignedCompanies:['TAMJ','JMAT'],status:'active',isDemoMode:true},
    'pn007-ando':       {companyCode:'PN007',id:'pn007-ando',password:'demo',name:'安藤 大輔',role:'contractor',companyName:'AEDタム',partnerId:'PN007',partnerCode:'PN007',categories:['介護医療備品'],assignedCompanies:['TAMJ','JMAT'],status:'active',isDemoMode:true},
    'pn008-oshima':     {companyCode:'PN008',id:'pn008-oshima',password:'demo',name:'大島 春菜',role:'contractor',companyName:'お掃除タムタム',partnerId:'PN008',partnerCode:'PN008',categories:['厨房'],assignedCompanies:['TAMJ','JMAT'],status:'active',isDemoMode:true},
    'pn009-kitamura':   {companyCode:'PN009',id:'pn009-kitamura',password:'demo',name:'北村 和也',role:'contractor',companyName:'キッチンタムジ',partnerId:'PN009',partnerCode:'PN009',categories:['厨房'],assignedCompanies:['TAMJ','JMAT'],status:'active',isDemoMode:true},
    'pn010-nakata':     {companyCode:'PN010',id:'pn010-nakata',password:'demo',name:'中田 翔',role:'contractor',companyName:'タムネット',partnerId:'PN010',partnerCode:'PN010',categories:['ネットワーク'],assignedCompanies:['TAMJ','JMAT'],status:'active',isDemoMode:true},
    'pn011-domoto':     {companyCode:'PN011',id:'pn011-domoto',password:'demo',name:'堂本 光',role:'contractor',companyName:'タム電気',partnerId:'PN011',partnerCode:'PN011',categories:['ネットワーク'],assignedCompanies:['TAMJ','JMAT'],status:'active',isDemoMode:true},
    'pn012-sekiguchi':  {companyCode:'PN012',id:'pn012-sekiguchi',password:'demo',name:'関口 武',role:'contractor',companyName:'タムセキュリティ',partnerId:'PN012',partnerCode:'PN012',categories:['ネットワーク'],assignedCompanies:['TAMJ','JMAT'],status:'active',isDemoMode:true},
    'pn013-kato':       {companyCode:'PN013',id:'pn013-kato',password:'demo',name:'加藤 優',role:'contractor',companyName:'介護タム',partnerId:'PN013',partnerCode:'PN013',categories:['介護医療備品'],assignedCompanies:['TAMJ','JMAT'],status:'active',isDemoMode:true},
    'pn014-nishimura':  {companyCode:'PN014',id:'pn014-nishimura',password:'demo',name:'西村 拓',role:'contractor',companyName:'Nタムタム',partnerId:'PN014',partnerCode:'PN014',categories:['ネットワーク'],assignedCompanies:['TAMJ','JMAT'],status:'active',isDemoMode:true},
    'pn015-kobayashi':  {companyCode:'PN015',id:'pn015-kobayashi',password:'demo',name:'小林 恵',role:'contractor',companyName:'タムコール',partnerId:'PN015',partnerCode:'PN015',categories:['ネットワーク'],assignedCompanies:['TAMJ','JMAT'],status:'active',isDemoMode:true}
};

// ========== 管理会社マスタ（15社） ==========
window.DEMO_PARTNERS = [
    {id:'PN001',name:'TAMJ建設',partnerCode:'PN001',categories:['建物・外','部屋・共用部','介護医療備品','厨房','ネットワーク'],status:'active',contactName:'山田 太郎',contacts:[{name:'山田 太郎',loginId:'pn001-yamada',password:'demo',phone:'090-1234-5678',isMain:true}]},
    {id:'PN002',name:'ACタムジ',partnerCode:'PN002',categories:['建物・外'],status:'active',contactName:'青木 一郎',contacts:[{name:'青木 一郎',loginId:'pn002-aoki',password:'demo',phone:'090-2222-0001',isMain:true}]},
    {id:'PN003',name:'EVタムジ',partnerCode:'PN003',categories:['建物・外'],status:'active',contactName:'江藤 健太',contacts:[{name:'江藤 健太',loginId:'pn003-eto',password:'demo',phone:'090-2222-0002',isMain:true}]},
    {id:'PN004',name:'タムタム家具',partnerCode:'PN004',categories:['部屋・共用部','介護医療備品','厨房','ネットワーク'],status:'active',contactName:'田村 美咲',contacts:[{name:'田村 美咲',loginId:'pn004-tamura',password:'demo',phone:'090-2222-0003',isMain:true}]},
    {id:'PN005',name:'リネンTAMJ',partnerCode:'PN005',categories:['部屋・共用部'],status:'active',contactName:'林 誠',contacts:[{name:'林 誠',loginId:'pn005-hayashi',password:'demo',phone:'090-2222-0004',isMain:true}]},
    {id:'PN006',name:'福たむ',partnerCode:'PN006',categories:['部屋・共用部','介護医療備品','厨房'],status:'active',contactName:'福田 裕子',contacts:[{name:'福田 裕子',loginId:'pn006-fukuda',password:'demo',phone:'090-2222-0005',isMain:true}]},
    {id:'PN007',name:'AEDタム',partnerCode:'PN007',categories:['介護医療備品'],status:'active',contactName:'安藤 大輔',contacts:[{name:'安藤 大輔',loginId:'pn007-ando',password:'demo',phone:'090-2222-0006',isMain:true}]},
    {id:'PN008',name:'お掃除タムタム',partnerCode:'PN008',categories:['厨房'],status:'active',contactName:'大島 春菜',contacts:[{name:'大島 春菜',loginId:'pn008-oshima',password:'demo',phone:'090-2222-0007',isMain:true}]},
    {id:'PN009',name:'キッチンタムジ',partnerCode:'PN009',categories:['厨房'],status:'active',contactName:'北村 和也',contacts:[{name:'北村 和也',loginId:'pn009-kitamura',password:'demo',phone:'090-2222-0008',isMain:true}]},
    {id:'PN010',name:'タムネット',partnerCode:'PN010',categories:['ネットワーク'],status:'active',contactName:'中田 翔',contacts:[{name:'中田 翔',loginId:'pn010-nakata',password:'demo',phone:'090-2222-0009',isMain:true}]},
    {id:'PN011',name:'タム電気',partnerCode:'PN011',categories:['ネットワーク'],status:'active',contactName:'堂本 光',contacts:[{name:'堂本 光',loginId:'pn011-domoto',password:'demo',phone:'090-2222-0010',isMain:true}]},
    {id:'PN012',name:'タムセキュリティ',partnerCode:'PN012',categories:['ネットワーク'],status:'active',contactName:'関口 武',contacts:[{name:'関口 武',loginId:'pn012-sekiguchi',password:'demo',phone:'090-2222-0011',isMain:true}]},
    {id:'PN013',name:'介護タム',partnerCode:'PN013',categories:['介護医療備品'],status:'active',contactName:'加藤 優',contacts:[{name:'加藤 優',loginId:'pn013-kato',password:'demo',phone:'090-2222-0012',isMain:true}]},
    {id:'PN014',name:'Nタムタム',partnerCode:'PN014',categories:['ネットワーク'],status:'active',contactName:'西村 拓',contacts:[{name:'西村 拓',loginId:'pn014-nishimura',password:'demo',phone:'090-2222-0013',isMain:true}]},
    {id:'PN015',name:'タムコール',partnerCode:'PN015',categories:['ネットワーク'],status:'active',contactName:'小林 恵',contacts:[{name:'小林 恵',loginId:'pn015-kobayashi',password:'demo',phone:'090-2222-0014',isMain:true}]}
];

// ========== 契約テーブル（TAMJ・JMAT共通で15社） ==========
window.DEMO_CONTRACTS = [
    {id:'CNT-T01',partnerId:'PN001',companyCode:'TAMJ',officeCode:'',categories:['建物・外','部屋・共用部','介護医療備品','厨房','ネットワーク','浴室','福祉用具'],status:'active',createdAt:'2025-01-15T00:00:00Z'},
    {id:'CNT-T02',partnerId:'PN002',companyCode:'TAMJ',officeCode:'',categories:['建物・外'],status:'active',createdAt:'2025-01-15T00:00:00Z'},
    {id:'CNT-T03',partnerId:'PN003',companyCode:'TAMJ',officeCode:'',categories:['建物・外'],status:'active',createdAt:'2025-01-15T00:00:00Z'},
    {id:'CNT-T04',partnerId:'PN004',companyCode:'TAMJ',officeCode:'',categories:['部屋・共用部','介護医療備品','厨房','ネットワーク'],status:'active',createdAt:'2025-01-15T00:00:00Z'},
    {id:'CNT-T05',partnerId:'PN005',companyCode:'TAMJ',officeCode:'',categories:['部屋・共用部'],status:'active',createdAt:'2025-01-15T00:00:00Z'},
    {id:'CNT-T06',partnerId:'PN006',companyCode:'TAMJ',officeCode:'',categories:['部屋・共用部','介護医療備品','厨房','浴室','福祉用具'],status:'active',createdAt:'2025-01-15T00:00:00Z'},
    {id:'CNT-T07',partnerId:'PN007',companyCode:'TAMJ',officeCode:'',categories:['介護医療備品'],status:'active',createdAt:'2025-01-15T00:00:00Z'},
    {id:'CNT-T08',partnerId:'PN008',companyCode:'TAMJ',officeCode:'',categories:['厨房'],status:'active',createdAt:'2025-01-15T00:00:00Z'},
    {id:'CNT-T09',partnerId:'PN009',companyCode:'TAMJ',officeCode:'',categories:['厨房'],status:'active',createdAt:'2025-01-15T00:00:00Z'},
    {id:'CNT-T10',partnerId:'PN010',companyCode:'TAMJ',officeCode:'',categories:['ネットワーク'],status:'active',createdAt:'2025-01-15T00:00:00Z'},
    {id:'CNT-T11',partnerId:'PN011',companyCode:'TAMJ',officeCode:'',categories:['ネットワーク'],status:'active',createdAt:'2025-01-15T00:00:00Z'},
    {id:'CNT-T12',partnerId:'PN012',companyCode:'TAMJ',officeCode:'',categories:['ネットワーク'],status:'active',createdAt:'2025-01-15T00:00:00Z'},
    {id:'CNT-T13',partnerId:'PN013',companyCode:'TAMJ',officeCode:'',categories:['介護医療備品'],status:'active',createdAt:'2025-01-15T00:00:00Z'},
    {id:'CNT-T14',partnerId:'PN014',companyCode:'TAMJ',officeCode:'',categories:['ネットワーク'],status:'active',createdAt:'2025-01-15T00:00:00Z'},
    {id:'CNT-T15',partnerId:'PN015',companyCode:'TAMJ',officeCode:'',categories:['ネットワーク'],status:'active',createdAt:'2025-01-15T00:00:00Z'},
    {id:'CNT-J01',partnerId:'PN001',companyCode:'JMAT',officeCode:'',categories:['建物・外','部屋・共用部','介護医療備品','厨房','ネットワーク'],status:'active',createdAt:'2025-01-20T00:00:00Z'},
    {id:'CNT-J02',partnerId:'PN002',companyCode:'JMAT',officeCode:'',categories:['建物・外'],status:'active',createdAt:'2025-01-20T00:00:00Z'},
    {id:'CNT-J03',partnerId:'PN003',companyCode:'JMAT',officeCode:'',categories:['建物・外'],status:'active',createdAt:'2025-01-20T00:00:00Z'},
    {id:'CNT-J04',partnerId:'PN004',companyCode:'JMAT',officeCode:'',categories:['部屋・共用部','介護医療備品','厨房','ネットワーク'],status:'active',createdAt:'2025-01-20T00:00:00Z'},
    {id:'CNT-J05',partnerId:'PN005',companyCode:'JMAT',officeCode:'',categories:['部屋・共用部'],status:'active',createdAt:'2025-01-20T00:00:00Z'},
    {id:'CNT-J06',partnerId:'PN006',companyCode:'JMAT',officeCode:'',categories:['部屋・共用部','介護医療備品','厨房'],status:'active',createdAt:'2025-01-20T00:00:00Z'},
    {id:'CNT-J07',partnerId:'PN007',companyCode:'JMAT',officeCode:'',categories:['介護医療備品'],status:'active',createdAt:'2025-01-20T00:00:00Z'},
    {id:'CNT-J08',partnerId:'PN008',companyCode:'JMAT',officeCode:'',categories:['厨房'],status:'active',createdAt:'2025-01-20T00:00:00Z'},
    {id:'CNT-J09',partnerId:'PN009',companyCode:'JMAT',officeCode:'',categories:['厨房'],status:'active',createdAt:'2025-01-20T00:00:00Z'},
    {id:'CNT-J10',partnerId:'PN010',companyCode:'JMAT',officeCode:'',categories:['ネットワーク'],status:'active',createdAt:'2025-01-20T00:00:00Z'},
    {id:'CNT-J11',partnerId:'PN011',companyCode:'JMAT',officeCode:'',categories:['ネットワーク'],status:'active',createdAt:'2025-01-20T00:00:00Z'},
    {id:'CNT-J12',partnerId:'PN012',companyCode:'JMAT',officeCode:'',categories:['ネットワーク'],status:'active',createdAt:'2025-01-20T00:00:00Z'},
    {id:'CNT-J13',partnerId:'PN013',companyCode:'JMAT',officeCode:'',categories:['介護医療備品'],status:'active',createdAt:'2025-01-20T00:00:00Z'},
    {id:'CNT-J14',partnerId:'PN014',companyCode:'JMAT',officeCode:'',categories:['ネットワーク'],status:'active',createdAt:'2025-01-20T00:00:00Z'},
    {id:'CNT-J15',partnerId:'PN015',companyCode:'JMAT',officeCode:'',categories:['ネットワーク'],status:'active',createdAt:'2025-01-20T00:00:00Z'}
];

// ========== 商品マスタ生成（300件/事業所 × 事業所数）==========
// 参考: 実際の介護施設 什器備品一覧 + 建物附属設備一覧
function generateDemoItems(companyCode, officeCodes, officeNames) {
    var items = [];
    var tpl = {
        '建物・外': [
            {n:'受電盤（キュービクル）',md:'',f:'1F',l:'電気室'},
            {n:'動力盤',md:'',f:'各階',l:'EPS'},
            {n:'各階分電盤',md:'',f:'各階',l:'EPS'},
            {n:'共用部照明器具（LED）',md:'',f:'各階',l:'廊下・ホール'},
            {n:'非常用照明',md:'',f:'各階',l:'廊下・階段'},
            {n:'誘導灯',md:'',f:'各階',l:'廊下・出入口'},
            {n:'外灯',md:'',f:'1F',l:'外構・アプローチ'},
            {n:'駐車場照明',md:'',f:'1F',l:'駐車場'},
            {n:'看板照明',md:'',f:'1F',l:'建物正面'},
            {n:'居室エアコン',md:'',f:'各階',l:'各居室'},
            {n:'個別エアコン（共用部）',md:'',f:'1F',l:'ホール・食堂'},
            {n:'厨房空調',md:'',f:'1F',l:'厨房'},
            {n:'全館空調機（AHU/PAC）',md:'',f:'屋上',l:'機械室'},
            {n:'屋上室外機',md:'',f:'屋上',l:'屋上'},
            {n:'熱交換器（全熱交換ユニット）',md:'',f:'各階',l:'天井裏'},
            {n:'浴室換気扇',md:'',f:'1F',l:'各浴室'},
            {n:'トイレ換気扇',md:'',f:'各階',l:'各トイレ'},
            {n:'排気ファン（共用部）',md:'',f:'各階',l:'各所'},
            {n:'受水槽',md:'',f:'1F',l:'屋外'},
            {n:'加圧給水ポンプ',md:'',f:'1F',l:'受水槽付近'},
            {n:'給湯器（セントラル）',md:'',f:'1F',l:'ボイラー室'},
            {n:'給湯循環ポンプ',md:'',f:'1F',l:'ボイラー室'},
            {n:'排水ポンプ',md:'',f:'B1',l:'地下ピット'},
            {n:'エレベーター本体',md:'',f:'1F',l:'EV室'},
            {n:'EV乗場インジケーター',md:'',f:'各階',l:'EV前'},
            {n:'屋上防水層',md:'',f:'屋上',l:'屋上全面'},
            {n:'外壁タイル/塗装',md:'',f:'外壁',l:'建物外周'},
            {n:'自動ドア',md:'',f:'1F',l:'正面玄関'},
            {n:'防火シャッター',md:'',f:'1F',l:'避難通路'},
            {n:'駐車場ゲート',md:'',f:'1F',l:'駐車場入口'},
            {n:'消火器',md:'',f:'各階',l:'廊下'},
            {n:'自動火災報知設備',md:'',f:'各階',l:'天井'},
            {n:'スプリンクラー',md:'',f:'各階',l:'天井'},
            {n:'防火扉',md:'',f:'各階',l:'防火区画'},
            {n:'非常放送設備',md:'',f:'1F',l:'事務室'},
            {n:'連結送水管',md:'',f:'各階',l:'階段室'},
            {n:'排煙設備',md:'',f:'各階',l:'天井'}
        ],
        '部屋・共用部': [
            {n:'介護用電動ベッド（3モーター）',md:'',f:'各階',l:'各居室'},
            {n:'ベッドサイドテーブル',md:'',f:'各階',l:'各居室'},
            {n:'ベッドサイド柵',md:'',f:'各階',l:'各居室'},
            {n:'チェスト（衣類収納）',md:'CSC-9060HNA',f:'各階',l:'各居室'},
            {n:'デスク',md:'NTU-7090DESKNA',f:'各階',l:'各居室'},
            {n:'チェア',md:'TOE-122GY',f:'各階',l:'各居室'},
            {n:'ハンガーラック',md:'',f:'各階',l:'各居室'},
            {n:'ペダルオープンゴミ箱 20L',md:'DS2188207',f:'各階',l:'各居室'},
            {n:'傘立て',md:'K-102T',f:'1F',l:'玄関'},
            {n:'電話機台/消毒液置き台',md:'RFTC-3573W',f:'1F',l:'受付'},
            {n:'掲示板',md:'',f:'1F',l:'エントランス'},
            {n:'フェイクグリーン（大型）',md:'',f:'1F',l:'エントランス'},
            {n:'業務用玄関マット',md:'',f:'1F',l:'エントランス'},
            {n:'来客用ソファ',md:'',f:'1F',l:'エントランス'},
            {n:'オールラウンドテーブル（長方形）',md:'UFT-ST1890',f:'1F',l:'食堂'},
            {n:'ダイニングチェア',md:'MC-510NA(BJ)',f:'1F',l:'食堂'},
            {n:'TVスタンド（86インチ対応）',md:'CR-PL57BK',f:'1F',l:'食堂'},
            {n:'スツール',md:'SS-320T(BK)',f:'1F',l:'食堂'},
            {n:'OAミーティングテーブル',md:'ATW-2190-AF2',f:'1F',l:'談話室'},
            {n:'壁掛け時計',md:'',f:'各階',l:'食堂・廊下'},
            {n:'ワーキングデスク',md:'RFFLD-1260NA-WL',f:'1F',l:'事務室'},
            {n:'オフィスチェア',md:'K-921(BK)',f:'1F',l:'事務室'},
            {n:'書庫（引違い）',md:'HOS-HKSDX',f:'1F',l:'事務室'},
            {n:'耐火金庫（テンキー式）',md:'OSD-E',f:'1F',l:'事務室'},
            {n:'ホワイトボード（壁掛）',md:'NV34Y',f:'1F',l:'事務室'},
            {n:'鍵管理ボックス',md:'',f:'1F',l:'事務室'},
            {n:'薬品保管庫（施錠付）',md:'',f:'1F',l:'事務室'},
            {n:'居室カーテン（遮光）',md:'TKY80256',f:'各階',l:'全居室'},
            {n:'居室レースカーテン',md:'TKY80460',f:'各階',l:'全居室'},
            {n:'ベッドシーツ/枕カバー',md:'',f:'各階',l:'各居室'},
            {n:'防水シーツ',md:'',f:'各階',l:'各居室'},
            {n:'洗濯機 7kg',md:'BWG70J',f:'1F',l:'洗濯室'},
            {n:'衣類乾燥機 5kg',md:'DEN50HV',f:'1F',l:'洗濯室'},
            {n:'中軽量ラック（リネン収納）',md:'SPLR-766-5-T',f:'1F',l:'洗濯室'},
            {n:'ランドリーカート',md:'',f:'1F',l:'洗濯室'},
            {n:'テレビ 75型',md:'75Z770L',f:'1F',l:'食堂'},
            {n:'電子レンジ',md:'ERS17Y',f:'1F',l:'スタッフルーム'},
            {n:'電動ポット 5L',md:'CD-SE50',f:'1F',l:'食堂'},
            {n:'冷蔵庫（458L）',md:'AQR-VZ46P',f:'1F',l:'食堂'},
            {n:'冷蔵庫（330L）',md:'MR-C33J',f:'1F',l:'スタッフルーム'},
            {n:'業務用掃除機',md:'CV-G1',f:'各階',l:'各階'},
            {n:'充電式クリーナー',md:'CL140FDRFW',f:'各階',l:'各階'},
            {n:'シュレッダー',md:'NSE404BK',f:'1F',l:'事務室'},
            {n:'ドライヤー',md:'KHD1378W',f:'1F',l:'浴室脱衣室'},
            {n:'6人用ロッカー',md:'TLK-S6',f:'1F',l:'ロッカールーム'},
            {n:'スタッフ用折畳ベッド',md:'',f:'1F',l:'スタッフルーム'},
            {n:'ダストボックス',md:'DX #800',f:'1F',l:'外構'},
            {n:'ペーパータオルホルダー',md:'',f:'各階',l:'各トイレ'},
            {n:'消毒液ディスペンサー（自動）',md:'',f:'各階',l:'各階入口'}
        ],
        '介護医療備品': [
            {n:'特殊浴槽（機械浴）本体',md:'フィーノ SP110',f:'1F',l:'機械浴室'},
            {n:'電動ストレッチャー',md:'SP100-ST',f:'1F',l:'機械浴室'},
            {n:'リフト付シャワーキャリー',md:'LS-500',f:'1F',l:'機械浴室'},
            {n:'シャワーチェアー（折りたたみ）',md:'PN-L41721BR',f:'1F',l:'各浴室'},
            {n:'シャワーキャリー',md:'KS-4',f:'1F',l:'浴室'},
            {n:'滑り止めマット',md:'ユクリア L',f:'1F',l:'各浴室'},
            {n:'浴室用車椅子',md:'',f:'1F',l:'浴室'},
            {n:'体重計（バリアフリー型）',md:'AD-6106R',f:'1F',l:'脱衣室'},
            {n:'大浴場循環装置',md:'',f:'1F',l:'大浴場機械室'},
            {n:'ろ過装置',md:'',f:'1F',l:'大浴場機械室'},
            {n:'ボイラー',md:'',f:'1F',l:'ボイラー室'},
            {n:'電子体温計',md:'CTE707',f:'各階',l:'ナースステーション'},
            {n:'非接触型電子体温計',md:'HPC-01',f:'各階',l:'ナースステーション'},
            {n:'パルスオキシメーター',md:'PLS-01P',f:'各階',l:'ナースステーション'},
            {n:'上腕血圧計',md:'HCR-7107',f:'各階',l:'ナースステーション'},
            {n:'聴診器',md:'クラシックⅢ',f:'各階',l:'ナースステーション'},
            {n:'吸引器',md:'ミニックⅢ-S',f:'各階',l:'ナースステーション'},
            {n:'点滴カート',md:'JIC264',f:'各階',l:'各階'},
            {n:'車椅子（標準型）',md:'',f:'1F',l:'共用'},
            {n:'車椅子（リクライニング）',md:'',f:'1F',l:'共用'},
            {n:'ストレッチャー',md:'',f:'1F',l:'共用'},
            {n:'歩行器',md:'',f:'1F',l:'共用'},
            {n:'ポータブルトイレ',md:'',f:'各階',l:'予備'},
            {n:'スライディングボード',md:'',f:'各階',l:'各階'},
            {n:'リフト（床走行型）',md:'',f:'1F',l:'共用'},
            {n:'AED',md:'',f:'1F',l:'エントランス'},
            {n:'救急箱/応急処置セット',md:'',f:'各階',l:'各階'},
            {n:'ツールカート',md:'CA385-000X-MB',f:'各階',l:'各階'}
        ],
        '厨房': [
            {n:'冷凍冷蔵庫（業務用）',md:'SRR-K1561C2B',f:'1F',l:'厨房'},
            {n:'冷蔵コールドテーブル',md:'SUR-K1261SB',f:'1F',l:'厨房'},
            {n:'スチームコンベクションオーブン',md:'TGSC-5CL',f:'1F',l:'厨房'},
            {n:'ガステーブル（ウルティモ）',md:'TGTA-0921',f:'1F',l:'厨房'},
            {n:'炊飯器',md:'RR-300C-B',f:'1F',l:'厨房'},
            {n:'スープジャー 12L',md:'TH-CV120',f:'1F',l:'厨房'},
            {n:'二槽シンク',md:'TRE-2S-120NB',f:'1F',l:'厨房'},
            {n:'引出付調理台',md:'TRE-WCT-180DNB',f:'1F',l:'厨房'},
            {n:'食器洗浄機（ドアタイプ）',md:'TDWD-4EL',f:'1F',l:'厨房'},
            {n:'電気式食器消毒保管庫',md:'ESD-5',f:'1F',l:'厨房'},
            {n:'包丁まな板殺菌庫',md:'TNS-3045WF',f:'1F',l:'厨房'},
            {n:'エレファントシェルフ',md:'N-TES-19-6161C',f:'1F',l:'厨房'},
            {n:'全自動軟水器',md:'RP-03DM',f:'1F',l:'厨房'},
            {n:'配膳車',md:'TH65-30S',f:'1F',l:'厨房'},
            {n:'製氷機',md:'',f:'1F',l:'厨房'},
            {n:'飯碗（身＋蓋）',md:'M-496-HYU',f:'1F',l:'厨房'},
            {n:'吸物椀（身＋蓋）',md:'GW-353-TM',f:'1F',l:'厨房'},
            {n:'ウェーブ皿（身＋蓋）',md:'M-437-FOC',f:'1F',l:'厨房'},
            {n:'丸小鉢（身＋蓋）',md:'M-405-FOA',f:'1F',l:'厨房'},
            {n:'正角トレイ',md:'ST-3300BR',f:'1F',l:'厨房'},
            {n:'箸',md:'TCK-22-SM',f:'1F',l:'厨房'},
            {n:'フードプロセッサー',md:'RM-5200VD',f:'1F',l:'厨房'},
            {n:'寸胴鍋',md:'MTIプロガスト',f:'1F',l:'厨房'},
            {n:'抗菌まな板（大）',md:'',f:'1F',l:'厨房'},
            {n:'牛刀',md:'イノックス抗菌',f:'1F',l:'厨房'},
            {n:'すくいやすい食器/自助具',md:'',f:'1F',l:'厨房'},
            {n:'とろみ調整用具',md:'',f:'1F',l:'厨房'},
            {n:'厨房排気フード',md:'',f:'1F',l:'厨房'},
            {n:'グリスフィルター',md:'',f:'1F',l:'厨房'},
            {n:'グリストラップ',md:'',f:'1F',l:'厨房'}
        ],
        'ネットワーク': [
            {n:'ルーター',md:'NVR510',f:'1F',l:'サーバー室'},
            {n:'無線アクセスポイント',md:'WAPM-1266R',f:'各階',l:'天井'},
            {n:'ノートPC',md:'ASUS M1405YA',f:'1F',l:'事務室'},
            {n:'デジタルカラー複合機',md:'TaskAlfa3554',f:'1F',l:'事務室'},
            {n:'ビジネスフォン主装置',md:'Aspire WX Plus',f:'1F',l:'事務室'},
            {n:'デジタル多機能電話機',md:'DTK-12D-1D',f:'各階',l:'事務室・各階'},
            {n:'介護記録ソフト',md:'',f:'1F',l:'事務室'},
            {n:'タブレット端末',md:'',f:'各階',l:'各階'},
            {n:'ラミネーター（A3）',md:'HEL02A3W',f:'1F',l:'事務室'},
            {n:'テプラ本体',md:'SR170',f:'1F',l:'事務室'},
            {n:'ナースコール親機',md:'',f:'各階',l:'ナースステーション'},
            {n:'ナースコール子機（メインユニット）',md:'MD50',f:'各階',l:'各居室'},
            {n:'緊急呼出ボタン（通常）',md:'SW23E',f:'各階',l:'各居室'},
            {n:'緊急呼出ボタン（防水）',md:'SW23W',f:'1F',l:'浴室'},
            {n:'スタッフ用端末',md:'',f:'各階',l:'各階'},
            {n:'防犯カメラ（屋外）',md:'',f:'1F',l:'外構・駐車場'},
            {n:'防犯カメラ（屋内）',md:'',f:'各階',l:'共用廊下'},
            {n:'カメラ録画装置（NVR）',md:'',f:'1F',l:'事務室'},
            {n:'インターホン（エントランス）',md:'',f:'1F',l:'正面玄関'},
            {n:'ワイヤレスドアホン',md:'VL-SGZ30',f:'1F',l:'正面'},
            {n:'静音台車',md:'PLA150-DX',f:'各階',l:'各階'},
            {n:'中軽量ラック',md:'SPLR各種',f:'各階',l:'各階倉庫'},
            {n:'施設名看板/サイン',md:'',f:'1F',l:'外構'},
            {n:'避難用具（担架等）',md:'',f:'各階',l:'各階'},
            {n:'非常用食料・水（3日分）',md:'',f:'1F',l:'倉庫'},
            {n:'スマートミーティングカメラ',md:'YA-PSE-0510',f:'1F',l:'会議室'}
        ]
    };
    var counter = 1;
    for (var oi = 0; oi < officeCodes.length; oi++) {
        Object.keys(tpl).forEach(function(cat) {
            var ts = tpl[cat];
            for (var r = 0; r < 60; r++) {
                var t = ts[r % ts.length];
                items.push({
                    itemId:'ITEM-'+companyCode+'-'+String(counter).padStart(4,'0'),
                    companyCode:companyCode, officeCode:officeCodes[oi], officeName:officeNames[oi],
                    name:t.n+(r>=ts.length?' #'+(r+1):''), category:cat, maker:'メーカー', model:t.md,
                    unit:'台', price:Math.floor(Math.random()*500000)+10000, stock:1,
                    floor:t.f, location:t.l, description:'', assignedPartnerId:null, assignedPartnerName:'',
                    status:'active', createdAt:'2025-01-'+String(10+(counter%20)).padStart(2,'0')+'T09:00:00Z',
                    updatedAt:'2025-01-'+String(10+(counter%20)).padStart(2,'0')+'T09:00:00Z'
                });
                counter++;
            }
        });
    }
    return items;
}
// ========== 通報履歴ダミー ==========
function generateDemoReports(companyCode, officeCodes, officeNames, accounts) {
    var reports = [];
    var data = [
        ['2F居室のエアコンが冷えない','建物・外','完了'],['共用廊下の蛍光灯が切れている','建物・外','完了'],
        ['浴室の排水が詰まり気味','建物・外','対応中'],['車いすのブレーキが効きにくい','介護医療備品','未対応'],
        ['業務用冷蔵庫から異音','厨房','完了'],['ナースコール応答遅延','ネットワーク','対応中'],
        ['玄関の自動ドアの動作が遅い','建物・外','完了'],['給湯器のお湯が出にくい','建物・外','未対応'],
        ['3F共用スペースのTV映らない','部屋・共用部','完了'],['歩行器のゴム摩耗','介護医療備品','完了'],
        ['食洗機のエラー表示','厨房','対応中'],['Wi-Fiが途切れる','ネットワーク','完了'],
        ['電動ベッドのリモコン故障','部屋・共用部','未対応'],['防犯カメラの映像乱れ','ネットワーク','完了'],
        ['スチコンの温度上がらない','厨房','対応中'],['消火器の期限切れ確認','建物・外','完了'],
        ['洗濯機の脱水異音','部屋・共用部','完了'],['吸引器の吸引力低下','介護医療備品','未対応'],
        ['AEDバッテリー警告表示','介護医療備品','対応中'],['配膳車のキャスター不具合','厨房','完了'],
        ['複合機の紙詰まり頻発','ネットワーク','完了'],['分電盤から焦げ臭い','建物・外','対応中'],
        ['パルスオキシメーター電池切れ','介護医療備品','完了'],['製氷機が氷を作らない','厨房','未対応']
    ];
    var staffs = accounts.filter(function(a){return a.companyCode===companyCode&&(a.role==='staff'||a.role==='office_admin');});
    for (var i = 0; i < data.length; i++) {
        var oi = i % officeCodes.length; var si = i % staffs.length;
        var s = staffs[si]||{name:'スタッフ',id:'unknown'};
        var ts = new Date(); ts.setDate(ts.getDate()-(30-i)); ts.setHours(8+(i%10),(i*17)%60,0,0);
        var statusMap = {'未対応':'pending','対応中':'in_progress','完了':'completed'};
        reports.push({
            id:'RPT-'+companyCode+'-'+String(i+1).padStart(4,'0'),
            companyCode:companyCode, officeCode:officeCodes[oi], officeName:officeNames[oi],
            title:data[i][0], category:data[i][1], description:data[i][0], type:'report',
            timestamp:ts.toISOString(), reporter:s.name, reporterId:s.id, userId:s.id,
            status:statusMap[data[i][2]], contractorStatus:data[i][2],
            assignedPartnerId:null, assignedPartnerName:'',
            createdAt:ts.toISOString(), updatedAt:ts.toISOString()
        });
    }
    return reports;
}

// ========== デモマスタデータ初期化 ==========
function initDemoData() {
    if (localStorage.getItem('demo_initialized') === 'v12') return;

    var companies = [
        {code:'TAMJ',name:'タムジ株式会社',status:'active',postalCode:'100-0001',prefecture:'東京都',address:'千代田区千代田1-1',phone:'03-1234-5678'},
        {code:'JMAT',name:'ジェイマットジャパン合同会社',status:'active',postalCode:'220-0012',prefecture:'神奈川県',address:'横浜市西区みなとみらい1-1',phone:'045-9876-5432'},
        {code:'SYSTEM',name:'ワンタッチ管理運営',status:'active'}
    ];
    localStorage.setItem('companies', JSON.stringify(companies));

    var offices = [
        {companyCode:'TAMJ',companyName:'タムジ株式会社',code:'TAMJ-J0001',name:'さくら苑',serviceType:'介護老人福祉施設',status:'active',postalCode:'',prefecture:'東京都',address:'',phone:'',fax:'',email:'',building:'',notes:'',createdAt:'2025-01-10'},
        {companyCode:'TAMJ',companyName:'タムジ株式会社',code:'TAMJ-J0002',name:'ひまわり荘',serviceType:'認知症対応型共同生活介護',status:'active',postalCode:'',prefecture:'東京都',address:'',phone:'',fax:'',email:'',building:'',notes:'',createdAt:'2025-01-10'},
        {companyCode:'TAMJ',companyName:'タムジ株式会社',code:'TAMJ-J0003',name:'あおぞらの家',serviceType:'通所介護',status:'active',postalCode:'',prefecture:'東京都',address:'',phone:'',fax:'',email:'',building:'',notes:'',createdAt:'2025-01-10'},
        {companyCode:'TAMJ',companyName:'タムジ株式会社',code:'TAMJ-H001',name:'本社',serviceType:'',status:'active',postalCode:'',prefecture:'東京都',address:'',phone:'',fax:'',email:'',building:'',notes:'',createdAt:'2025-01-10'},
        {companyCode:'JMAT',companyName:'ジェイマットジャパン合同会社',code:'JMAT-J0001',name:'グリーンヒル',serviceType:'介護老人保健施設',status:'active',postalCode:'',prefecture:'神奈川県',address:'',phone:'',fax:'',email:'',building:'',notes:'',createdAt:'2025-01-15'},
        {companyCode:'JMAT',companyName:'ジェイマットジャパン合同会社',code:'JMAT-J0002',name:'コスモス園',serviceType:'介護老人福祉施設',status:'active',postalCode:'',prefecture:'神奈川県',address:'',phone:'',fax:'',email:'',building:'',notes:'',createdAt:'2025-01-15'},
        {companyCode:'JMAT',companyName:'ジェイマットジャパン合同会社',code:'JMAT-J0003',name:'やすらぎの丘',serviceType:'特別養護老人ホーム',status:'active',postalCode:'',prefecture:'神奈川県',address:'',phone:'',fax:'',email:'',building:'',notes:'',createdAt:'2025-01-15'},
        {companyCode:'JMAT',companyName:'ジェイマットジャパン合同会社',code:'JMAT-H001',name:'本社',serviceType:'',status:'active',postalCode:'',prefecture:'神奈川県',address:'',phone:'',fax:'',email:'',building:'',notes:'',createdAt:'2025-01-15'}
    ];
    localStorage.setItem('offices', JSON.stringify(offices));
    localStorage.setItem('officeCounter', '10');

    var accountList = [];
    Object.keys(DEMO_ACCOUNTS).forEach(function(key){
        var a = DEMO_ACCOUNTS[key];
        if (a.role !== 'contractor') {
            accountList.push({id:a.id,name:a.name,role:a.role,companyCode:a.companyCode,companyName:a.companyName,officeCode:a.officeCode,officeName:a.officeName,status:'active',password:a.password,createdAt:'2025-01-10'});
        }
    });
    localStorage.setItem('accounts', JSON.stringify(accountList));
    localStorage.setItem('partners', JSON.stringify(DEMO_PARTNERS));
    localStorage.setItem('onetouch.contracts', JSON.stringify(DEMO_CONTRACTS));

    var tamjItems = generateDemoItems('TAMJ',['TAMJ-J0001','TAMJ-J0002','TAMJ-J0003'],['さくら苑','ひまわり荘','あおぞらの家']);
    var jmatItems = generateDemoItems('JMAT',['JMAT-J0001','JMAT-J0002','JMAT-J0003'],['グリーンヒル','コスモス園','やすらぎの丘']);
    var allItems = tamjItems.concat(jmatItems);
    // CSVカテゴリー再編成に基づくカテゴリー上書き（商品コードを軸）
    var categoryMapping = {"ITEM-TAMJ-0061":"福祉用具","ITEM-TAMJ-0062":"福祉用具","ITEM-TAMJ-0110":"福祉用具","ITEM-TAMJ-0121":"浴室","ITEM-TAMJ-0122":"浴室","ITEM-TAMJ-0123":"浴室","ITEM-TAMJ-0124":"浴室","ITEM-TAMJ-0125":"浴室","ITEM-TAMJ-0126":"浴室","ITEM-TAMJ-0127":"浴室","ITEM-TAMJ-0129":"浴室","ITEM-TAMJ-0130":"浴室","ITEM-TAMJ-0131":"浴室","ITEM-TAMJ-0149":"浴室","ITEM-TAMJ-0150":"浴室","ITEM-TAMJ-0151":"浴室","ITEM-TAMJ-0152":"浴室","ITEM-TAMJ-0153":"浴室","ITEM-TAMJ-0154":"浴室","ITEM-TAMJ-0155":"浴室","ITEM-TAMJ-0157":"浴室","ITEM-TAMJ-0158":"浴室","ITEM-TAMJ-0159":"浴室","ITEM-TAMJ-0177":"浴室","ITEM-TAMJ-0178":"浴室","ITEM-TAMJ-0179":"浴室","ITEM-TAMJ-0180":"浴室","ITEM-TAMJ-0249":"部屋・共用部","ITEM-TAMJ-0250":"部屋・共用部","ITEM-TAMJ-0261":"部屋・共用部","ITEM-TAMJ-0262":"部屋・共用部","ITEM-TAMJ-0263":"建物・外","ITEM-TAMJ-0264":"その他","ITEM-TAMJ-0265":"その他","ITEM-TAMJ-0275":"部屋・共用部","ITEM-TAMJ-0276":"部屋・共用部","ITEM-TAMJ-0287":"部屋・共用部","ITEM-TAMJ-0288":"部屋・共用部","ITEM-TAMJ-0289":"建物・外","ITEM-TAMJ-0290":"その他","ITEM-TAMJ-0291":"その他"};
    allItems.forEach(function(item) {
        if (categoryMapping[item.itemId]) {
            item.category = categoryMapping[item.itemId];
        }
    });
    // 契約テーブルからカテゴリに基づいて管理会社を自動割当（ラウンドロビンで分散）
    var partnerCounters = {};
    allItems.forEach(function(item){
        var cts = DEMO_CONTRACTS.filter(function(c){return c.companyCode===item.companyCode&&c.status==='active'&&c.categories.indexOf(item.category)>=0;});
        if(cts.length>0){
            var key = item.companyCode + ':' + item.category;
            if (!partnerCounters[key]) partnerCounters[key] = 0;
            var idx = partnerCounters[key] % cts.length;
            partnerCounters[key]++;
            var ct = cts[idx];
            var p=DEMO_PARTNERS.find(function(pp){return pp.id===ct.partnerId;});
            item.assignedPartnerId=ct.partnerId;
            item.assignedPartnerName=p?p.name:'';
        }
    });
    localStorage.setItem('onetouch.items', JSON.stringify(allItems));

    var tamjReports = generateDemoReports('TAMJ',['TAMJ-J0001','TAMJ-J0002','TAMJ-J0003'],['さくら苑','ひまわり荘','あおぞらの家'],accountList);
    var jmatReports = generateDemoReports('JMAT',['JMAT-J0001','JMAT-J0002','JMAT-J0003'],['グリーンヒル','コスモス園','やすらぎの丘'],accountList);
    var allReports = tamjReports.concat(jmatReports);
    var reportCounters = {};
    allReports.forEach(function(rpt){
        var cts = DEMO_CONTRACTS.filter(function(c){return c.companyCode===rpt.companyCode&&c.status==='active'&&c.categories.indexOf(rpt.category)>=0;});
        if(cts.length>0){
            var key = rpt.companyCode + ':' + rpt.category;
            if (!reportCounters[key]) reportCounters[key] = 0;
            var idx = reportCounters[key] % cts.length;
            reportCounters[key]++;
            var ct = cts[idx];
            var p=DEMO_PARTNERS.find(function(pp){return pp.id===ct.partnerId;});
            rpt.assignedPartnerId=ct.partnerId;
            rpt.assignedPartnerName=p?p.name:'';
        }
    });
    localStorage.setItem('onetouch.reports', JSON.stringify(allReports));

    localStorage.setItem('demo_initialized', 'v12');
}

// ========== 業者振り分けロジック ==========
function resolvePartner(item, officeCode) {
    if (item.assignedPartnerId) return {partnerId:item.assignedPartnerId,partnerName:item.assignedPartnerName||''};
    if (item.category && item.companyCode) {
        var contracts=[]; try{contracts=JSON.parse(localStorage.getItem('onetouch.contracts')||'[]');}catch(e){}
        var matched=contracts.filter(function(c){return c.status==='active'&&c.companyCode===item.companyCode&&c.categories&&c.categories.indexOf(item.category)>=0&&(!c.officeCode||c.officeCode===officeCode);});
        if(matched.length>0){var ps=getPartnersData();var p=ps.find(function(pp){return pp.id===matched[0].partnerId||pp.partnerCode===matched[0].partnerId;});return{partnerId:matched[0].partnerId,partnerName:p?p.name:''};}
    }
    return {partnerId:null,partnerName:''};
}
function getPartnersData(){var p=[];try{p=JSON.parse(localStorage.getItem('partners')||'[]');}catch(e){}return p;}
function getPartnerCompanies(partnerId){var cts=[];try{cts=JSON.parse(localStorage.getItem('onetouch.contracts')||'[]');}catch(e){}var cs=[];cts.forEach(function(c){if(c.partnerId===partnerId&&c.status==='active'&&cs.indexOf(c.companyCode)===-1)cs.push(c.companyCode);});return cs;}
