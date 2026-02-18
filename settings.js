const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

const router = express.Router();
router.use(authenticate);

/**
 * GET /api/settings
 * システム設定一覧
 */
router.get('/', authorize('company_admin', 'system_admin'), async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM system_settings ORDER BY key');
    const settings = {};
    result.rows.forEach(row => { settings[row.key] = row.value; });
    res.json(settings);
  } catch (err) {
    console.error('[SETTINGS] Get error:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

/**
 * GET /api/settings/:key
 * 個別設定取得
 */
router.get('/:key', async (req, res) => {
  try {
    // メンテナンスモードは全員が確認可能
    const publicKeys = ['maintenanceMode', 'maintenanceMessage'];
    if (!publicKeys.includes(req.params.key)) {
      const level = { staff: 1, office_admin: 2, company_admin: 3, system_admin: 4 };
      if ((level[req.user.role] || 0) < 3) {
        return res.status(403).json({ error: 'アクセス権がありません' });
      }
    }

    const result = await db.query('SELECT * FROM system_settings WHERE key = $1', [req.params.key]);
    if (result.rows.length === 0) return res.json({ key: req.params.key, value: null });
    res.json({ key: result.rows[0].key, value: result.rows[0].value });
  } catch (err) {
    console.error('[SETTINGS] Get key error:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

/**
 * PUT /api/settings/:key
 * 設定更新
 */
router.put('/:key', authorize('company_admin', 'system_admin'), async (req, res) => {
  try {
    const { value } = req.body;

    // system_admin専用の設定
    const systemOnlyKeys = ['maintenanceMode', 'maintenanceMessage'];
    if (systemOnlyKeys.includes(req.params.key) && req.user.role !== 'system_admin') {
      return res.status(403).json({ error: 'この設定はシステム管理者のみ変更可能です' });
    }

    await db.query(
      `INSERT INTO system_settings (key, value, updated_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_by = $3, updated_at = NOW()`,
      [req.params.key, JSON.stringify(value), req.user.id]
    );

    await db.query(
      `INSERT INTO audit_logs (company_code, user_id, user_name, action, target_type, target_id, details)
       VALUES ($1,$2,$3,'setting_update','setting',$4,$5)`,
      [req.user.companyCode, req.user.id, req.user.name, req.params.key, JSON.stringify({ value })]
    );

    res.json({ message: '設定を更新しました' });
  } catch (err) {
    console.error('[SETTINGS] Update error:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

/**
 * POST /api/settings/backup
 * データバックアップ（CSVエクスポート用のデータ取得）
 */
router.post('/backup', authorize('company_admin', 'system_admin'), async (req, res) => {
  try {
    const companyCode = req.user.role === 'system_admin' ? req.query.companyCode : req.user.companyCode;

    const [companies, offices, accounts, partners, contracts, items, reports] = await Promise.all([
      db.query('SELECT * FROM companies WHERE code = $1', [companyCode]),
      db.query('SELECT * FROM offices WHERE company_code = $1', [companyCode]),
      db.query('SELECT id, name, role, company_code, office_code, status, created_at FROM accounts WHERE company_code = $1', [companyCode]),
      db.query('SELECT * FROM partners'),
      db.query('SELECT * FROM contracts WHERE company_code = $1', [companyCode]),
      db.query('SELECT * FROM items WHERE company_code = $1', [companyCode]),
      db.query('SELECT * FROM reports WHERE company_code = $1 ORDER BY created_at DESC LIMIT 10000', [companyCode]),
    ]);

    await db.query(
      `INSERT INTO audit_logs (company_code, user_id, user_name, action, target_type, details)
       VALUES ($1,$2,$3,'backup_export','system',$4)`,
      [companyCode, req.user.id, req.user.name, JSON.stringify({ companyCode })]
    );

    res.json({
      exportedAt: new Date().toISOString(),
      companyCode,
      data: {
        companies: companies.rows,
        offices: offices.rows,
        accounts: accounts.rows,
        partners: partners.rows,
        contracts: contracts.rows,
        items: items.rows,
        reports: reports.rows,
      }
    });
  } catch (err) {
    console.error('[SETTINGS] Backup error:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

module.exports = router;
