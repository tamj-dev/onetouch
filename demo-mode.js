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
var SNAPSHOT_KEYS = ['companies','offices','accounts','partners','onetouch.contracts','onetouch.items','onetouch.reports','officeCounter','onetouch.stagnationDays'];

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
    // デモ切替中は復元しない
    if (window._demoSwitching) return;
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
window.SYSTEM_CATEGORIES = ['建物・外まわり', '部屋・共用部の家具・家電', '介護医療・お風呂の道具', '厨房・食事の道具', '通信・呼出し・防火の機器', 'その他'];

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

    // 業者ログイン用（15社 管理会社）
    'pn001-yamada':     {companyCode:'PN001',id:'pn001-yamada',password:'demo',name:'山田 太郎',role:'contractor',companyName:'TAMJ建設',partnerId:'PN001',partnerCode:'PN001',categories:['建物・外まわり','部屋・共用部の家具・家電','介護医療・お風呂の道具','厨房・食事の道具','通信・呼出し・防火の機器'],assignedCompanies:['TAMJ','JMAT'],status:'active',isDemoMode:true},
    'pn002-aoki':       {companyCode:'PN002',id:'pn002-aoki',password:'demo',name:'青木 一郎',role:'contractor',companyName:'ACタムジ',partnerId:'PN002',partnerCode:'PN002',categories:['建物・外まわり'],assignedCompanies:['TAMJ','JMAT'],status:'active',isDemoMode:true},
    'pn003-eto':        {companyCode:'PN003',id:'pn003-eto',password:'demo',name:'江藤 健太',role:'contractor',companyName:'EVタムジ',partnerId:'PN003',partnerCode:'PN003',categories:['建物・外まわり'],assignedCompanies:['TAMJ','JMAT'],status:'active',isDemoMode:true},
    'pn004-tamura':     {companyCode:'PN004',id:'pn004-tamura',password:'demo',name:'田村 美咲',role:'contractor',companyName:'タムタム家具',partnerId:'PN004',partnerCode:'PN004',categories:['部屋・共用部の家具・家電','介護医療・お風呂の道具','厨房・食事の道具','通信・呼出し・防火の機器'],assignedCompanies:['TAMJ','JMAT'],status:'active',isDemoMode:true},
    'pn005-hayashi':    {companyCode:'PN005',id:'pn005-hayashi',password:'demo',name:'林 誠',role:'contractor',companyName:'リネンTAMJ',partnerId:'PN005',partnerCode:'PN005',categories:['部屋・共用部の家具・家電'],assignedCompanies:['TAMJ','JMAT'],status:'active',isDemoMode:true},
    'pn006-fukuda':     {companyCode:'PN006',id:'pn006-fukuda',password:'demo',name:'福田 裕子',role:'contractor',companyName:'福たむ',partnerId:'PN006',partnerCode:'PN006',categories:['部屋・共用部の家具・家電','介護医療・お風呂の道具','厨房・食事の道具'],assignedCompanies:['TAMJ','JMAT'],status:'active',isDemoMode:true},
    'pn007-ando':       {companyCode:'PN007',id:'pn007-ando',password:'demo',name:'安藤 大輔',role:'contractor',companyName:'AEDタム',partnerId:'PN007',partnerCode:'PN007',categories:['介護医療・お風呂の道具'],assignedCompanies:['TAMJ','JMAT'],status:'active',isDemoMode:true},
    'pn008-oshima':     {companyCode:'PN008',id:'pn008-oshima',password:'demo',name:'大島 春菜',role:'contractor',companyName:'お掃除タムタム',partnerId:'PN008',partnerCode:'PN008',categories:['厨房・食事の道具'],assignedCompanies:['TAMJ','JMAT'],status:'active',isDemoMode:true},
    'pn009-kitamura':   {companyCode:'PN009',id:'pn009-kitamura',password:'demo',name:'北村 和也',role:'contractor',companyName:'キッチンタムジ',partnerId:'PN009',partnerCode:'PN009',categories:['厨房・食事の道具'],assignedCompanies:['TAMJ','JMAT'],status:'active',isDemoMode:true},
    'pn010-nakata':     {companyCode:'PN010',id:'pn010-nakata',password:'demo',name:'中田 翔',role:'contractor',companyName:'タムネット',partnerId:'PN010',partnerCode:'PN010',categories:['通信・呼出し・防火の機器'],assignedCompanies:['TAMJ','JMAT'],status:'active',isDemoMode:true},
    'pn011-domoto':     {companyCode:'PN011',id:'pn011-domoto',password:'demo',name:'堂本 光',role:'contractor',companyName:'タム電気',partnerId:'PN011',partnerCode:'PN011',categories:['通信・呼出し・防火の機器'],assignedCompanies:['TAMJ','JMAT'],status:'active',isDemoMode:true},
    'pn012-sekiguchi':  {companyCode:'PN012',id:'pn012-sekiguchi',password:'demo',name:'関口 武',role:'contractor',companyName:'タムセキュリティ',partnerId:'PN012',partnerCode:'PN012',categories:['通信・呼出し・防火の機器'],assignedCompanies:['TAMJ','JMAT'],status:'active',isDemoMode:true},
    'pn013-kato':       {companyCode:'PN013',id:'pn013-kato',password:'demo',name:'加藤 優',role:'contractor',companyName:'介護タム',partnerId:'PN013',partnerCode:'PN013',categories:['通信・呼出し・防火の機器'],assignedCompanies:['TAMJ','JMAT'],status:'active',isDemoMode:true},
    'pn014-nishimura':  {companyCode:'PN014',id:'pn014-nishimura',password:'demo',name:'西村 拓',role:'contractor',companyName:'Nタムタム',partnerId:'PN014',partnerCode:'PN014',categories:['通信・呼出し・防火の機器'],assignedCompanies:['TAMJ','JMAT'],status:'active',isDemoMode:true},
    'pn015-kobayashi':  {companyCode:'PN015',id:'pn015-kobayashi',password:'demo',name:'小林 恵',role:'contractor',companyName:'タムコール',partnerId:'PN015',partnerCode:'PN015',categories:['通信・呼出し・防火の機器'],assignedCompanies:['TAMJ','JMAT'],status:'active',isDemoMode:true}
};

