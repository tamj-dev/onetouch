const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/auth');
const { authorize, companyScope } = require('../middleware/rbac');
const config = require('../config');

const router = express.Router();
router.use(authenticate);

/**
 * GET /api/offices
 * 事業所一覧
 */
router.get('/', companyScope, async (req, res) => {
  try {
    const { search, status, page, limit } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const pageSize = Math.min(config.MAX_PAGE_SIZE, parseInt(limit) || config.DEFAULT_PAGE_SIZE);
    const offset = (pageNum - 1) * pageSize;

    const conditions = [];
    const params = [];
    let idx = 1;

    if (req.companyFilter) {
      conditions.push(`o.company_code = $${idx++}`);
      params.push(req.companyFilter);
    }
    if (status) {
      conditions.push(`o.status = $${idx++}`);
      params.push(status);
    } else {
      conditions.push(`o.status = 'active'`);
    }
    if (search) {
      conditions.push(`(o.name ILIKE $${idx} OR o.code ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const countResult = await db.query(`SELECT COUNT(*) FROM offices o ${where}`, params);
    const total = parseInt(countResult.rows[0].count);

    const dataResult = await db.query(
      `SELECT o.*, c.name as company_name,
              (SELECT COUNT(*) FROM accounts a WHERE a.office_code = o.code AND a.status = 'active') as account_count,
              (SELECT COUNT(*) FROM items i WHERE i.office_code = o.code AND i.status = 'active') as item_count
       FROM offices o
       LEFT JOIN companies c ON o.company_code = c.code
       ${where}
       ORDER BY o.created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, pageSize, offset]
    );

    res.json({
      data: dataResult.rows.map(formatOffice),
      pagination: { page: pageNum, limit: pageSize, total, totalPages: Math.ceil(total / pageSize) }
    });
  } catch (err) {
    console.error('[OFFICES] List error:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

/**
 * GET /api/offices/:code
 */
router.get('/:code', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT o.*, c.name as company_name FROM offices o
       LEFT JOIN companies c ON o.company_code = c.code
       WHERE o.code = $1`, [req.params.code]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: '事業所が見つかりません' });

    const office = result.rows[0];
    if (req.user.role !== 'system_admin' && office.company_code !== req.user.companyCode) {
      return res.status(403).json({ error: 'アクセス権がありません' });
    }
    res.json(formatOffice(office));
  } catch (err) {
    console.error('[OFFICES] Get error:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

/**
 * POST /api/offices
 */
router.post('/', authorize('company_admin', 'system_admin'), async (req, res) => {
  try {
    const { code, name, serviceType, phone, address, postalCode, prefecture, companyCode } = req.body;
    if (!name) return res.status(400).json({ error: '事業所名を入力してください' });

    const targetCompany = req.user.role === 'system_admin' && companyCode ? companyCode : req.user.companyCode;

    // コード自動生成（指定がなければ）
    const officeCode = code || await generateOfficeCode(targetCompany);

    await db.query(
      `INSERT INTO offices (code, company_code, name, service_type, phone, address, postal_code, prefecture)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [officeCode, targetCompany, name, serviceType || '', phone || '', address || '', postalCode || '', prefecture || '']
    );

    await db.query(
      `INSERT INTO audit_logs (company_code, user_id, user_name, action, target_type, target_id, details)
       VALUES ($1,$2,$3,'office_create','office',$4,$5)`,
      [targetCompany, req.user.id, req.user.name, officeCode, JSON.stringify({ name })]
    );

    res.status(201).json({ code: officeCode, message: '事業所を登録しました' });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: '同じコードの事業所が既に存在します' });
    console.error('[OFFICES] Create error:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

/**
 * PUT /api/offices/:code
 */
router.put('/:code', authorize('office_admin', 'company_admin', 'system_admin'), async (req, res) => {
  try {
    const current = await db.query('SELECT * FROM offices WHERE code = $1', [req.params.code]);
    if (current.rows.length === 0) return res.status(404).json({ error: '事業所が見つかりません' });

    const office = current.rows[0];
    if (req.user.role !== 'system_admin' && office.company_code !== req.user.companyCode) {
      return res.status(403).json({ error: '更新権限がありません' });
    }

    const { name, serviceType, phone, address, postalCode, prefecture, status } = req.body;

    await db.query(
      `UPDATE offices SET
        name = COALESCE($1, name), service_type = COALESCE($2, service_type),
        phone = COALESCE($3, phone), address = COALESCE($4, address),
        postal_code = COALESCE($5, postal_code), prefecture = COALESCE($6, prefecture),
        status = COALESCE($7, status)
       WHERE code = $8`,
      [name, serviceType, phone, address, postalCode, prefecture, status, req.params.code]
    );

    res.json({ message: '事業所を更新しました' });
  } catch (err) {
    console.error('[OFFICES] Update error:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

/**
 * DELETE /api/offices/:code (論理削除)
 */
router.delete('/:code', authorize('company_admin', 'system_admin'), async (req, res) => {
  try {
    const current = await db.query('SELECT * FROM offices WHERE code = $1', [req.params.code]);
    if (current.rows.length === 0) return res.status(404).json({ error: '事業所が見つかりません' });

    await db.query(`UPDATE offices SET status = 'inactive' WHERE code = $1`, [req.params.code]);

    await db.query(
      `INSERT INTO audit_logs (company_code, user_id, user_name, action, target_type, target_id, details)
       VALUES ($1,$2,$3,'office_delete','office',$4,$5)`,
      [current.rows[0].company_code, req.user.id, req.user.name, req.params.code, JSON.stringify({ name: current.rows[0].name })]
    );

    res.json({ message: '事業所を無効化しました' });
  } catch (err) {
    console.error('[OFFICES] Delete error:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

// ========== ヘルパー ==========
async function generateOfficeCode(companyCode) {
  const result = await db.query(
    `SELECT COUNT(*) FROM offices WHERE company_code = $1`, [companyCode]
  );
  const num = parseInt(result.rows[0].count) + 1;
  return companyCode + '-J' + String(num).padStart(4, '0');
}

function formatOffice(row) {
  return {
    code: row.code, companyCode: row.company_code, companyName: row.company_name,
    name: row.name, serviceType: row.service_type, phone: row.phone,
    address: row.address, postalCode: row.postal_code, prefecture: row.prefecture,
    status: row.status, accountCount: parseInt(row.account_count) || 0,
    itemCount: parseInt(row.item_count) || 0,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

module.exports = router;
