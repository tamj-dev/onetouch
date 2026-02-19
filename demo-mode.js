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

    // 業者ログイン用
    'pn001-yamada': {companyCode:'PN001',id:'pn001-yamada',password:'demo',name:'山田 太郎',role:'contractor',companyName:'東京設備工業株式会社',partnerId:'PN001',partnerCode:'PN001',categories:['部屋・共用部の家具・家電','厨房・食事の道具','介護医療・お風呂の道具'],assignedCompanies:['TAMJ','JMAT'],status:'active',isDemoMode:true}
};

// ========== 業者マスタ ==========
window.DEMO_PARTNERS = [
    {id:'PN001',name:'東京設備工業株式会社',partnerCode:'PN001',categories:['部屋・共用部の家具・家電','厨房・食事の道具','介護医療・お風呂の道具'],status:'active',contactName:'山田 太郎',contacts:[{name:'山田 太郎',loginId:'pn001-yamada',password:'demo',phone:'090-1234-5678',isMain:true},{name:'高橋 次郎',loginId:'pn001-takahashi',password:'demo',phone:'090-8765-4321',isMain:false}]},
    {id:'PN002',name:'関東水道サービス',partnerCode:'PN002',categories:['建物・外まわり'],status:'active',contactName:'佐藤 花子',contacts:[{name:'佐藤 花子',loginId:'p002-sato',password:'demo',phone:'090-1111-2222',isMain:true}]},
    {id:'PN003',name:'日本電気工事',partnerCode:'PN003',categories:['通信・呼出し・防火の機器'],status:'active',contactName:'鈴木 一郎',contacts:[{name:'鈴木 一郎',loginId:'p003-suzuki',password:'demo',phone:'090-3333-4444',isMain:true}]},
    {id:'PN004',name:'ケアテック東京',partnerCode:'PN004',categories:['介護医療・お風呂の道具','部屋・共用部の家具・家電'],status:'active',contactName:'遠藤 修一',contacts:[{name:'遠藤 修一',loginId:'p004-endo',password:'demo',phone:'090-5555-6666',isMain:true}]},
    {id:'PN005',name:'横浜ビルメンテナンス',partnerCode:'PN005',categories:['建物・外まわり','通信・呼出し・防火の機器'],status:'active',contactName:'川村 拓海',contacts:[{name:'川村 拓海',loginId:'p005-kawamura',password:'demo',phone:'090-7777-8888',isMain:true}]},
    {id:'PN006',name:'メディカルサポート神奈川',partnerCode:'PN006',categories:['介護医療・お風呂の道具'],status:'active',contactName:'三浦 陽子',contacts:[{name:'三浦 陽子',loginId:'p006-miura',password:'demo',phone:'090-9999-0000',isMain:true}]}
];

// ========== 契約テーブル ==========
window.DEMO_CONTRACTS = [
    {id:'CNT-T01',partnerId:'PN001',companyCode:'TAMJ',officeCode:'',categories:['部屋・共用部の家具・家電','厨房・食事の道具','介護医療・お風呂の道具'],status:'active',createdAt:'2025-01-15T00:00:00Z'},
    {id:'CNT-T02',partnerId:'PN002',companyCode:'TAMJ',officeCode:'',categories:['建物・外まわり'],status:'active',createdAt:'2025-01-15T00:00:00Z'},
    {id:'CNT-T03',partnerId:'PN003',companyCode:'TAMJ',officeCode:'',categories:['通信・呼出し・防火の機器'],status:'active',createdAt:'2025-01-15T00:00:00Z'},
    {id:'CNT-T04',partnerId:'PN004',companyCode:'TAMJ',officeCode:'',categories:['介護医療・お風呂の道具','部屋・共用部の家具・家電'],status:'active',createdAt:'2025-02-01T00:00:00Z'},
    {id:'CNT-J01',partnerId:'PN001',companyCode:'JMAT',officeCode:'',categories:['部屋・共用部の家具・家電','厨房・食事の道具'],status:'active',createdAt:'2025-01-20T00:00:00Z'},
    {id:'CNT-J02',partnerId:'PN002',companyCode:'JMAT',officeCode:'',categories:['建物・外まわり'],status:'active',createdAt:'2025-01-20T00:00:00Z'},
    {id:'CNT-J03',partnerId:'PN005',companyCode:'JMAT',officeCode:'',categories:['建物・外まわり','通信・呼出し・防火の機器'],status:'active',createdAt:'2025-01-20T00:00:00Z'},
    {id:'CNT-J04',partnerId:'PN006',companyCode:'JMAT',officeCode:'',categories:['介護医療・お風呂の道具'],status:'active',createdAt:'2025-02-01T00:00:00Z'}
];