// ========== 管理会社マスタ（15社） ==========
window.DEMO_PARTNERS = [
    {id:'PN001',name:'TAMJ建設',partnerCode:'PN001',categories:['建物・外まわり','部屋・共用部の家具・家電','介護医療・お風呂の道具','厨房・食事の道具','通信・呼出し・防火の機器'],status:'active',contactName:'山田 太郎',contacts:[{name:'山田 太郎',loginId:'pn001-yamada',password:'demo',phone:'090-1234-5678',isMain:true}]},
    {id:'PN002',name:'ACタムジ',partnerCode:'PN002',categories:['建物・外まわり'],status:'active',contactName:'青木 一郎',contacts:[{name:'青木 一郎',loginId:'pn002-aoki',password:'demo',phone:'090-2222-0001',isMain:true}]},
    {id:'PN003',name:'EVタムジ',partnerCode:'PN003',categories:['建物・外まわり'],status:'active',contactName:'江藤 健太',contacts:[{name:'江藤 健太',loginId:'pn003-eto',password:'demo',phone:'090-2222-0002',isMain:true}]},
    {id:'PN004',name:'タムタム家具',partnerCode:'PN004',categories:['部屋・共用部の家具・家電','介護医療・お風呂の道具','厨房・食事の道具','通信・呼出し・防火の機器'],status:'active',contactName:'田村 美咲',contacts:[{name:'田村 美咲',loginId:'pn004-tamura',password:'demo',phone:'090-2222-0003',isMain:true}]},
    {id:'PN005',name:'リネンTAMJ',partnerCode:'PN005',categories:['部屋・共用部の家具・家電'],status:'active',contactName:'林 誠',contacts:[{name:'林 誠',loginId:'pn005-hayashi',password:'demo',phone:'090-2222-0004',isMain:true}]},
    {id:'PN006',name:'福たむ',partnerCode:'PN006',categories:['部屋・共用部の家具・家電','介護医療・お風呂の道具','厨房・食事の道具'],status:'active',contactName:'福田 裕子',contacts:[{name:'福田 裕子',loginId:'pn006-fukuda',password:'demo',phone:'090-2222-0005',isMain:true}]},
    {id:'PN007',name:'AEDタム',partnerCode:'PN007',categories:['介護医療・お風呂の道具'],status:'active',contactName:'安藤 大輔',contacts:[{name:'安藤 大輔',loginId:'pn007-ando',password:'demo',phone:'090-2222-0006',isMain:true}]},
    {id:'PN008',name:'お掃除タムタム',partnerCode:'PN008',categories:['厨房・食事の道具'],status:'active',contactName:'大島 春菜',contacts:[{name:'大島 春菜',loginId:'pn008-oshima',password:'demo',phone:'090-2222-0007',isMain:true}]},
    {id:'PN009',name:'キッチンタムジ',partnerCode:'PN009',categories:['厨房・食事の道具'],status:'active',contactName:'北村 和也',contacts:[{name:'北村 和也',loginId:'pn009-kitamura',password:'demo',phone:'090-2222-0008',isMain:true}]},
    {id:'PN010',name:'タムネット',partnerCode:'PN010',categories:['通信・呼出し・防火の機器'],status:'active',contactName:'中田 翔',contacts:[{name:'中田 翔',loginId:'pn010-nakata',password:'demo',phone:'090-2222-0009',isMain:true}]},
    {id:'PN011',name:'タム電気',partnerCode:'PN011',categories:['通信・呼出し・防火の機器'],status:'active',contactName:'堂本 光',contacts:[{name:'堂本 光',loginId:'pn011-domoto',password:'demo',phone:'090-2222-0010',isMain:true}]},
    {id:'PN012',name:'タムセキュリティ',partnerCode:'PN012',categories:['通信・呼出し・防火の機器'],status:'active',contactName:'関口 武',contacts:[{name:'関口 武',loginId:'pn012-sekiguchi',password:'demo',phone:'090-2222-0011',isMain:true}]},
    {id:'PN013',name:'介護タム',partnerCode:'PN013',categories:['通信・呼出し・防火の機器'],status:'active',contactName:'加藤 優',contacts:[{name:'加藤 優',loginId:'pn013-kato',password:'demo',phone:'090-2222-0012',isMain:true}]},
    {id:'PN014',name:'Nタムタム',partnerCode:'PN014',categories:['通信・呼出し・防火の機器'],status:'active',contactName:'西村 拓',contacts:[{name:'西村 拓',loginId:'pn014-nishimura',password:'demo',phone:'090-2222-0013',isMain:true}]},
    {id:'PN015',name:'タムコール',partnerCode:'PN015',categories:['通信・呼出し・防火の機器'],status:'active',contactName:'小林 恵',contacts:[{name:'小林 恵',loginId:'pn015-kobayashi',password:'demo',phone:'090-2222-0014',isMain:true}]}
];

