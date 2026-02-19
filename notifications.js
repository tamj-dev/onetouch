const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/auth');
const { authorize, companyScope } = require('../middleware/rbac');
const config = require('../config');

const router = express.Router();
router.use(authenticate);

// =============================================
// LINE通知設定
// =============================================

/**
 * GET /api/notifications/line/settings
 * LINE通知設定取得
 */
router.get('/line/settings', authorize('office_admin', 'company_admin', 'system_admin'), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT value FROM system_settings WHERE key = $1`,
      [`line_settings_${req.user.companyCode}`]
    );

    if (result.rows.length === 0) {
      return res.json({
        enabled: false,
        webhookUrl: '',
        notifyOnNewReport: true,
        notifyOnStatusChange: true,
        notifyOnPartnerResponse: true,
      });
    }

    res.json(result.rows[0].value);
  } catch (err) {
    console.error('[NOTIFICATIONS] LINE settings get error:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

/**
 * PUT /api/notifications/line/settings
 * LINE通知設定更新
 */
router.put('/line/settings', authorize('company_admin', 'system_admin'), async (req, res) => {
  try {
    const { enabled, webhookUrl, notifyOnNewReport, notifyOnStatusChange, notifyOnPartnerResponse } = req.body;

    const settings = {
      enabled: !!enabled,
      webhookUrl: webhookUrl || '',
      notifyOnNewReport: notifyOnNewReport !== false,
      notifyOnStatusChange: notifyOnStatusChange !== false,
      notifyOnPartnerResponse: notifyOnPartnerResponse !== false,
    };

    await db.query(
      `INSERT INTO system_settings (key, value, updated_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_by = $3, updated_at = NOW()`,
      [`line_settings_${req.user.companyCode}`, JSON.stringify(settings), req.user.id]
    );

    res.json({ message: 'LINE通知設定を更新しました' });
  } catch (err) {
    console.error('[NOTIFICATIONS] LINE settings update error:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

/**
 * POST /api/notifications/line/test
 * LINE通知テスト送信
 */
router.post('/line/test', authorize('company_admin', 'system_admin'), async (req, res) => {
  try {
    const { webhookUrl } = req.body;
    if (!webhookUrl) return res.status(400).json({ error: 'Webhook URLを入力してください' });

    const result = await sendLineNotification(webhookUrl, {
      type: 'test',
      title: 'ワンタッチ管理システム テスト通知',
      message: '通知設定のテストです。このメッセージが表示されれば正常に動作しています。',
    });

    if (result.success) {
      res.json({ message: 'テスト通知を送信しました' });
    } else {
      res.status(400).json({ error: 'テスト通知の送信に失敗しました: ' + result.error });
    }
  } catch (err) {
    console.error('[NOTIFICATIONS] LINE test error:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

// =============================================
// アプリ内通知
// =============================================

/**
 * GET /api/notifications
 * 通知一覧取得
 */
router.get('/', async (req, res) => {
  try {
    const { page, limit, unreadOnly } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const pageSize = Math.min(50, parseInt(limit) || 20);
    const offset = (pageNum - 1) * pageSize;

    // 通知は通報のステータス変更から自動生成する
    // ここでは通報の更新履歴を通知として返す
    const conditions = ['r.updated_at > r.created_at']; // 更新されたもの
    const params = [];
    let idx = 1;

    if (req.user.role === 'contractor') {
      conditions.push(`r.assigned_partner_id = $${idx++}`);
      params.push(req.user.companyCode);
    } else {
      conditions.push(`r.company_code = $${idx++}`);
      params.push(req.user.companyCode);
      if (req.user.officeCode && req.user.role !== 'company_admin') {
        conditions.push(`r.office_code = $${idx++}`);
        params.push(req.user.officeCode);
      }
    }

    const where = 'WHERE ' + conditions.join(' AND ');

    const result = await db.query(
      `SELECT r.id, r.title, r.status, r.assigned_partner_name,
              r.updated_at, r.category, r.contractor_memo
       FROM reports r
       ${where}
       ORDER BY r.updated_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, pageSize, offset]
    );

    const notifications = result.rows.map(r => ({
      id: 'notif-' + r.id,
      reportId: r.id,
      title: formatNotificationTitle(r),
      message: formatNotificationMessage(r),
      type: r.status,
      createdAt: r.updated_at,
    }));

    res.json({ data: notifications });
  } catch (err) {
    console.error('[NOTIFICATIONS] List error:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

// =============================================
// LINE通知送信ヘルパー
// =============================================

/**
 * LINE Notifyまたは LINE Messaging API でメッセージ送信
 * 通報作成時・ステータス変更時にreports.jsから呼び出す
 */
async function sendLineNotification(webhookUrl, data) {
  try {
    // LINE Notify形式
    const message = `\n${data.title}\n${data.message}`;

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `message=${encodeURIComponent(message)}`,
    });

    if (response.ok) {
      return { success: true };
    } else {
      const text = await response.text();
      return { success: false, error: text };
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * 通報イベント発生時にLINE通知を送信（他のルートから呼び出す用）
 */
async function notifyReportEvent(companyCode, eventType, reportData) {
  try {
    const result = await db.query(
      `SELECT value FROM system_settings WHERE key = $1`,
      [`line_settings_${companyCode}`]
    );
    if (result.rows.length === 0) return;

    const settings = result.rows[0].value;
    if (!settings.enabled || !settings.webhookUrl) return;

    // イベントタイプに応じて通知可否判定
    if (eventType === 'new_report' && !settings.notifyOnNewReport) return;
    if (eventType === 'status_change' && !settings.notifyOnStatusChange) return;
    if (eventType === 'partner_response' && !settings.notifyOnPartnerResponse) return;

    const titles = {
      new_report: '🔔 新しい通報',
      status_change: '📝 ステータス更新',
      partner_response: '🔧 管理会社対応',
    };

    await sendLineNotification(settings.webhookUrl, {
      type: eventType,
      title: titles[eventType] || '通知',
      message: `[${reportData.category || ''}] ${reportData.title}\nステータス: ${reportData.status || 'pending'}`,
    });
  } catch (err) {
    // LINE通知失敗はログのみ（メイン処理に影響させない）
    console.error('[LINE NOTIFY] Error:', err.message);
  }
}

// ========== ヘルパー ==========
function formatNotificationTitle(report) {
  const statusLabels = {
    pending: '新規通報',
    in_progress: '対応中に変更',
    completed: '対応完了',
    cancelled: 'キャンセル',
  };
  return statusLabels[report.status] || '通報更新';
}

function formatNotificationMessage(report) {
  let msg = report.title;
  if (report.assigned_partner_name) msg += ` (${report.assigned_partner_name})`;
  if (report.contractor_memo) msg += ` - ${report.contractor_memo}`;
  return msg;
}

// 他のルートから使えるようにexport
module.exports = router;
module.exports.notifyReportEvent = notifyReportEvent;