// ========== 商品マスタ生成（300件/社） ==========
function generateDemoItems(companyCode, officeCodes, officeNames) {
    var items = [];
    var tpl = {
        '建物・外まわり': [{n:'業務用エアコン',mk:'ダイキン',md:'SZRC140BF',f:'1F',l:'共用廊下'},{n:'給湯器',mk:'リンナイ',md:'RUF-E2405SAW',f:'B1',l:'機械室'},{n:'自動ドア',mk:'ナブコ',md:'NKS-200',f:'1F',l:'正面玄関'},{n:'消火器',mk:'ヤマトプロテック',md:'YA-10NX',f:'各階',l:'廊下'},{n:'防火シャッター',mk:'文化シヤッター',md:'SFD-2500',f:'1F',l:'避難通路'},{n:'非常灯',mk:'パナソニック',md:'FA21312',f:'各階',l:'階段室'},{n:'排水ポンプ',mk:'荏原製作所',md:'DWV-0.4B',f:'B1',l:'排水槽'},{n:'昇降機',mk:'日立ビルシステム',md:'VFS-M',f:'1F',l:'EV室'},{n:'受水槽',mk:'前澤化成',md:'FRP-3000L',f:'屋上',l:'屋上機械室'},{n:'LED照明器具',mk:'アイリスオーヤマ',md:'LDR8-TW',f:'各階',l:'居室'},{n:'分電盤',mk:'河村電器',md:'EL4060',f:'1F',l:'電気室'},{n:'浴室換気扇',mk:'三菱電機',md:'VD-15ZFC',f:'1F',l:'浴室'}],
        '部屋・共用部の家具・家電': [{n:'介護用電動ベッド',mk:'パラマウントベッド',md:'KQ-63310',f:'2F',l:'居室'},{n:'ナースコール子機',mk:'アイホン',md:'NFR-TA',f:'各階',l:'居室'},{n:'床頭台',mk:'イノアック',md:'KBT-660',f:'各階',l:'居室'},{n:'テレビ 32型',mk:'シャープ',md:'2T-C32DE',f:'各階',l:'居室'},{n:'エアマット',mk:'モルテン',md:'プライム',f:'各階',l:'居室'},{n:'カーテン（防炎）',mk:'サンゲツ',md:'PK9026',f:'各階',l:'居室'},{n:'洗濯機 8kg',mk:'パナソニック',md:'NA-FA8H3',f:'1F',l:'洗濯室'},{n:'冷蔵庫（共用）',mk:'三菱電機',md:'MR-WX52H',f:'各階',l:'共用スペース'},{n:'掃除機',mk:'ダイソン',md:'V12',f:'各階',l:'倉庫'},{n:'電子レンジ',mk:'パナソニック',md:'NE-FL222',f:'各階',l:'共用スペース'}],
        '介護医療・お風呂の道具': [{n:'車いす（自走式）',mk:'カワムラサイクル',md:'KA822-40B',f:'1F',l:'倉庫'},{n:'歩行器',mk:'星医療酸器',md:'アルコー1S',f:'1F',l:'リハビリ室'},{n:'吸引器',mk:'新鋭工業',md:'パワースマイル',f:'各階',l:'ナースステーション'},{n:'血圧計',mk:'オムロン',md:'HEM-907',f:'各階',l:'ナースステーション'},{n:'パルスオキシメーター',mk:'コニカミノルタ',md:'PULSOX-Neo',f:'各階',l:'ナースステーション'},{n:'AED',mk:'フィリップス',md:'HS1',f:'1F',l:'事務所前'},{n:'ストレッチャー',mk:'パラマウントベッド',md:'KK-726',f:'1F',l:'医務室'},{n:'シャワーチェア',mk:'アロン化成',md:'安寿',f:'1F',l:'浴室'},{n:'体重計（車いす対応）',mk:'タニタ',md:'PW-650A',f:'1F',l:'医務室'},{n:'電動リフト',mk:'モリトー',md:'つるべー',f:'1F',l:'浴室'}],
        '厨房・食事の道具': [{n:'業務用冷凍冷蔵庫',mk:'ホシザキ',md:'HRF-180LAF3',f:'1F',l:'厨房'},{n:'ガスレンジ',mk:'マルゼン',md:'RGR-1265D',f:'1F',l:'厨房'},{n:'スチームコンベクションオーブン',mk:'コメットカトウ',md:'CSI3-G5',f:'1F',l:'厨房'},{n:'食器洗浄機',mk:'ホシザキ',md:'JWE-400TUB',f:'1F',l:'厨房'},{n:'炊飯器（業務用）',mk:'タイガー',md:'JCC-2700',f:'1F',l:'厨房'},{n:'コールドテーブル',mk:'フクシマガリレイ',md:'LRC-150RM',f:'1F',l:'厨房'},{n:'配膳車',mk:'象印マホービン',md:'CW-28B',f:'1F',l:'厨房'},{n:'製氷機',mk:'ホシザキ',md:'IM-45M',f:'1F',l:'厨房'}],
        '通信・呼出し・防火の機器': [{n:'Wi-Fiアクセスポイント',mk:'バッファロー',md:'WXR-5700AX7S',f:'各階',l:'天井'},{n:'防犯カメラ',mk:'パナソニック',md:'WV-S1136',f:'1F',l:'玄関'},{n:'ナースコール親機',mk:'アイホン',md:'NFR-TX-S',f:'各階',l:'ナースステーション'},{n:'複合機',mk:'リコー',md:'IM C2500',f:'1F',l:'事務室'},{n:'UPS',mk:'APC',md:'SMT1500J',f:'1F',l:'サーバー室'},{n:'ネットワークスイッチ',mk:'TP-Link',md:'TL-SG108',f:'1F',l:'サーバー室'},{n:'インターホン',mk:'アイホン',md:'JH-45',f:'1F',l:'正面玄関'},{n:'ノートPC',mk:'富士通',md:'LIFEBOOK A577',f:'1F',l:'事務室'}],
        'その他': [{n:'非常用食料セット',mk:'尾西食品',md:'アルファ米',f:'1F',l:'備蓄倉庫'},{n:'送迎車 車載備品',mk:'—',md:'—',f:'—',l:'駐車場'},{n:'避難用担架',mk:'レスキューハウス',md:'RH-1',f:'1F',l:'防災備品庫'},{n:'訓練用消火器',mk:'ヤマトプロテック',md:'YTS-3',f:'1F',l:'防災備品庫'},{n:'車いす用スロープ（仮設）',mk:'ケアメディックス',md:'CS-200',f:'1F',l:'倉庫'},{n:'季節装飾品',mk:'—',md:'—',f:'共用部',l:'倉庫'},{n:'レクリエーション用品',mk:'—',md:'—',f:'共用部',l:'多目的室'},{n:'園芸用品セット',mk:'—',md:'—',f:'屋外',l:'中庭'}]
    };
    var counter = 1;
    Object.keys(tpl).forEach(function(cat) {
        var ts = tpl[cat];
        for (var r = 0; r < 50; r++) {
            var t = ts[r % ts.length]; var oi = r % officeCodes.length;
            items.push({
                itemId:'ITEM-'+companyCode+'-'+String(counter).padStart(4,'0'),
                companyCode:companyCode, officeCode:officeCodes[oi], officeName:officeNames[oi],
                name:t.n+(r>=ts.length?' #'+(r+1):''), category:cat, maker:t.mk, model:t.md,
                unit:'台', price:Math.floor(Math.random()*500000)+10000, stock:1,
                floor:t.f, location:t.l, description:'', assignedPartnerId:null, assignedPartnerName:'',
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
    var data = [
        ['2F居室のエアコンが冷えない','建物・外まわり','完了'],['共用廊下の蛍光灯が切れている','建物・外まわり','完了'],
        ['浴室の排水が詰まり気味','建物・外まわり','対応中'],['車いすのブレーキが効きにくい','介護医療・お風呂の道具','未対応'],
        ['業務用冷蔵庫から異音','厨房・食事の道具','完了'],['ナースコール応答遅延','通信・呼出し・防火の機器','対応中'],
        ['玄関の自動ドアの動作が遅い','建物・外まわり','完了'],['給湯器のお湯が出にくい','建物・外まわり','未対応'],
        ['3F共用スペースのTV映らない','部屋・共用部の家具・家電','完了'],['歩行器のゴム摩耗','介護医療・お風呂の道具','完了'],
        ['食洗機のエラー表示','厨房・食事の道具','対応中'],['Wi-Fiが途切れる','通信・呼出し・防火の機器','完了'],
        ['電動ベッドのリモコン故障','部屋・共用部の家具・家電','未対応'],['防犯カメラの映像乱れ','通信・呼出し・防火の機器','完了'],
        ['スチコンの温度上がらない','厨房・食事の道具','対応中'],['消火器の期限切れ確認','建物・外まわり','完了'],
        ['洗濯機の脱水異音','部屋・共用部の家具・家電','完了'],['吸引器の吸引力低下','介護医療・お風呂の道具','未対応'],
        ['AEDバッテリー警告表示','介護医療・お風呂の道具','対応中'],['配膳車のキャスター不具合','厨房・食事の道具','完了'],
        ['複合機の紙詰まり頻発','通信・呼出し・防火の機器','完了'],['分電盤から焦げ臭い','建物・外まわり','対応中'],
        ['パルスオキシメーター電池切れ','介護医療・お風呂の道具','完了'],['製氷機が氷を作らない','厨房・食事の道具','未対応']
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
            timestamp:ts.toISOString(), reporter:s.name, reporterId:s.id,
            status:statusMap[data[i][2]], contractorStatus:data[i][2],
            assignedPartnerId:null, assignedPartnerName:'',
            createdAt:ts.toISOString(), updatedAt:ts.toISOString()
        });
    }
    return reports;
}

// ========== デモマスタデータ初期化 ==========
function initDemoData() {
    if (localStorage.getItem('demo_initialized') === 'v5') return;

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
    allReports.forEach(function(rpt){
        var cts = DEMO_CONTRACTS.filter(function(c){return c.companyCode===rpt.companyCode&&c.status==='active'&&c.categories.indexOf(rpt.category)>=0;});
        if(cts.length>0){var p=DEMO_PARTNERS.find(function(pp){return pp.id===cts[0].partnerId;});rpt.assignedPartnerId=cts[0].partnerId;rpt.assignedPartnerName=p?p.name:'';}
    });
    localStorage.setItem('onetouch.reports', JSON.stringify(allReports));

    localStorage.setItem('demo_initialized', 'v5');
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
