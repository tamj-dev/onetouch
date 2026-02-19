const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/auth');
const { authorize, companyScope } = require('../middleware/rbac');
const config = require('../config');

const router = express.Router();
router.use(authenticate);

/**
 * GET /api/contracts
 * 契約一覧
 */
router.get('/', companyScope, async (req, res) => {
  try {
    const { partnerId, status, page, limit } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const pageSize = Math.min(config.MAX_PAGE_SIZE, parseInt(limit) || config.DEFAULT_PAGE_SIZE);
    const offset = (pageNum - 1) * pageSize;

    const conditions = [];
    const params = [];
    let idx = 1;

    if (req.companyFilter) {
      conditions.push(`c.company_code = $${idx++}`);
      params.push(req.companyFilter);
    }
    if (partnerId) {
      conditions.push(`c.partner_id = $${idx++}`);
      params.push(partnerId);
    }
    if (status) {
      conditions.push(`c.status = $${idx++}`);
      params.push(status);
    } else {
      conditions.push(`c.status = 'active'`);
    }

    const where = 'WHERE ' + conditions.join(' AND ');

    const countResult = await db.query(`SELECT COUNT(*) FROM contracts c ${where}`, params);
    const total = parseInt(countResult.rows[0].count);

    const dataResult = await db.query(
      `SELECT c.*, p.name as partner_name, p.partner_code,
              co.name as company_name, o.name as office_name
       FROM contracts c
       JOIN partners p ON p.id = c.partner_id
       LEFT JOIN companies co ON co.code = c.company_code
       LEFT JOIN offices o ON o.code = c.office_code
       ${where}
       ORDER BY c.created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, pageSize, offset]
    );

    res.json({
      data: dataResult.rows.map(formatContract),
      pagination: { page: pageNum, limit: pageSize, total, totalPages: Math.ceil(total / pageSize) }
    });
  } catch (err) {
    console.error('[CONTRACTS] List error:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

/**
 * GET /api/contracts/resolve
 * カテゴリから担当業者を検索（通報画面の自動振り分け確認用）
 */
router.get('/resolve', companyScope, async (req, res) => {
  try {
    const { category, officeCode } = req.query;
    if (!category) return res.status(400).json({ error: 'カテゴリを指定してください' });

    const companyCode = req.companyFilter || req.user.companyCode;
    const targetOffice = officeCode || req.user.officeCode;

    const result = await db.query(
      `SELECT c.partner_id, p.name as partner_name
       FROM contracts c
       JOIN partners p ON p.id = c.partner_id
       WHERE c.company_code = $1
         AND c.status = 'active'
         AND c.categories @> $2::jsonb
         AND (c.office_code = $3 OR c.office_code IS NULL)
       ORDER BY CASE WHEN c.office_code IS NOT NULL THEN 0 ELSE 1 END
       LIMIT 1`,
      [companyCode, JSON.stringify([category]), targetOffice]
    );

    if (result.rows.length > 0) {
      res.json({ partnerId: result.rows[0].partner_id, partnerName: result.rows[0].partner_name });
    } else {
      res.json({ partnerId: null, partnerName: '' });
    }
  } catch (err) {
    console.error('[CONTRACTS] Resolve error:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

/**
 * POST /api/contracts
 */
router.post('/', authorize('company_admin', 'system_admin'), async (req, res) => {
  try {
    const { partnerId, companyCode, officeCode, categories, startDate, endDate, notes } = req.body;
    if (!partnerId) return res.status(400).json({ error: '管理会社を選択してください' });
    if (!categories || categories.length === 0) return res.status(400).json({ error: 'カテゴリを選択してください' });

    const targetCompany = req.user.role === 'system_admin' && companyCode ? companyCode : req.user.companyCode;
    const id = 'CNT-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);

    await db.query(
      `INSERT INTO contracts (id, partner_id, company_code, office_code, categories, start_date, end_date, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, partnerId, targetCompany, officeCode || null,
       JSON.stringify(categories), startDate || null, endDate || null, notes || '']
    );

    await db.query(
      `INSERT INTO audit_logs (company_code, user_id, user_name, action, target_type, target_id, details)
       VALUES ($1,$2,$3,'contract_create','contract',$4,$5)`,
      [targetCompany, req.user.id, req.user.name, id, JSON.stringify({ partnerId, categories })]
    );

    res.status(201).json({ id, message: '契約を登録しました' });
  } catch (err) {
    console.error('[CONTRACTS] Create error:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

/**
 * PUT /api/contracts/:id
 */
router.put('/:id', authorize('company_admin', 'system_admin'), async (req, res) => {
  try {
    const current = await db.query('SELECT * FROM contracts WHERE id = $1', [req.params.id]);
    if (current.rows.length === 0) return res.status(404).json({ error: '契約が見つかりません' });

    const contract = current.rows[0];
    if (req.user.role !== 'system_admin' && contract.company_code !== req.user.companyCode) {
      return res.status(403).json({ error: '更新権限がありません' });
    }

    const { categories, officeCode, status, startDate, endDate, notes } = req.body;

    await db.query(
      `UPDATE contracts SET
        categories = COALESCE($1, categories), office_code = $2,
        status = COALESCE($3, status), start_date = $4, end_date = $5,
        notes = COALESCE($6, notes)
       WHERE id = $7`,
      [categories ? JSON.stringify(categories) : null,
       officeCode !== undefined ? officeCode : contract.office_code,
       status, startDate !== undefined ? startDate : contract.start_date,
       endDate !== undefined ? endDate : contract.end_date,
       notes, req.params.id]
    );

    res.json({ message: '契約を更新しました' });
  } catch (err) {
    console.error('[CONTRACTS] Update error:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

/**
 * DELETE /api/contracts/:id (論理削除)
 */
router.delete('/:id', authorize('company_admin', 'system_admin'), async (req, res) => {
  try {
    const current = await db.query('SELECT * FROM contracts WHERE id = $1', [req.params.id]);
    if (current.rows.length === 0) return res.status(404).json({ error: '契約が見つかりません' });

    await db.query(`UPDATE contracts SET status = 'inactive' WHERE id = $1`, [req.params.id]);

    await db.query(
      `INSERT INTO audit_logs (company_code, user_id, user_name, action, target_type, target_id, details)
       VALUES ($1,$2,$3,'contract_delete','contract',$4,$5)`,
      [current.rows[0].company_code, req.user.id, req.user.name, req.params.id, JSON.stringify({})]
    );

    res.json({ message: '契約を無効化しました' });
  } catch (err) {
    console.error('[CONTRACTS] Delete error:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

// ========== ヘルパー ==========
function formatContract(row) {
  return {
    id: row.id, partnerId: row.partner_id, partnerCode: row.partner_code,
    partnerName: row.partner_name, companyCode: row.company_code,
    companyName: row.company_name, officeCode: row.office_code,
    officeName: row.office_name, categories: row.categories || [],
    status: row.status, startDate: row.start_date, endDate: row.end_date,
    notes: row.notes, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

module.exports = router;
