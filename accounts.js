const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authenticate } = require('../middleware/auth');
const { authorize, companyScope, officeScope, ROLE_LEVELS } = require('../middleware/rbac');
const config = require('../config');

const router = express.Router();
router.use(authenticate);

/**
 * GET /api/accounts
 * アカウント一覧（ロール別スコープ自動適用）
 */
router.get('/', authorize('office_admin', 'company_admin', 'system_admin'), officeScope, async (req, res) => {
  try {
    const { role, search, status, page, limit } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const pageSize = Math.min(config.MAX_PAGE_SIZE, parseInt(limit) || config.DEFAULT_PAGE_SIZE);
    const offset = (pageNum - 1) * pageSize;

    const conditions = [];
    const params = [];
    let idx = 1;

    // ロール別スコープ
    if (req.companyFilter) {
      conditions.push(`a.company_code = $${idx++}`);
      params.push(req.companyFilter);
    }
    if (req.officeFilter) {
      conditions.push(`a.office_code = $${idx++}`);
      params.push(req.officeFilter);
    }

    // フィルタ
    if (role) {
      conditions.push(`a.role = $${idx++}`);
      params.push(role);
    }
    if (status) {
      conditions.push(`a.status = $${idx++}`);
      params.push(status);
    } else {
      conditions.push(`a.status = 'active'`);
    }
    if (search) {
      conditions.push(`(a.name ILIKE $${idx} OR a.id ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }

    // 自分より上位のロールは表示しない（system_admin除く）
    if (req.user.role !== 'system_admin') {
      const myLevel = ROLE_LEVELS[req.user.role] || 0;
      // staff=1, office_admin=2, company_admin=3 の範囲で自分以下のみ表示
      const allowedRoles = Object.entries(ROLE_LEVELS)
        .filter(([r, l]) => l <= myLevel && r !== 'contractor')
        .map(([r]) => r);
      conditions.push(`a.role = ANY($${idx++})`);
      params.push(allowedRoles);
    }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const countResult = await db.query(`SELECT COUNT(*) FROM accounts a ${where}`, params);
    const total = parseInt(countResult.rows[0].count);

    const dataResult = await db.query(
      `SELECT a.id, a.name, a.role, a.company_code, a.office_code,
              a.office_name, a.company_name, a.status, a.is_first_login,
              a.last_login_at, a.created_at, a.updated_at,
              c.name as company_name_joined, o.name as office_name_joined
       FROM accounts a
       LEFT JOIN companies c ON a.company_code = c.code
       LEFT JOIN offices o ON a.office_code = o.code
       ${where}
       ORDER BY a.created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, pageSize, offset]
    );

    res.json({
      data: dataResult.rows.map(formatAccount),
      pagination: { page: pageNum, limit: pageSize, total, totalPages: Math.ceil(total / pageSize) }
    });
  } catch (err) {
    console.error('[ACCOUNTS] List error:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

/**
 * GET /api/accounts/:id
 */
router.get('/:id', authorize('office_admin', 'company_admin', 'system_admin'), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT a.*, c.name as company_name_joined, o.name as office_name_joined
       FROM accounts a
       LEFT JOIN companies c ON a.company_code = c.code
       LEFT JOIN offices o ON a.office_code = o.code
       WHERE a.id = $1`, [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'アカウントが見つかりません' });

    const account = result.rows[0];
    // 権限チェック
    if (req.user.role !== 'system_admin' && account.company_code !== req.user.companyCode) {
      return res.status(403).json({ error: 'アクセス権がありません' });
    }

    res.json(formatAccount(account));
  } catch (err) {
    console.error('[ACCOUNTS] Get error:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

/**
 * POST /api/accounts
 * アカウント作成
 */
router.post('/', authorize('office_admin', 'company_admin', 'system_admin'), async (req, res) => {
  try {
    const { id, name, role, password, companyCode, officeCode } = req.body;
    if (!id || !name || !role) {
      return res.status(400).json({ error: 'ログインID、名前、ロールを入力してください' });
    }

    // 自分より上位のロールは作成できない
    const myLevel = ROLE_LEVELS[req.user.role] || 0;
    const targetLevel = ROLE_LEVELS[role] || 0;
    if (req.user.role !== 'system_admin' && targetLevel >= myLevel) {
      return res.status(403).json({ error: '自分以上の権限のアカウントは作成できません' });
    }

    const targetCompany = req.user.role === 'system_admin' && companyCode ? companyCode : req.user.companyCode;
    const targetOffice = officeCode || req.user.officeCode;
    const hash = await bcrypt.hash(password || 'password', 10);

    // 会社名・事業所名を取得
    const companyResult = await db.query('SELECT name FROM companies WHERE code = $1', [targetCompany]);
    const officeResult = await db.query('SELECT name FROM offices WHERE code = $1', [targetOffice]);

    await db.query(
      `INSERT INTO accounts (id, company_code, office_code, name, role, password_hash, company_name, office_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, targetCompany, targetOffice, name, role, hash,
       companyResult.rows[0]?.name || '', officeResult.rows[0]?.name || '']
    );

    await db.query(
      `INSERT INTO audit_logs (company_code, office_code, user_id, user_name, action, target_type, target_id, details)
       VALUES ($1,$2,$3,$4,'account_create','account',$5,$6)`,
      [targetCompany, targetOffice, req.user.id, req.user.name, id, JSON.stringify({ name, role })]
    );

    res.status(201).json({ id, message: 'アカウントを作成しました' });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: '同じログインIDが既に存在します' });
    console.error('[ACCOUNTS] Create error:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

/**
 * PUT /api/accounts/:id
 */
router.put('/:id', authorize('office_admin', 'company_admin', 'system_admin'), async (req, res) => {
  try {
    const current = await db.query('SELECT * FROM accounts WHERE id = $1', [req.params.id]);
    if (current.rows.length === 0) return res.status(404).json({ error: 'アカウントが見つかりません' });

    const account = current.rows[0];
    if (req.user.role !== 'system_admin' && account.company_code !== req.user.companyCode) {
      return res.status(403).json({ error: '更新権限がありません' });
    }

    const { name, role, officeCode, status, password } = req.body;
    const updates = [];
    const params = [];
    let idx = 1;

    if (name) { updates.push(`name = $${idx++}`); params.push(name); }
    if (role) { updates.push(`role = $${idx++}`); params.push(role); }
    if (officeCode !== undefined) {
      updates.push(`office_code = $${idx++}`);
      params.push(officeCode || null);
      // 事業所名も更新
      const offResult = await db.query('SELECT name FROM offices WHERE code = $1', [officeCode]);
      updates.push(`office_name = $${idx++}`);
      params.push(offResult.rows[0]?.name || '');
    }
    if (status) { updates.push(`status = $${idx++}`); params.push(status); }
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      updates.push(`password_hash = $${idx++}`);
      params.push(hash);
      updates.push(`is_first_login = TRUE`);
    }

    if (updates.length === 0) return res.status(400).json({ error: '更新内容がありません' });

    params.push(req.params.id);
    await db.query(`UPDATE accounts SET ${updates.join(', ')} WHERE id = $${idx}`, params);

    res.json({ message: 'アカウントを更新しました' });
  } catch (err) {
    console.error('[ACCOUNTS] Update error:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

/**
 * DELETE /api/accounts/:id (論理削除)
 */
router.delete('/:id', authorize('office_admin', 'company_admin', 'system_admin'), async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: '自分自身のアカウントは削除できません' });
    }

    const current = await db.query('SELECT * FROM accounts WHERE id = $1', [req.params.id]);
    if (current.rows.length === 0) return res.status(404).json({ error: 'アカウントが見つかりません' });

    const account = current.rows[0];
    if (req.user.role !== 'system_admin' && account.company_code !== req.user.companyCode) {
      return res.status(403).json({ error: '削除権限がありません' });
    }

    await db.query(`UPDATE accounts SET status = 'inactive' WHERE id = $1`, [req.params.id]);

    await db.query(
      `INSERT INTO audit_logs (company_code, office_code, user_id, user_name, action, target_type, target_id, details)
       VALUES ($1,$2,$3,$4,'account_delete','account',$5,$6)`,
      [account.company_code, account.office_code, req.user.id, req.user.name, req.params.id,
       JSON.stringify({ name: account.name, role: account.role })]
    );

    res.json({ message: 'アカウントを無効化しました' });
  } catch (err) {
    console.error('[ACCOUNTS] Delete error:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

// ========== 監査ログAPI ==========
/**
 * GET /api/accounts/audit-logs
 */
router.get('/audit-logs/list', authorize('company_admin', 'system_admin'), companyScope, async (req, res) => {
  try {
    const { action, page, limit } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const pageSize = Math.min(config.MAX_PAGE_SIZE, parseInt(limit) || config.DEFAULT_PAGE_SIZE);
    const offset = (pageNum - 1) * pageSize;

    const conditions = [];
    const params = [];
    let idx = 1;

    if (req.companyFilter) {
      conditions.push(`company_code = $${idx++}`);
      params.push(req.companyFilter);
    }
    if (action) {
      conditions.push(`action = $${idx++}`);
      params.push(action);
    }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const countResult = await db.query(`SELECT COUNT(*) FROM audit_logs ${where}`, params);
    const total = parseInt(countResult.rows[0].count);

    const dataResult = await db.query(
      `SELECT * FROM audit_logs ${where}
       ORDER BY created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, pageSize, offset]
    );

    res.json({
      data: dataResult.rows.map(row => ({
        id: row.id, companyCode: row.company_code, officeCode: row.office_code,
        userId: row.user_id, userName: row.user_name, action: row.action,
        targetType: row.target_type, targetId: row.target_id,
        details: row.details, ipAddress: row.ip_address, createdAt: row.created_at,
      })),
      pagination: { page: pageNum, limit: pageSize, total, totalPages: Math.ceil(total / pageSize) }
    });
  } catch (err) {
    console.error('[AUDIT] List error:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

// ========== ヘルパー ==========
function formatAccount(row) {
  return {
    id: row.id, name: row.name, role: row.role,
    companyCode: row.company_code,
    companyName: row.company_name_joined || row.company_name,
    officeCode: row.office_code,
    officeName: row.office_name_joined || row.office_name,
    status: row.status, isFirstLogin: row.is_first_login,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

module.exports = router;