// ========== 契約テーブル（TAMJ・JMAT共通で15社） ==========
window.DEMO_CONTRACTS = [
    {id:'CNT-T01',partnerId:'PN001',companyCode:'TAMJ',officeCode:'',categories:['建物・外まわり','部屋・共用部の家具・家電','介護医療・お風呂の道具','厨房・食事の道具','通信・呼出し・防火の機器'],status:'active',createdAt:'2025-01-15T00:00:00Z'},
    {id:'CNT-T02',partnerId:'PN002',companyCode:'TAMJ',officeCode:'',categories:['建物・外まわり'],status:'active',createdAt:'2025-01-15T00:00:00Z'},
    {id:'CNT-T03',partnerId:'PN003',companyCode:'TAMJ',officeCode:'',categories:['建物・外まわり'],status:'active',createdAt:'2025-01-15T00:00:00Z'},
    {id:'CNT-T04',partnerId:'PN004',companyCode:'TAMJ',officeCode:'',categories:['部屋・共用部の家具・家電','介護医療・お風呂の道具','厨房・食事の道具','通信・呼出し・防火の機器'],status:'active',createdAt:'2025-01-15T00:00:00Z'},
    {id:'CNT-T05',partnerId:'PN005',companyCode:'TAMJ',officeCode:'',categories:['部屋・共用部の家具・家電'],status:'active',createdAt:'2025-01-15T00:00:00Z'},
    {id:'CNT-T06',partnerId:'PN006',companyCode:'TAMJ',officeCode:'',categories:['部屋・共用部の家具・家電','介護医療・お風呂の道具','厨房・食事の道具'],status:'active',createdAt:'2025-01-15T00:00:00Z'},
    {id:'CNT-T07',partnerId:'PN007',companyCode:'TAMJ',officeCode:'',categories:['介護医療・お風呂の道具'],status:'active',createdAt:'2025-01-15T00:00:00Z'},
    {id:'CNT-T08',partnerId:'PN008',companyCode:'TAMJ',officeCode:'',categories:['厨房・食事の道具'],status:'active',createdAt:'2025-01-15T00:00:00Z'},
    {id:'CNT-T09',partnerId:'PN009',companyCode:'TAMJ',officeCode:'',categories:['厨房・食事の道具'],status:'active',createdAt:'2025-01-15T00:00:00Z'},
    {id:'CNT-T10',partnerId:'PN010',companyCode:'TAMJ',officeCode:'',categories:['通信・呼出し・防火の機器'],status:'active',createdAt:'2025-01-15T00:00:00Z'},
    {id:'CNT-T11',partnerId:'PN011',companyCode:'TAMJ',officeCode:'',categories:['通信・呼出し・防火の機器'],status:'active',createdAt:'2025-01-15T00:00:00Z'},
    {id:'CNT-T12',partnerId:'PN012',companyCode:'TAMJ',officeCode:'',categories:['通信・呼出し・防火の機器'],status:'active',createdAt:'2025-01-15T00:00:00Z'},
    {id:'CNT-T13',partnerId:'PN013',companyCode:'TAMJ',officeCode:'',categories:['通信・呼出し・防火の機器'],status:'active',createdAt:'2025-01-15T00:00:00Z'},
    {id:'CNT-T14',partnerId:'PN014',companyCode:'TAMJ',officeCode:'',categories:['通信・呼出し・防火の機器'],status:'active',createdAt:'2025-01-15T00:00:00Z'},
    {id:'CNT-T15',partnerId:'PN015',companyCode:'TAMJ',officeCode:'',categories:['通信・呼出し・防火の機器'],status:'active',createdAt:'2025-01-15T00:00:00Z'},
    {id:'CNT-J01',partnerId:'PN001',companyCode:'JMAT',officeCode:'',categories:['建物・外まわり','部屋・共用部の家具・家電','介護医療・お風呂の道具','厨房・食事の道具','通信・呼出し・防火の機器'],status:'active',createdAt:'2025-01-20T00:00:00Z'},
    {id:'CNT-J02',partnerId:'PN002',companyCode:'JMAT',officeCode:'',categories:['建物・外まわり'],status:'active',createdAt:'2025-01-20T00:00:00Z'},
    {id:'CNT-J03',partnerId:'PN003',companyCode:'JMAT',officeCode:'',categories:['建物・外まわり'],status:'active',createdAt:'2025-01-20T00:00:00Z'},
    {id:'CNT-J04',partnerId:'PN004',companyCode:'JMAT',officeCode:'',categories:['部屋・共用部の家具・家電','介護医療・お風呂の道具','厨房・食事の道具','通信・呼出し・防火の機器'],status:'active',createdAt:'2025-01-20T00:00:00Z'},
    {id:'CNT-J05',partnerId:'PN005',companyCode:'JMAT',officeCode:'',categories:['部屋・共用部の家具・家電'],status:'active',createdAt:'2025-01-20T00:00:00Z'},
    {id:'CNT-J06',partnerId:'PN006',companyCode:'JMAT',officeCode:'',categories:['部屋・共用部の家具・家電','介護医療・お風呂の道具','厨房・食事の道具'],status:'active',createdAt:'2025-01-20T00:00:00Z'},
    {id:'CNT-J07',partnerId:'PN007',companyCode:'JMAT',officeCode:'',categories:['介護医療・お風呂の道具'],status:'active',createdAt:'2025-01-20T00:00:00Z'},
    {id:'CNT-J08',partnerId:'PN008',companyCode:'JMAT',officeCode:'',categories:['厨房・食事の道具'],status:'active',createdAt:'2025-01-20T00:00:00Z'},
    {id:'CNT-J09',partnerId:'PN009',companyCode:'JMAT',officeCode:'',categories:['厨房・食事の道具'],status:'active',createdAt:'2025-01-20T00:00:00Z'},
    {id:'CNT-J10',partnerId:'PN010',companyCode:'JMAT',officeCode:'',categories:['通信・呼出し・防火の機器'],status:'active',createdAt:'2025-01-20T00:00:00Z'},
    {id:'CNT-J11',partnerId:'PN011',companyCode:'JMAT',officeCode:'',categories:['通信・呼出し・防火の機器'],status:'active',createdAt:'2025-01-20T00:00:00Z'},
    {id:'CNT-J12',partnerId:'PN012',companyCode:'JMAT',officeCode:'',categories:['通信・呼出し・防火の機器'],status:'active',createdAt:'2025-01-20T00:00:00Z'},
    {id:'CNT-J13',partnerId:'PN013',companyCode:'JMAT',officeCode:'',categories:['通信・呼出し・防火の機器'],status:'active',createdAt:'2025-01-20T00:00:00Z'},
    {id:'CNT-J14',partnerId:'PN014',companyCode:'JMAT',officeCode:'',categories:['通信・呼出し・防火の機器'],status:'active',createdAt:'2025-01-20T00:00:00Z'},
    {id:'CNT-J15',partnerId:'PN015',companyCode:'JMAT',officeCode:'',categories:['通信・呼出し・防火の機器'],status:'active',createdAt:'2025-01-20T00:00:00Z'}
];

