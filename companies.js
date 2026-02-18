const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const config = require('../config');

const router = express.Router();
router.use(authenticate);

/**
 * GET /api/companies
 * 会社一覧（system_adminは全件、それ以外は自社のみ）
 */
router.get('/', async (req, res) => {
  try {
    const { search, page, limit } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const pageSize = Math.min(config.MAX_PAGE_SIZE, parseInt(limit) || config.DEFAULT_PAGE_SIZE);
    const offset = (pageNum - 1) * pageSize;

    const conditions = [];
    const params = [];
    let idx = 1;

    if (req.user.role !== 'system_admin') {
      conditions.push(`c.code = $${idx++}`);
      params.push(req.user.companyCode);
    }
    if (search) {
      conditions.push(`(c.name ILIKE $${idx} OR c.code ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }
    conditions.push(`c.status = 'active'`);

    const where = 'WHERE ' + conditions.join(' AND ');

    const countResult = await db.query(`SELECT COUNT(*) FROM companies c ${where}`, params);
    const total = parseInt(countResult.rows[0].count);

    const dataResult = await db.query(
      `SELECT c.*,
              (SELECT COUNT(*) FROM offices o WHERE o.company_code = c.code AND o.status = 'active') as office_count,
              (SELECT COUNT(*) FROM accounts a WHERE a.company_code = c.code AND a.status = 'active') as account_count
       FROM companies c
       ${where}
       ORDER BY c.created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, pageSize, offset]
    );

    res.json({
      data: dataResult.rows.map(row => ({
        code: row.code, name: row.name, postalCode: row.postal_code,
        prefecture: row.prefecture, address: row.address,
        phone: row.phone, email: row.email, status: row.status,
        officeCount: parseInt(row.office_count) || 0,
        accountCount: parseInt(row.account_count) || 0,
        createdAt: row.created_at, updatedAt: row.updated_at,
      })),
      pagination: { page: pageNum, limit: pageSize, total, totalPages: Math.ceil(total / pageSize) }
    });
  } catch (err) {
    console.error('[COMPANIES] List error:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

/**
 * POST /api/companies
 */
router.post('/', authorize('system_admin'), async (req, res) => {
  try {
    const { code, name, phone, email, address, postalCode, prefecture } = req.body;
    if (!code || !name) return res.status(400).json({ error: '会社コードと会社名を入力してください' });

    await db.query(
      `INSERT INTO companies (code, name, phone, email, address, postal_code, prefecture)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [code, name, phone || '', email || '', address || '', postalCode || '', prefecture || '']
    );

    res.status(201).json({ code, message: '会社を登録しました' });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: '同じコードの会社が既に存在します' });
    console.error('[COMPANIES] Create error:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

/**
 * PUT /api/companies/:code
 */
router.put('/:code', authorize('company_admin', 'system_admin'), async (req, res) => {
  try {
    const current = await db.query('SELECT * FROM companies WHERE code = $1', [req.params.code]);
    if (current.rows.length === 0) return res.status(404).json({ error: '会社が見つかりません' });

    if (req.user.role !== 'system_admin' && req.params.code !== req.user.companyCode) {
      return res.status(403).json({ error: '更新権限がありません' });
    }

    const { name, phone, email, address, postalCode, prefecture } = req.body;

    await db.query(
      `UPDATE companies SET
        name = COALESCE($1, name), phone = COALESCE($2, phone), email = COALESCE($3, email),
        address = COALESCE($4, address), postal_code = COALESCE($5, postal_code),
        prefecture = COALESCE($6, prefecture)
       WHERE code = $7`,
      [name, phone, email, address, postalCode, prefecture, req.params.code]
    );

    res.json({ message: '会社情報を更新しました' });
  } catch (err) {
    console.error('[COMPANIES] Update error:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

module.exports = router;
