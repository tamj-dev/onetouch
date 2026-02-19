/**
 * unified-header.js
 * ワンタッチ管理システム - 統一ヘッダー共通モジュール
 * 
 * 使い方:
 *   1. <script src="unified-header.js"></script> を読み込む
 *   2. <div id="unified-header-mount"></div> をbody直下に置く
 *   3. JS内で UnifiedHeader.init({ icon: '', title: 'アカウントマスタ', backButton: true }) を呼ぶ
 * 
 * 最終更新: 2026-02-18
 */

const UnifiedHeader = {

    // ========== カラーテーマ（Blue系デザイン 2026-02-14） ==========
    colors: {
        primary: '#2563eb',
        primaryDark: '#1e3a5f',
        primaryLight: '#eff6ff',
        primaryShadow: 'rgba(37, 99, 235, 0.3)',
        text: '#1e293b',
        textLight: '#475569',
        textMuted: '#94a3b8',
        bg: '#f5f7fa',
        bgWhite: '#ffffff',
        border: '#e2e8f0',
        borderLight: '#f1f5f9',
        hoverBg: '#f8fafc',
        // ステータスカラー（機能的な色分け）
        success: '#059669',
        warning: '#d97706',
        danger: '#dc2626',
        info: '#2563eb',
    },

    // ========== 初期化 ==========
    init(options = {}) {
        const {
            icon = '',
            title = 'ページ',
            backButton = true,
            onBack = null,  // カスタム戻る関数
        } = options;

        this._options = options;
        this._injectCSS();
        this._injectCSSVariables();
        this._renderHeader(icon, title, backButton, onBack);
        this._renderDropdown();
        this._renderNotifDropdown();
        this._renderPasswordModal();
        this._renderFirstLoginBanner();
        this._initUserInfo();
        this._initDemoBadge();
        this._initFirstLoginBanner();
        this._initNotifications();
        this._bindEvents();
    },

    // ========== CSS変数をページ全体に適用 ==========
    _injectCSSVariables() {
        const style = document.createElement('style');
        style.id = 'unified-css-variables';
        const c = this.colors;
        style.textContent = `
            :root {
                --primary: ${c.primary};
                --primary-dark: ${c.primaryDark};
                --primary-light: ${c.primaryLight};
                --primary-shadow: ${c.primaryShadow};
                --text: ${c.text};
                --text-light: ${c.textLight};
                --text-muted: ${c.textMuted};
                --bg: ${c.bg};
                --bg-white: ${c.bgWhite};
                --border: ${c.border};
                --border-light: ${c.borderLight};
                --hover-bg: ${c.hoverBg};
                --success: ${c.success};
                --warning: ${c.warning};
                --danger: ${c.danger};
                --info: ${c.info};
            }
        `;
        document.head.appendChild(style);
    },

    // ========== 統一ヘッダーCSS ==========
    _injectCSS() {
        if (document.getElementById('unified-header-css')) return;
        const style = document.createElement('style');
        style.id = 'unified-header-css';
        style.textContent = `
            /* ========== 統一ヘッダー ========== */
            .unified-header {
                background: #1e3a5f;
                padding: 16px 24px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                box-shadow: 0 2px 8px rgba(30, 58, 95, 0.2);
                position: sticky;
                top: 0;
                z-index: 100;
            }
            .uh-left { display: flex; align-items: center; gap: 12px; }
            .uh-right { display: flex; align-items: center; gap: 12px; }

            .uh-back-btn {
                background: none; border: none; color: rgba(255,255,255,0.7); font-size: 14px;
                cursor: pointer; padding: 8px 12px; border-radius: 6px;
                transition: all 0.2s; font-weight: 500;
            }
            .uh-back-btn:hover { background: rgba(255,255,255,0.1); color: white; }

            .uh-icon { font-size: 24px; line-height: 1; }
            .uh-title { font-size: 20px; font-weight: 600; color: white; margin: 0; }

            /* DEMOバー（ヘッダー下に表示） */
            .uh-demo-bar {
                background: #fef3c7;
                color: #92400e;
                padding: 6px 16px;
                font-size: 12px;
                font-weight: 500;
                text-align: center;
                border-bottom: 1px solid #fde68a;
            }

            /* 管理画面に戻るバー */
            .uh-admin-return-bar {
                background: #2563eb;
                color: white;
                padding: 8px 16px;
                font-size: 13px;
                font-weight: 600;
                text-align: center;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
            }
            .uh-admin-return-bar:hover { background: #1d4ed8; }

            /* ユーザーボタン */
            .uh-user-btn {
                display: flex; align-items: center; gap: 8px; cursor: pointer;
                padding: 8px 12px; border-radius: 6px; transition: all 0.2s;
                background: none; border: none; font-family: inherit;
            }
            .uh-user-btn:hover { background: rgba(255,255,255,0.1); }
            .uh-avatar {
                width: 32px; height: 32px; border-radius: 50%;
                background: rgba(255,255,255,0.2); color: white;
                display: flex; align-items: center; justify-content: center;
                font-size: 14px; font-weight: 600; flex-shrink: 0;
            }
            .uh-user-name { font-size: 14px; color: rgba(255,255,255,0.9); font-weight: 500; }

            /* 通知ベルボタン */
            .uh-bell-btn {
                position: relative; background: none; border: none; cursor: pointer;
                padding: 8px; border-radius: 6px; transition: all 0.2s;
                display: flex; align-items: center; justify-content: center;
            }
            .uh-bell-btn:hover { background: rgba(255,255,255,0.1); }
            .uh-bell-btn svg { width: 20px; height: 20px; stroke: rgba(255,255,255,0.8); }
            .uh-bell-badge {
                position: absolute; top: 2px; right: 2px;
                background: #dc2626; color: #fff; font-size: 10px; font-weight: 700;
                min-width: 16px; height: 16px; border-radius: 8px;
                display: none; align-items: center; justify-content: center;
                padding: 0 4px; line-height: 1;
            }
            .uh-bell-badge.show { display: flex; }

            /* 通知ドロップダウン */
            .uh-notif-dropdown {
                position: absolute; top: 60px; right: 60px; background: white;
                border: 1px solid #e0e0e0; border-radius: 12px;
                box-shadow: 0 8px 24px rgba(0,0,0,0.12); width: 320px;
                max-height: 400px; overflow-y: auto;
                display: none; z-index: 1001;
            }
            .uh-notif-dropdown.show { display: block; }
            .uh-notif-header {
                padding: 14px 16px; border-bottom: 1px solid #eee;
                display: flex; justify-content: space-between; align-items: center;
                position: sticky; top: 0; background: #fff; z-index: 1;
                border-radius: 12px 12px 0 0;
            }
            .uh-notif-header-title { font-size: 14px; font-weight: 700; color: #1e293b; }
            .uh-notif-clear { font-size: 12px; color: #888; cursor: pointer; background: none; border: none; }
            .uh-notif-clear:hover { color: #333; }
            .uh-notif-item {
                padding: 12px 16px; border-bottom: 1px solid #f5f5f5;
                cursor: pointer; transition: background 0.15s;
            }
            .uh-notif-item:hover { background: #fafafa; }
            .uh-notif-item.unread { background: #f8f9ff; }
            .uh-notif-item:last-child { border-bottom: none; }
            .uh-notif-msg { font-size: 13px; color: #1e293b; line-height: 1.5; margin-bottom: 4px; }
            .uh-notif-time { font-size: 11px; color: #aaa; }
            .uh-notif-empty { text-align: center; padding: 32px 16px; color: #aaa; font-size: 13px; }

            /* ドロップダウンメニュー */
            .uh-dropdown {
                position: absolute; top: 60px; right: 24px; background: white;
                border: 1px solid #e0e0e0; border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15); min-width: 220px;
                display: none; z-index: 1000;
            }
            .uh-dropdown.show { display: block; }
            .uh-menu-item {
                display: flex; align-items: center; gap: 12px; padding: 12px 16px;
                color: #333; text-decoration: none; transition: all 0.2s; cursor: pointer;
            }
            .uh-menu-item:hover { background: #f5f5f5; }
            .uh-menu-item:first-child { border-radius: 8px 8px 0 0; }
            .uh-menu-item:last-child { border-radius: 0 0 8px 8px; }
            .uh-menu-item.uh-user-detail { cursor: default; background: #fafafa; }
            .uh-menu-item.uh-user-detail:hover { background: #fafafa; }
            .uh-menu-icon { font-size: 18px; width: 24px; text-align: center; }
            .uh-menu-text { flex: 1; }
            .uh-menu-name { font-weight: 600; font-size: 14px; color: #333; }
            .uh-menu-sub { font-size: 12px; color: #666; margin-top: 2px; }
            .uh-divider { height: 1px; background: #e0e0e0; margin: 4px 0; }
            .uh-menu-item.uh-logout { color: #dc2626; }
            .uh-menu-item.uh-logout:hover { background: #ffebee; }
            .uh-menu-item.uh-demo-active { background: #f0f7ff; font-weight: 700; color: #2563eb; }

            /* パスワード変更モーダル */
            .uh-pw-overlay {
                display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.5); z-index: 10000; align-items: center; justify-content: center;
            }
            .uh-pw-overlay.show { display: flex; }
            .uh-pw-modal {
                background: white; border-radius: 12px; padding: 24px;
                width: 90%; max-width: 400px; box-shadow: 0 8px 24px rgba(0,0,0,0.2);
            }
            .uh-pw-modal h2 { margin: 0 0 20px 0; font-size: 20px; color: #333; }
            .uh-pw-group { margin-bottom: 16px; }
            .uh-pw-group:last-of-type { margin-bottom: 24px; }
            .uh-pw-label { display: block; font-size: 14px; color: #666; margin-bottom: 6px; }
            .uh-pw-input {
                width: 100%; padding: 10px; border: 1px solid #e0e0e0;
                border-radius: 6px; font-size: 14px; box-sizing: border-box;
            }
            .uh-pw-input:focus { outline: none; border-color: var(--primary, #2563eb); box-shadow: 0 0 0 3px rgba(229,57,53,0.1); }
            .uh-pw-hint { font-size: 12px; color: #666; margin-top: 4px; }
            .uh-pw-actions { display: flex; gap: 12px; justify-content: flex-end; }
            .uh-pw-cancel {
                padding: 10px 20px; background: #f5f5f5; border: none;
                border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600; color: #666;
            }
            .uh-pw-cancel:hover { background: #e0e0e0; }
            .uh-pw-submit {
                padding: 10px 20px; background: var(--primary, #2563eb); border: none;
                border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600; color: white;
            }
            .uh-pw-submit:hover { background: var(--primary-dark, #1d4ed8); }

            /* 初回ログインバナー */
            .uh-first-login {
                display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.5); z-index: 10000;
                justify-content: center; align-items: center;
            }
            .uh-first-login.show { display: flex; }
            .uh-fl-card {
                background: white; border-radius: 16px; padding: 36px 32px 28px;
                max-width: 400px; width: 90%; text-align: center;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            }
            .uh-fl-icon { font-size: 48px; margin-bottom: 16px; }
            .uh-fl-title { font-size: 18px; font-weight: 700; color: #1e3a5f; margin-bottom: 8px; }
            .uh-fl-desc { font-size: 14px; color: #666; line-height: 1.6; margin-bottom: 24px; }
            .uh-fl-actions { display: flex; flex-direction: column; gap: 10px; }
            .uh-fl-btn-now {
                background: #1e3a5f; color: white; border: none; padding: 14px; border-radius: 10px;
                font-size: 15px; font-weight: 600; cursor: pointer;
            }
            .uh-fl-btn-now:hover { background: #2a4a73; }
            .uh-fl-btn-later {
                background: none; border: 1px solid #ddd; color: #888; padding: 12px; border-radius: 10px;
                font-size: 14px; cursor: pointer;
            }
            .uh-fl-btn-later:hover { background: #f5f5f5; }

            /* ========== レスポンシブ ========== */
            @media (max-width: 768px) {
                .unified-header { padding: 12px 16px; }
                .uh-title { font-size: 16px; }
                .uh-user-name { display: none; }
                .uh-icon { font-size: 20px; }
                .uh-dropdown { right: 16px; }
            }
        `;
        document.head.appendChild(style);
    },

    // ========== ヘッダーHTML描画 ==========
    _renderHeader(icon, title, backButton, onBack) {
        const mount = document.getElementById('unified-header-mount');
        if (!mount) {
            console.error('[UnifiedHeader] #unified-header-mount が見つかりません');
            return;
        }

        const backHtml = backButton
            ? `<button class="uh-back-btn" id="uhBackBtn">← 戻る</button>`
            : '';

        mount.innerHTML = `
            <div class="unified-header">
                <div class="uh-left">
                    ${backHtml}
                    <h1 class="uh-title">${title}</h1>
                </div>
                <div class="uh-right">
                    <button class="uh-bell-btn" id="uhBellBtn" title="通知">
                        <svg viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
                        <span class="uh-bell-badge" id="uhBellBadge">0</span>
                    </button>
                    <button class="uh-user-btn" id="uhUserBtn">
                        <div class="uh-avatar" id="uhAvatar">-</div>
                        <span class="uh-user-name" id="uhUserName">ユーザー</span>
                    </button>
                </div>
            </div>
            <div class="uh-demo-bar" id="uhDemoBadge" style="display: none;">
                DEMOモード ー テスト用のダミーデータで動作しています。ブラウザを閉じるとデータは消えます。
            </div>
            <div class="uh-admin-return-bar" id="uhAdminReturn" style="display: none;" onclick="UnifiedHeader._returnToAdmin()">
                ← 管理画面に戻る（動作確認中）
            </div>
        `;

        // 戻るボタンのイベント
        const backBtn = document.getElementById('uhBackBtn');
        if (backBtn) {
            backBtn.addEventListener('click', onBack || this._defaultGoBack);
        }
    },

    // ========== ドロップダウン描画 ==========
    _renderDropdown() {
        const mount = document.getElementById('unified-header-mount');
        if (!mount) return;

        const user = this._getUser();
        const isContractor = user && user.role === 'contractor';

        const dropdown = document.createElement('div');
        dropdown.className = 'uh-dropdown';
        dropdown.id = 'uhDropdown';
        
        var contractorMenu = '';
        if (isContractor) {
            contractorMenu = `
            <div class="uh-divider"></div>
            <a href="contractor-dashboard.html" class="uh-menu-item">
                <div class="uh-menu-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></div>
                <span class="uh-menu-text">対応依頼</span>
            </a>
            <a href="contractor-performance.html" class="uh-menu-item">
                <div class="uh-menu-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg></div>
                <span class="uh-menu-text">対応実績</span>
            </a>
            <a href="items.html" class="uh-menu-item">
                <div class="uh-menu-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg></div>
                <span class="uh-menu-text">商品マスタ</span>
            </a>
            <a href="import.html" class="uh-menu-item">
                <div class="uh-menu-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></div>
                <span class="uh-menu-text">商品インポート</span>
            </a>
            <a href="contractor-help.html" class="uh-menu-item">
                <div class="uh-menu-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
                <span class="uh-menu-text">ヘルプ</span>
            </a>
            `;
        }

        // DEMOモード切替メニュー
        var demoSwitchMenu = '';
        const isDemoMode = user && (user.isDemoMode || user.companyCode === 'TAMJ' || user.companyCode === 'JMAT' || user.companyCode === 'SYSTEM' || user.companyCode === 'PN001');
        if (isDemoMode) {
            const currentRole = user.role;
            const roles = [
                { key: 'staff', label: 'スタッフで表示', color: '#4CAF50', active: currentRole === 'staff' },
                { key: 'contractor', label: '管理会社で表示', color: '#2196F3', active: currentRole === 'contractor' },
                { key: 'office_admin', label: '事業所管理者で表示', color: '#FF9800', active: currentRole === 'office_admin' },
                { key: 'company_admin', label: '本社管理者で表示', color: '#9C27B0', active: currentRole === 'company_admin' }
            ];
            const roleItems = roles.map(r => `
                <a href="#" class="uh-menu-item${r.active ? ' uh-demo-active' : ''}" onclick="UnifiedHeader._demoSwitch('${r.key}'); return false;">
                    <div class="uh-menu-icon"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${r.color};"></span></div>
                    <span class="uh-menu-text">${r.label}</span>
                    ${r.active ? '<span style="margin-left:auto;color:#2563eb;font-size:14px;">✓</span>' : ''}
                </a>
            `).join('');
            demoSwitchMenu = `
                <div class="uh-divider"></div>
                <div style="padding:4px 16px 4px;font-size:10px;font-weight:700;color:#999;letter-spacing:1px;">DEMO切替</div>
                ${roleItems}
            `;
        }

        dropdown.innerHTML = `
            <div class="uh-menu-item uh-user-detail">
                <div class="uh-menu-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>
                <div class="uh-menu-text">
                    <div class="uh-menu-name" id="uhMenuName">ユーザー</div>
                    <div class="uh-menu-sub" id="uhMenuSub">-</div>
                    <div class="uh-menu-sub" id="uhMenuCompany" style="margin-top:2px;">-</div>
                </div>
            </div>
            ${contractorMenu}
            ${demoSwitchMenu}
            <div class="uh-divider"></div>
            <a href="#" class="uh-menu-item" id="uhMenuPassword">
                <div class="uh-menu-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg></div>
                <span class="uh-menu-text">パスワード変更</span>
            </a>
            <div class="uh-divider"></div>
            <a href="#" class="uh-menu-item uh-logout" id="uhMenuLogout">
                <div class="uh-menu-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/></svg></div>
                <span class="uh-menu-text">ログアウト</span>
            </a>
        `;
        mount.appendChild(dropdown);
    },

    // ========== 通知ドロップダウン描画 ==========
    _renderNotifDropdown() {
        const mount = document.getElementById('unified-header-mount');
        if (!mount) return;

        const notifDrop = document.createElement('div');
        notifDrop.className = 'uh-notif-dropdown';
        notifDrop.id = 'uhNotifDropdown';
        notifDrop.innerHTML = `
            <div class="uh-notif-header">
                <span class="uh-notif-header-title">通知</span>
                <button class="uh-notif-clear" id="uhNotifClear">すべて既読</button>
            </div>
            <div id="uhNotifList">
                <div class="uh-notif-empty">通知はありません</div>
            </div>
        `;
        mount.appendChild(notifDrop);
    },

    // ========== パスワード変更モーダル描画 ==========
    _renderPasswordModal() {
        if (document.getElementById('uhPwOverlay')) return;
        const overlay = document.createElement('div');
        overlay.className = 'uh-pw-overlay';
        overlay.id = 'uhPwOverlay';
        overlay.innerHTML = `
            <div class="uh-pw-modal">
                <h2>パスワード変更</h2>
                <div class="uh-pw-group">
                    <label class="uh-pw-label">現在のパスワード</label>
                    <div style="position:relative;">
                        <input type="password" class="uh-pw-input" id="uhPwCurrent" style="padding-right:40px;">
                        <button type="button" onclick="UnifiedHeader._togglePwVis('uhPwCurrent')" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:#888;font-size:13px;padding:4px;">表示</button>
                    </div>
                </div>
                <div class="uh-pw-group">
                    <label class="uh-pw-label">新しいパスワード</label>
                    <div style="position:relative;">
                        <input type="password" class="uh-pw-input" id="uhPwNew" style="padding-right:40px;">
                        <button type="button" onclick="UnifiedHeader._togglePwVis('uhPwNew')" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:#888;font-size:13px;padding:4px;">表示</button>
                    </div>
                    <div class="uh-pw-hint">※ 6文字以上で入力してください</div>
                </div>
                <div class="uh-pw-group">
                    <label class="uh-pw-label">新しいパスワード（確認）</label>
                    <div style="position:relative;">
                        <input type="password" class="uh-pw-input" id="uhPwConfirm" style="padding-right:40px;">
                        <button type="button" onclick="UnifiedHeader._togglePwVis('uhPwConfirm')" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:#888;font-size:13px;padding:4px;">表示</button>
                    </div>
                </div>
                <div class="uh-pw-actions">
                    <button class="uh-pw-cancel" id="uhPwCancel">キャンセル</button>
                    <button class="uh-pw-submit" id="uhPwSubmit">変更する</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
    },

    // ========== 初回ログインバナー描画 ==========
    _renderFirstLoginBanner() {
        if (document.getElementById('uhFirstLogin')) return;
        const banner = document.createElement('div');
        banner.className = 'uh-first-login';
        banner.id = 'uhFirstLogin';
        banner.innerHTML = `
            <div class="uh-fl-card">
                <div class="uh-fl-icon">🔐</div>
                <div class="uh-fl-title">パスワードを変更してください</div>
                <div class="uh-fl-desc">セキュリティ向上のため、<br>初期パスワードの変更をお願いします。</div>
                <div class="uh-fl-actions">
                    <button class="uh-fl-btn-now" id="uhFlNow">パスワードを変更する</button>
                    <button class="uh-fl-btn-later" id="uhFlLater">あとで変更する</button>
                </div>
            </div>
        `;
        document.body.appendChild(banner);
    },

    // ========== ユーザー情報初期化 ==========
    _initUserInfo() {
        const user = this._getUser();
        if (!user) return;

        const name = user.userName || user.name || user.userId || 'ユーザー';
        const detail = user.officeName || user.companyName || '-';

        const avatar = document.getElementById('uhAvatar');
        const userName = document.getElementById('uhUserName');
        const menuName = document.getElementById('uhMenuName');
        const menuSub = document.getElementById('uhMenuSub');

        if (avatar) {
            // 会社ロゴがあればアバターに表示、なければアプリアイコン
            const logoUrl = this._getCompanyLogo(user);
            if (logoUrl) {
                avatar.style.background = 'white';
                avatar.style.boxShadow = '0 0 0 1px #e0e0e0';
                avatar.style.padding = '3px';
                avatar.innerHTML = '<img src="' + logoUrl + '" style="width:100%;height:100%;object-fit:contain;border-radius:50%;" alt="">';
            } else {
                avatar.style.background = 'white';
                avatar.style.boxShadow = '0 0 0 1px #e0e0e0';
                avatar.style.padding = '2px';
                avatar.innerHTML = '<img src="icon-192.png" style="width:100%;height:100%;object-fit:contain;border-radius:50%;" alt="">';
            }
        }
        if (userName) userName.textContent = name;
        if (menuName) menuName.textContent = name;
        if (menuSub) menuSub.textContent = detail;

        const menuCompany = document.getElementById('uhMenuCompany');
        if (menuCompany) {
            const companyName = user.companyName || '';
            const companyCode = user.companyCode || '';
            let companyLines = [];
            if (companyCode) companyLines.push('会社コード：' + companyCode);
            if (companyName) companyLines.push('会社名：' + companyName);
            if (companyLines.length > 0) {
                menuCompany.innerHTML = companyLines.join('<br>');
            } else {
                menuCompany.style.display = 'none';
            }
        }
    },

    // ========== DEMOバッジ初期化 ==========
    _initDemoBadge() {
        const user = this._getUser();
        let isDemo = user && user.companyCode === 'TAMJ';
        // 業者の場合: currentContractorのassignedCompaniesにTAMJが含まれるか確認
        if (!isDemo && user && user.role === 'contractor') {
            try {
                const contractor = JSON.parse(sessionStorage.getItem('currentContractor'));
                if (contractor && contractor.assignedCompanies && contractor.assignedCompanies.includes('TAMJ')) {
                    isDemo = true;
                }
            } catch (e) {}
        }
        if (isDemo) {
            const badge = document.getElementById('uhDemoBadge');
            if (badge) badge.style.display = 'block';
        }
        // 管理画面からの動作確認モード
        try {
            var u = this._getUser();
            if (u && u._fromAdmin && sessionStorage.getItem('_savedAdminSession')) {
                var returnBar = document.getElementById('uhAdminReturn');
                if (returnBar) returnBar.style.display = 'flex';
            }
        } catch(e) {}
    },

    // ========== 初回ログインバナー初期化 ==========
    _initFirstLoginBanner() {
        const user = this._getUser();
        if (user && user.isFirstLogin && !sessionStorage.getItem('firstLoginBannerDismissed')) {
            const banner = document.getElementById('uhFirstLogin');
            if (banner) banner.classList.add('show');
        }
    },

    // ========== イベントバインド ==========
    // ========== 通知システム ==========
    _initNotifications() {
        this._updateNotifBadge();
        this._renderNotifList();
        this._showNewNotifToast();
    },

    // 通知データ取得
    _getNotifications() {
        try {
            return JSON.parse(localStorage.getItem('ONE_notifications') || '[]');
        } catch(e) { return []; }
    },

    // 通知データ保存
    _saveNotifications(notifs) {
        localStorage.setItem('ONE_notifications', JSON.stringify(notifs));
    },

    // 未読件数でバッジ更新
    _updateNotifBadge() {
        const user = this._getUser();
        if (!user) return;
        const userId = user.userId || '';
        const role = user.role || '';
        const notifs = this._getNotifications();
        // 自分宛ての未読通知をカウント
        const unread = notifs.filter(function(n) {
            return !n.read && (n.toUserId === userId || n.toRole === role);
        }).length;
        const badge = document.getElementById('uhBellBadge');
        if (badge) {
            badge.textContent = unread > 99 ? '99+' : unread;
            badge.classList.toggle('show', unread > 0);
        }
    },

    // 通知リスト描画
    _renderNotifList() {
        const user = this._getUser();
        if (!user) return;
        const userId = user.userId || '';
        const role = user.role || '';
        const notifs = this._getNotifications()
            .filter(function(n) { return n.toUserId === userId || n.toRole === role; })
            .sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); })
            .slice(0, 20);

        const list = document.getElementById('uhNotifList');
        if (!list) return;

        if (notifs.length === 0) {
            list.innerHTML = '<div class="uh-notif-empty">通知はありません</div>';
            return;
        }

        const self = this;
        list.innerHTML = notifs.map(function(n) {
            const date = new Date(n.createdAt);
            const timeStr = self._formatTimeAgo(date);
            var unreadClass = n.read ? '' : ' unread';
            return '<div class="uh-notif-item' + unreadClass + '" data-notif-id="' + n.id + '" data-report-id="' + (n.reportId || '') + '">'
                + '<div class="uh-notif-msg">' + self._escHtml(n.message) + '</div>'
                + '<div class="uh-notif-time">' + timeStr + '</div>'
                + '</div>';
        }).join('');
    },

    // 経過時間フォーマット
    _formatTimeAgo(date) {
        const now = new Date();
        const diff = Math.floor((now - date) / 1000);
        if (diff < 60) return 'たった今';
        if (diff < 3600) return Math.floor(diff / 60) + '分前';
        if (diff < 86400) return Math.floor(diff / 3600) + '時間前';
        if (diff < 604800) return Math.floor(diff / 86400) + '日前';
        return date.toLocaleDateString('ja-JP');
    },

    // HTMLエスケープ
    _escHtml(str) {
        var div = document.createElement('div');
        div.textContent = str || '';
        return div.innerHTML;
    },

    // 新着通知のトースト表示（画面を開いた時）
    _showNewNotifToast() {
        const user = this._getUser();
        if (!user) return;
        const userId = user.userId || '';
        const role = user.role || '';
        const notifs = this._getNotifications();
        const lastSeen = localStorage.getItem('ONE_notif_lastSeen_' + userId) || '1970-01-01';
        const newNotifs = notifs.filter(function(n) {
            return !n.read && (n.toUserId === userId || n.toRole === role)
                && n.createdAt > lastSeen;
        });

        if (newNotifs.length > 0) {
            // 最新の通知をトースト表示
            var latest = newNotifs[0];
            this._showToast(latest.message, 4000);
            // lastSeenを更新
            localStorage.setItem('ONE_notif_lastSeen_' + userId, new Date().toISOString());
        }
    },

    // トースト表示
    _showToast(msg, duration) {
        var existing = document.getElementById('uhNotifToast');
        if (existing) existing.remove();
        var toast = document.createElement('div');
        toast.id = 'uhNotifToast';
        toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(80px);background:#1e3a5f;color:#fff;padding:12px 24px;border-radius:12px;font-size:14px;font-weight:500;box-shadow:0 4px 20px rgba(0,0,0,.2);opacity:0;transition:all .4s;z-index:9999;pointer-events:none;max-width:90%;text-align:center;';
        toast.textContent = msg;
        document.body.appendChild(toast);
        setTimeout(function() { toast.style.transform='translateX(-50%) translateY(0)'; toast.style.opacity='1'; }, 50);
        setTimeout(function() { toast.style.transform='translateX(-50%) translateY(80px)'; toast.style.opacity='0'; }, duration || 3000);
        setTimeout(function() { toast.remove(); }, (duration || 3000) + 500);
    },

    // すべて既読
    _markAllRead() {
        const user = this._getUser();
        if (!user) return;
        const userId = user.userId || '';
        const role = user.role || '';
        var notifs = this._getNotifications();
        notifs.forEach(function(n) {
            if (n.toUserId === userId || n.toRole === role) n.read = true;
        });
        this._saveNotifications(notifs);
        this._updateNotifBadge();
        this._renderNotifList();
    },

    // 通知クリック → 既読にして遷移
    _handleNotifClick(notifId, reportId) {
        var notifs = this._getNotifications();
        notifs.forEach(function(n) { if (n.id === notifId) n.read = true; });
        this._saveNotifications(notifs);
        this._updateNotifBadge();
        this._renderNotifList();
        // report画面へ遷移（通報IDパラメータ付き）
        if (reportId) {
            var currentPage = window.location.pathname.split('/').pop();
            if (currentPage === 'contractor-dashboard.html') {
                // 業者はそのまま（ダッシュボードで詳細を開く）
            } else {
                // スタッフ・管理者はreport.htmlへ
            }
        }
    },

    _bindEvents() {
        const self = this;

        // ベルボタン → 通知ドロップダウン
        const bellBtn = document.getElementById('uhBellBtn');
        if (bellBtn) {
            bellBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                var notifDrop = document.getElementById('uhNotifDropdown');
                var userDrop = document.getElementById('uhDropdown');
                if (userDrop) userDrop.classList.remove('show');
                if (notifDrop) notifDrop.classList.toggle('show');
            });
        }

        // すべて既読ボタン
        const clearBtn = document.getElementById('uhNotifClear');
        if (clearBtn) {
            clearBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                self._markAllRead();
            });
        }

        // 通知アイテムクリック
        const notifList = document.getElementById('uhNotifList');
        if (notifList) {
            notifList.addEventListener('click', function(e) {
                var item = e.target.closest('.uh-notif-item');
                if (item) {
                    var notifId = item.getAttribute('data-notif-id');
                    var reportId = item.getAttribute('data-report-id');
                    self._handleNotifClick(notifId, reportId);
                }
            });
        }

        // ユーザーボタン → ドロップダウン
        const userBtn = document.getElementById('uhUserBtn');
        if (userBtn) {
            userBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                var notifDrop = document.getElementById('uhNotifDropdown');
                if (notifDrop) notifDrop.classList.remove('show');
                document.getElementById('uhDropdown').classList.toggle('show');
            });
        }

        // メニュー外クリックで閉じる
        document.addEventListener('click', function(e) {
            const dropdown = document.getElementById('uhDropdown');
            const btn = document.getElementById('uhUserBtn');
            if (dropdown && btn && !dropdown.contains(e.target) && !btn.contains(e.target)) {
                dropdown.classList.remove('show');
            }
            const notifDrop = document.getElementById('uhNotifDropdown');
            const bellB = document.getElementById('uhBellBtn');
            if (notifDrop && bellB && !notifDrop.contains(e.target) && !bellB.contains(e.target)) {
                notifDrop.classList.remove('show');
            }
        });

        // パスワード変更
        const pwBtn = document.getElementById('uhMenuPassword');
        if (pwBtn) {
            pwBtn.addEventListener('click', function(e) {
                e.preventDefault();
                self.openPasswordModal();
            });
        }

        // ログアウト
        const logoutBtn = document.getElementById('uhMenuLogout');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', function(e) {
                e.preventDefault();
                self.logout();
            });
        }

        // パスワードモーダルのボタン
        const pwCancel = document.getElementById('uhPwCancel');
        const pwSubmit = document.getElementById('uhPwSubmit');
        if (pwCancel) pwCancel.addEventListener('click', function() { self.closePasswordModal(); });
        if (pwSubmit) pwSubmit.addEventListener('click', function() { self._changePassword(); });

        // 初回ログインバナー
        const flLater = document.getElementById('uhFlLater');
        const flNow = document.getElementById('uhFlNow');
        if (flLater) flLater.addEventListener('click', function() { self._dismissBanner(); });
        if (flNow) flNow.addEventListener('click', function() {
            self._dismissBanner();
            self.openPasswordModal();
        });
    },

    // ========== 公開メソッド ==========

    openPasswordModal() {
        const overlay = document.getElementById('uhPwOverlay');
        if (overlay) overlay.classList.add('show');
        const dropdown = document.getElementById('uhDropdown');
        if (dropdown) dropdown.classList.remove('show');
    },

    closePasswordModal() {
        const overlay = document.getElementById('uhPwOverlay');
        if (overlay) overlay.classList.remove('show');
        ['uhPwCurrent', 'uhPwNew', 'uhPwConfirm'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
    },

    logout() {
        if (confirm('ログアウトしますか？')) {
            this._logAudit('logout', {});
            // DEMOユーザーの場合、localStorageをスナップショットから復元（変更をリセット）
            try {
                var cu = JSON.parse(sessionStorage.getItem('currentUser'));
                if (cu && cu.isDemoMode && cu.role !== 'system_admin' && typeof restoreDemoSnapshot === 'function') {
                    restoreDemoSnapshot();
                }
            } catch(e) {}
            sessionStorage.clear();
            // localStorageのログイン情報もクリア
            localStorage.removeItem('currentUser');
            localStorage.removeItem('currentAccount');
            localStorage.removeItem('ONE_loggedIn');
            localStorage.removeItem('ONE_userId');
            localStorage.removeItem('ONE_userName');
            // 確実にリダイレクト
            window.location.replace('login.html');
        }
    },

    // ========== 管理画面に戻る ==========
    _returnToAdmin() {
        var saved = sessionStorage.getItem('_savedAdminSession');
        if (saved) {
            sessionStorage.setItem('currentUser', saved);
            sessionStorage.removeItem('_savedAdminSession');
            sessionStorage.removeItem('currentContractor');
            window.location.href = 'master-top.html';
        }
    },

    // ========== DEMO切替 ==========
    _demoSwitch(roleOrId) {
        // ドロップダウンを閉じる
        var dd = document.getElementById('uhDropdown');
        if (dd) dd.classList.remove('show');

        // IDで直接検索、なければロール名でマッピング
        var user = window.DEMO_ACCOUNTS && window.DEMO_ACCOUNTS[roleOrId];
        if (!user && window.DEMO_ACCOUNTS) {
            var roleMap = {
                'staff': 'tamj-j1-staff1',
                'office_admin': 'tamj-j1-admin',
                'company_admin': 'TAMJ-H001',
                'system_admin': 'admin',
                'contractor': 'pn001-yamada'
            };
            var mappedId = roleMap[roleOrId];
            if (mappedId) user = window.DEMO_ACCOUNTS[mappedId];
        }
        if (!user) return;

        // セッション切替
        sessionStorage.removeItem('currentUser');
        sessionStorage.removeItem('currentContractor');

        // 新しいユーザー情報をセット
        const userInfo = {
            companyCode: user.companyCode, companyName: user.companyName,
            id: user.id, userId: user.id, password: user.password,
            name: user.name, userName: user.name, role: user.role,
            scope: user.scope || '', officeCode: user.officeCode || '',
            officeName: user.officeName || '', isFirstLogin: false, isDemoMode: true
        };
        sessionStorage.setItem('currentUser', JSON.stringify(userInfo));
        localStorage.setItem('currentAccount', JSON.stringify(userInfo));
        localStorage.setItem('ONE_loggedIn', '1');
        localStorage.setItem('ONE_userId', user.id);
        localStorage.setItem('ONE_userName', user.name);

        // 業者の場合はcontractor情報も保存
        if (user.role === 'contractor') {
            sessionStorage.setItem('currentContractor', JSON.stringify({
                id: user.partnerId, partnerId: user.partnerId,
                partnerCode: user.partnerCode, companyName: user.companyName,
                name: user.name, loginId: user.id, contactName: user.name,
                categories: user.categories, assignedCompanies: user.assignedCompanies,
                role: 'contractor'
            }));
            window.location.href = 'contractor-dashboard.html';
        } else if (user.role === 'office_admin') {
            window.location.href = 'master-top.html';
        } else if (user.role === 'company_admin') {
            window.location.href = 'master-top.html';
        } else {
            window.location.href = 'report.html';
        }
    },

    // ========== 内部メソッド ==========

    _getUser() {
        try {
            return JSON.parse(sessionStorage.getItem('currentUser'));
        } catch (e) {
            return null;
        }
    },

    _getCompanyLogo(user) {
        if (!user) return null;
        try {
            // DEMOモード: sessionStorageから取得
            if (user.companyCode === 'TAMJ') {
                return sessionStorage.getItem('demo.companyLogo') || null;
            }
            // 本番: localStorageの会社データから取得
            const companies = JSON.parse(localStorage.getItem('companies') || '[]');
            const company = companies.find(c => c.code === user.companyCode);
            return company && company.logoUrl ? company.logoUrl : null;
        } catch (e) {
            return null;
        }
    },

    _defaultGoBack() {
        try {
            const user = JSON.parse(sessionStorage.getItem('currentUser'));
            if (!user || !user.role) { window.location.href = 'login.html'; return; }
            const homePages = {
                'system_admin': 'system-admin.html',
                'company_admin': 'master-top.html',
                'office_admin': 'master-top.html',
                'staff': 'report.html',
                'contractor': 'contractor-dashboard.html'
            };
            window.location.href = homePages[user.role] || 'master-top.html';
        } catch (e) {
            window.location.href = 'master-top.html';
        }
    },

    _dismissBanner() {
        const banner = document.getElementById('uhFirstLogin');
        if (banner) banner.classList.remove('show');
        sessionStorage.setItem('firstLoginBannerDismissed', 'true');
    },

    _logAudit(type, detail) {
        try {
            const user = this._getUser();
            const storageKey = 'audit.logs';
            let logs = [];
            try { logs = JSON.parse(sessionStorage.getItem(storageKey) || '[]'); } catch(e) {}
            let logsLocal = [];
            try { logsLocal = JSON.parse(localStorage.getItem(storageKey) || '[]'); } catch(e) {}
            logsLocal.forEach(r => { if (!logs.find(m => m.timestamp === r.timestamp && m.userId === r.userId)) logs.push(r); });
            logs.push({
                timestamp: new Date().toISOString(),
                type: type,
                screen: 'unified-header',
                user: user?.name || '',
                userId: user?.id || user?.userId || '',
                companyCode: user?.companyCode || '',
                details: typeof detail === 'string' ? detail : JSON.stringify(detail)
            });
            sessionStorage.setItem(storageKey, JSON.stringify(logs));
            localStorage.setItem(storageKey, JSON.stringify(logs));
        } catch(e) { console.error('監査ログエラー:', e); }
    },

    _togglePwVis(fieldId) {
        const field = document.getElementById(fieldId);
        if (!field) return;
        const btn = field.parentElement.querySelector('button');
        if (field.type === 'password') {
            field.type = 'text';
            if (btn) btn.textContent = '隠す';
        } else {
            field.type = 'password';
            if (btn) btn.textContent = '表示';
        }
    },

    _changePassword() {
        const user = this._getUser();
        if (!user) { alert('ユーザー情報が見つかりません。'); return; }

        const current = document.getElementById('uhPwCurrent').value;
        const newPw = document.getElementById('uhPwNew').value;
        const confirm = document.getElementById('uhPwConfirm').value;

        if (!current || !newPw || !confirm) { alert('すべての項目を入力してください。'); return; }
        if (newPw !== confirm) { alert('新しいパスワードが一致しません。'); return; }
        if (newPw.length < 6) { alert('パスワードは6文字以上で設定してください。'); return; }
        if (user.password !== current) { alert('現在のパスワードが正しくありません。'); return; }

        try {
            const isDemoMode = user.companyCode === 'TAMJ' || !!user.isDemoMode;
            if (isDemoMode) {
                user.password = newPw;
                user.isFirstLogin = false;
                sessionStorage.setItem('currentUser', JSON.stringify(user));
                // 業者の場合はcurrentContractorも更新
                if (user.role === 'contractor') {
                    try {
                        const contractor = JSON.parse(sessionStorage.getItem('currentContractor'));
                        if (contractor) {
                            contractor.password = newPw;
                            sessionStorage.setItem('currentContractor', JSON.stringify(contractor));
                        }
                    } catch(e) {}
                }
                alert('パスワードを変更しました。\n※ DEMOモードのため、ログアウト後は元に戻ります。');
                this._logAudit('password_change', { userId: user.id || user.userId });
            } else {
                // 業者の場合はpartnersから検索
                let updated = false;
                if (user.role === 'contractor') {
                    let partners = JSON.parse(localStorage.getItem('partners') || '[]');
                    const pidx = partners.findIndex(p => p.loginId === (user.id || user.userId));
                    if (pidx !== -1) {
                        partners[pidx].password = newPw;
                        localStorage.setItem('partners', JSON.stringify(partners));
                        updated = true;
                    }
                } else {
                    let accounts = JSON.parse(localStorage.getItem('accounts') || '[]');
                    const idx = accounts.findIndex(a => (a.userId || a.id) === (user.userId || user.id));
                    if (idx !== -1) {
                        accounts[idx].password = newPw;
                        accounts[idx].isFirstLogin = false;
                        accounts[idx].passwordChangedAt = new Date().toISOString();
                        localStorage.setItem('accounts', JSON.stringify(accounts));
                        updated = true;
                    }
                }
                if (updated) {
                    user.password = newPw;
                    user.isFirstLogin = false;
                    sessionStorage.setItem('currentUser', JSON.stringify(user));
                    alert('パスワードを変更しました。');
                    this._logAudit('password_change', { userId: user.id || user.userId });
                } else {
                    alert('アカウント情報の更新に失敗しました。');
                    return;
                }
            }
            this.closePasswordModal();
        } catch (e) {
            console.error('パスワード変更エラー:', e);
            alert('パスワード変更に失敗しました。');
        }
    }
};

// ========== 通知送信グローバル関数 ==========
// 他の画面から呼び出して通知を作成する
function sendNotification(options) {
    // options: { toUserId, toRole, message, reportId, type }
    var notifs = [];
    try { notifs = JSON.parse(localStorage.getItem('ONE_notifications') || '[]'); } catch(e) {}
    var notif = {
        id: 'NOTIF-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
        toUserId: options.toUserId || '',
        toRole: options.toRole || '',
        message: options.message || '',
        reportId: options.reportId || '',
        type: options.type || 'info',
        createdAt: new Date().toISOString(),
        read: false
    };
    notifs.push(notif);
    localStorage.setItem('ONE_notifications', JSON.stringify(notifs));
    // バッジ更新（同一画面にいる場合）
    if (typeof UnifiedHeader !== 'undefined' && UnifiedHeader._updateNotifBadge) {
        UnifiedHeader._updateNotifBadge();
        UnifiedHeader._renderNotifList();
    }
    return notif;
}