// ========== 商品マスタ生成（300件/社） ==========
function generateDemoItems(companyCode, officeCodes, officeNames) {
    var items = [];
    var tpl = {
        '建物・外まわり': [{n:'業務用エアコン',mk:'ダイキン',md:'SZRC140BF',f:'1F',l:'共用廊下'},{n:'給湯器',mk:'リンナイ',md:'RUF-E2405SAW',f:'B1',l:'機械室'},{n:'自動ドア',mk:'ナブコ',md:'NKS-200',f:'1F',l:'正面玄関'},{n:'防火シャッター',mk:'文化シヤッター',md:'SFD-2500',f:'1F',l:'避難通路'},{n:'非常灯',mk:'パナソニック',md:'FA21312',f:'各階',l:'階段室'},{n:'排水ポンプ',mk:'荏原製作所',md:'DWV-0.4B',f:'B1',l:'排水槽'},{n:'昇降機',mk:'日立ビルシステム',md:'VFS-M',f:'1F',l:'EV室'},{n:'受水槽',mk:'前澤化成',md:'FRP-3000L',f:'屋上',l:'屋上機械室'},{n:'LED照明器具',mk:'アイリスオーヤマ',md:'LDR8-TW',f:'各階',l:'居室'},{n:'分電盤',mk:'河村電器',md:'EL4060',f:'1F',l:'電気室'},{n:'浴室換気扇',mk:'三菱電機',md:'VD-15ZFC',f:'1F',l:'浴室'},{n:'インターホン',mk:'アイホン',md:'JH-45',f:'1F',l:'正面玄関'}],
        '部屋・共用部の家具・家電': [{n:'介護用電動ベッド',mk:'パラマウントベッド',md:'KQ-63310',f:'2F',l:'居室'},{n:'床頭台',mk:'イノアック',md:'KBT-660',f:'各階',l:'居室'},{n:'テレビ 32型',mk:'シャープ',md:'2T-C32DE',f:'各階',l:'居室'},{n:'エアマット',mk:'モルテン',md:'プライム',f:'各階',l:'居室'},{n:'カーテン（防炎）',mk:'サンゲツ',md:'PK9026',f:'各階',l:'居室'},{n:'洗濯機 8kg',mk:'パナソニック',md:'NA-FA8H3',f:'1F',l:'洗濯室'},{n:'冷蔵庫（共用）',mk:'三菱電機',md:'MR-WX52H',f:'各階',l:'共用スペース'},{n:'掃除機',mk:'ダイソン',md:'V12',f:'各階',l:'倉庫'},{n:'電子レンジ',mk:'パナソニック',md:'NE-FL222',f:'各階',l:'共用スペース'}],
        '介護医療・お風呂の道具': [{n:'車いす（自走式）',mk:'カワムラサイクル',md:'KA822-40B',f:'1F',l:'倉庫'},{n:'歩行器',mk:'星医療酸器',md:'アルコー1S',f:'1F',l:'リハビリ室'},{n:'吸引器',mk:'新鋭工業',md:'パワースマイル',f:'各階',l:'ナースステーション'},{n:'血圧計',mk:'オムロン',md:'HEM-907',f:'各階',l:'ナースステーション'},{n:'パルスオキシメーター',mk:'コニカミノルタ',md:'PULSOX-Neo',f:'各階',l:'ナースステーション'},{n:'AED',mk:'フィリップス',md:'HS1',f:'1F',l:'事務所前'},{n:'ストレッチャー',mk:'パラマウントベッド',md:'KK-726',f:'1F',l:'医務室'},{n:'シャワーチェア',mk:'アロン化成',md:'安寿',f:'1F',l:'浴室'},{n:'体重計（車いす対応）',mk:'タニタ',md:'PW-650A',f:'1F',l:'医務室'},{n:'電動リフト',mk:'モリトー',md:'つるべー',f:'1F',l:'浴室'},{n:'車いす用スロープ（仮設）',mk:'ケアメディックス',md:'CS-200',f:'1F',l:'倉庫'}],
        '厨房・食事の道具': [{n:'業務用冷凍冷蔵庫',mk:'ホシザキ',md:'HRF-180LAF3',f:'1F',l:'厨房'},{n:'ガスレンジ',mk:'マルゼン',md:'RGR-1265D',f:'1F',l:'厨房'},{n:'スチームコンベクションオーブン',mk:'コメットカトウ',md:'CSI3-G5',f:'1F',l:'厨房'},{n:'食器洗浄機',mk:'ホシザキ',md:'JWE-400TUB',f:'1F',l:'厨房'},{n:'炊飯器（業務用）',mk:'タイガー',md:'JCC-2700',f:'1F',l:'厨房'},{n:'コールドテーブル',mk:'フクシマガリレイ',md:'LRC-150RM',f:'1F',l:'厨房'},{n:'配膳車',mk:'象印マホービン',md:'CW-28B',f:'1F',l:'厨房'},{n:'製氷機',mk:'ホシザキ',md:'IM-45M',f:'1F',l:'厨房'}],
        '通信・呼出し・防火の機器': [{n:'Wi-Fiアクセスポイント',mk:'バッファロー',md:'WXR-5700AX7S',f:'各階',l:'天井'},{n:'防犯カメラ',mk:'パナソニック',md:'WV-S1136',f:'1F',l:'玄関'},{n:'ナースコール親機',mk:'アイホン',md:'NFR-TX-S',f:'各階',l:'ナースステーション'},{n:'ナースコール子機',mk:'アイホン',md:'NFR-TA',f:'各階',l:'居室'},{n:'複合機',mk:'リコー',md:'IM C2500',f:'1F',l:'事務室'},{n:'UPS',mk:'APC',md:'SMT1500J',f:'1F',l:'サーバー室'},{n:'ネットワークスイッチ',mk:'TP-Link',md:'TL-SG108',f:'1F',l:'サーバー室'},{n:'ノートPC',mk:'富士通',md:'LIFEBOOK A577',f:'1F',l:'事務室'},{n:'消火器',mk:'ヤマトプロテック',md:'YA-10NX',f:'各階',l:'廊下'},{n:'訓練用消火器',mk:'ヤマトプロテック',md:'YTS-3',f:'1F',l:'防災備品庫'}],
        'その他': [{n:'非常用食料セット',mk:'尾西食品',md:'アルファ米',f:'1F',l:'備蓄倉庫'},{n:'送迎車 車載備品',mk:'—',md:'—',f:'—',l:'駐車場'},{n:'避難用担架',mk:'レスキューハウス',md:'RH-1',f:'1F',l:'防災備品庫'},{n:'季節装飾品',mk:'—',md:'—',f:'共用部',l:'倉庫'},{n:'レクリエーション用品',mk:'—',md:'—',f:'共用部',l:'多目的室'},{n:'園芸用品セット',mk:'—',md:'—',f:'屋外',l:'中庭'}]
    };
    var counter = 1;
    Object.keys(tpl).forEach(function(cat) {
        var ts = tpl[cat];
        // 契約テーブルからこのカテゴリに対応する全管理会社を検索
        var matchContracts = DEMO_CONTRACTS.filter(function(c) {
            return c.companyCode === companyCode && c.categories && c.categories.indexOf(cat) !== -1;
        });
        for (var r = 0; r < 50; r++) {
            var t = ts[r % ts.length]; var oi = r % officeCodes.length;
            // ラウンドロビンで管理会社を分散割当
            var pId = null; var pName = '';
            if (matchContracts.length > 0) {
                var mc = matchContracts[r % matchContracts.length];
                pId = mc.partnerId;
                var pObj = DEMO_PARTNERS.find(function(pp) { return pp.id === pId; });
                pName = pObj ? pObj.name : '';
            }
            items.push({
                itemId:'ITEM-'+companyCode+'-'+String(counter).padStart(4,'0'),
                companyCode:companyCode, officeCode:officeCodes[oi], officeName:officeNames[oi],
                name:t.n+(r>=ts.length?' #'+(r+1):''), category:cat, maker:t.mk, model:t.md,
                unit:'台', price:Math.floor(Math.random()*500000)+10000, stock:1,
                floor:t.f, location:t.l, description:'', assignedPartnerId:pId, assignedPartnerName:pName,
                status:'active', createdAt:'2025-01-'+String(10+(counter%20)).padStart(2,'0')+'T09:00:00Z',
                updatedAt:'2025-01-'+String(10+(counter%20)).padStart(2,'0')+'T09:00:00Z'
            });
            counter++;
        }
    });
    return items;
}

// ========== 通報履歴ダミー ==========
function generateDemoReports(companyCode, officeCodes, officeNames, accounts) {
    var reports = [];
    // 通報テンプレート（カテゴリ別）
    var templates = [
        {t:'エアコンの効きが悪い',c:'建物・外まわり',d:'冷房運転しても室温が下がらない'},
        {t:'蛍光灯が点滅している',c:'建物・外まわり',d:'共用廊下の蛍光灯がチカチカする'},
        {t:'排水が流れにくい',c:'建物・外まわり',d:'水を流すとゴボゴボ音がする'},
        {t:'自動ドアの反応が悪い',c:'建物・外まわり',d:'センサーの感度が落ちている'},
        {t:'給湯器からお湯が出ない',c:'建物・外まわり',d:'エラーコード点滅中'},
        {t:'テレビが映らない',c:'部屋・共用部の家具・家電',d:'電源は入るが画面が真っ暗'},
        {t:'洗濯機から異音がする',c:'部屋・共用部の家具・家電',d:'脱水時にガタガタ振動する'},
        {t:'電動ベッドのリモコン故障',c:'部屋・共用部の家具・家電',d:'ボタンを押しても反応しない'},
        {t:'冷蔵庫の温度が上がる',c:'部屋・共用部の家具・家電',d:'設定温度まで冷えない'},
        {t:'掃除機の吸引力低下',c:'部屋・共用部の家具・家電',d:'フィルター清掃しても改善しない'},
        {t:'車いすのブレーキ不良',c:'介護医療・お風呂の道具',d:'ブレーキを掛けても滑る'},
        {t:'歩行器のゴム摩耗',c:'介護医療・お風呂の道具',d:'接地面のゴムがすり減っている'},
        {t:'吸引器の吸引力低下',c:'介護医療・お風呂の道具',d:'パッキン劣化の可能性'},
        {t:'シャワーチェアのぐらつき',c:'介護医療・お風呂の道具',d:'座面がぐらつく'},
        {t:'AEDバッテリー警告',c:'介護医療・お風呂の道具',d:'バッテリー交換ランプ点灯'},
        {t:'業務用冷蔵庫から異音',c:'厨房・食事の道具',d:'コンプレッサー音が大きい'},
        {t:'食洗機のエラー表示',c:'厨房・食事の道具',d:'E03エラーで動かない'},
        {t:'製氷機が氷を作らない',c:'厨房・食事の道具',d:'水は入るが製氷しない'},
        {t:'スチコンの温度異常',c:'厨房・食事の道具',d:'設定温度まで上がらない'},
        {t:'配膳車のキャスター不具合',c:'厨房・食事の道具',d:'車輪が回りにくい'},
        {t:'Wi-Fiが途切れる',c:'通信・呼出し・防火の機器',d:'特定のフロアで頻繁に切断'},
        {t:'ナースコール応答遅延',c:'通信・呼出し・防火の機器',d:'呼出してから3秒以上かかる'},
        {t:'防犯カメラの映像乱れ',c:'通信・呼出し・防火の機器',d:'夜間映像にノイズが入る'},
        {t:'複合機の紙詰まり頻発',c:'通信・呼出し・防火の機器',d:'両面印刷時に詰まる'},
        {t:'消火器の期限切れ',c:'通信・呼出し・防火の機器',d:'使用期限超過の消火器あり'},
    ];
    var statuses = ['未対応','対応中','完了'];
    var statusMap = {'未対応':'pending','対応中':'in_progress','完了':'completed'};

    // 各事業所のスタッフを取得
    for (var oi = 0; oi < officeCodes.length; oi++) {
        var officeStaffs = accounts.filter(function(a) {
            return a.companyCode === companyCode && a.officeCode === officeCodes[oi] &&
                   (a.role === 'staff' || a.role === 'office_admin');
        });
        // 各スタッフに3件ずつ通報を生成
        for (var si = 0; si < officeStaffs.length; si++) {
            var s = officeStaffs[si];
            for (var ri = 0; ri < 3; ri++) {
                var tplIdx = (si * 3 + ri) % templates.length;
                var tpl = templates[tplIdx];
                var statusIdx = (si + ri) % 3;
                var ts = new Date();
                ts.setDate(ts.getDate() - (60 - oi * 15 - si * 3 - ri));
                ts.setHours(7 + (si + ri) % 12, (si * 13 + ri * 29) % 60, 0, 0);
                reports.push({
                    id: 'RPT-' + companyCode + '-' + String(reports.length + 1).padStart(4, '0'),
                    companyCode: companyCode,
                    officeCode: officeCodes[oi], officeName: officeNames[oi],
                    title: tpl.t, category: tpl.c, description: tpl.d, type: 'report',
                    timestamp: ts.toISOString(), reporter: s.name, reporterId: s.id, userId: s.id,
                    status: statusMap[statuses[statusIdx]],
                    contractorStatus: statuses[statusIdx],
                    assignedPartnerId: null, assignedPartnerName: '',
                    createdAt: ts.toISOString(), updatedAt: ts.toISOString()
                });
            }
        }
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
        {companyCode:'JMAT',companyName:'ジェイマットジャパン合同会社',code:'JMAT-J0001',name:'グリーンヒル',serviceType:'介護老人保健施設',status:'active',postalCode:'',prefecture:'神奈川県',address:'',phone:'',fax:'',email:'',building:'',notes:'',createdAt:'2025-01-15'},
        {companyCode:'JMAT',companyName:'ジェイマットジャパン合同会社',code:'JMAT-J0002',name:'コスモス園',serviceType:'介護老人福祉施設',status:'active',postalCode:'',prefecture:'神奈川県',address:'',phone:'',fax:'',email:'',building:'',notes:'',createdAt:'2025-01-15'},
        {companyCode:'JMAT',companyName:'ジェイマットジャパン合同会社',code:'JMAT-J0003',name:'やすらぎの丘',serviceType:'特別養護老人ホーム',status:'active',postalCode:'',prefecture:'神奈川県',address:'',phone:'',fax:'',email:'',building:'',notes:'',createdAt:'2025-01-15'}
    ];
    localStorage.setItem('offices', JSON.stringify(offices));
    localStorage.setItem('officeCounter', '10');

    var accountList = [];
    Object.keys(DEMO_ACCOUNTS).forEach(function(key){
        var a = DEMO_ACCOUNTS[key];
        if (a.role !== 'contractor' && a.role !== 'company_admin') {
            accountList.push({id:a.id,name:a.name,role:a.role,companyCode:a.companyCode,companyName:a.companyName,officeCode:a.officeCode,officeName:a.officeName,status:'active',password:a.password});
        }
    });
    localStorage.setItem('accounts', JSON.stringify(accountList));
    localStorage.setItem('partners', JSON.stringify(DEMO_PARTNERS));
    localStorage.setItem('onetouch.contracts', JSON.stringify(DEMO_CONTRACTS));

    var tamjItems = generateDemoItems('TAMJ',['TAMJ-J0001','TAMJ-J0002','TAMJ-J0003'],['さくら苑','ひまわり荘','あおぞらの家']);
    var jmatItems = generateDemoItems('JMAT',['JMAT-J0001','JMAT-J0002','JMAT-J0003'],['グリーンヒル','コスモス園','やすらぎの丘']);
    localStorage.setItem('onetouch.items', JSON.stringify(tamjItems.concat(jmatItems)));

    var tamjReports = generateDemoReports('TAMJ',['TAMJ-J0001','TAMJ-J0002','TAMJ-J0003'],['さくら苑','ひまわり荘','あおぞらの家'],accountList);
    var jmatReports = generateDemoReports('JMAT',['JMAT-J0001','JMAT-J0002','JMAT-J0003'],['グリーンヒル','コスモス園','やすらぎの丘'],accountList);
    var allReports = tamjReports.concat(jmatReports);
    allReports.forEach(function(rpt, idx){
        var cts = DEMO_CONTRACTS.filter(function(c){return c.companyCode===rpt.companyCode&&c.status==='active'&&c.categories.indexOf(rpt.category)>=0;});
        if(cts.length>0){var mc=cts[idx%cts.length];var p=DEMO_PARTNERS.find(function(pp){return pp.id===mc.partnerId;});rpt.assignedPartnerId=mc.partnerId;rpt.assignedPartnerName=p?p.name:'';}
    });
    localStorage.setItem('onetouch.reports', JSON.stringify(allReports));

    localStorage.setItem('demo_initialized', 'v12');
    // スナップショットを保存（デモ切替/ログアウト時の復元用）
    saveDemoSnapshot();
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
