const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const config = require('../config');

const router = express.Router();
router.use(authenticate);

/**
 * GET /api/partners
 * 業者一覧
 */
router.get('/', async (req, res) => {
  try {
    const { search, status, page, limit } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const pageSize = Math.min(config.MAX_PAGE_SIZE, parseInt(limit) || config.DEFAULT_PAGE_SIZE);
    const offset = (pageNum - 1) * pageSize;

    const conditions = [];
    const params = [];
    let idx = 1;

    if (status) {
      conditions.push(`p.status = $${idx++}`);
      params.push(status);
    } else {
      conditions.push(`p.status = 'active'`);
    }
    if (search) {
      conditions.push(`(p.name ILIKE $${idx} OR p.partner_code ILIKE $${idx} OR p.contact_name ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }

    const where = 'WHERE ' + conditions.join(' AND ');

    const countResult = await db.query(`SELECT COUNT(*) FROM partners p ${where}`, params);
    const total = parseInt(countResult.rows[0].count);

    // 業者が担当する会社を契約テーブルから取得
    const dataResult = await db.query(
      `SELECT p.*,
              COALESCE(
                (SELECT json_agg(DISTINCT c.company_code) FROM contracts c WHERE c.partner_id = p.id AND c.status = 'active'),
                '[]'
              ) as assigned_companies,
              (SELECT COUNT(*) FROM partner_contacts pc WHERE pc.partner_id = p.id AND pc.status = 'active') as contact_count
       FROM partners p
       ${where}
       ORDER BY p.created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, pageSize, offset]
    );

    res.json({
      data: dataResult.rows.map(formatPartner),
      pagination: { page: pageNum, limit: pageSize, total, totalPages: Math.ceil(total / pageSize) }
    });
  } catch (err) {
    console.error('[PARTNERS] List error:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

/**
 * GET /api/partners/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT p.*,
              (SELECT json_agg(json_build_object(
                'id', pc.id, 'name', pc.name, 'loginId', pc.login_id,
                'phone', pc.phone, 'isMain', pc.is_main, 'status', pc.status
              )) FROM partner_contacts pc WHERE pc.partner_id = p.id) as contacts
       FROM partners p WHERE p.id = $1`, [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: '管理会社が見つかりません' });
    res.json(formatPartner(result.rows[0]));
  } catch (err) {
    console.error('[PARTNERS] Get error:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

/**
 * POST /api/partners
 */
router.post('/', authorize('company_admin', 'system_admin'), async (req, res) => {
  const client = await db.getClient();
  try {
    const { name, partnerCode, phone, email, address, contactName, categories, contacts } = req.body;
    if (!name) return res.status(400).json({ error: '会社名を入力してください' });

    const id = partnerCode || ('PN' + String(Date.now()).slice(-6));

    await client.query('BEGIN');

    await client.query(
      `INSERT INTO partners (id, partner_code, name, phone, email, address, contact_name, categories)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, id, name, phone || '', email || '', address || '', contactName || '', JSON.stringify(categories || [])]
    );

    // 担当者登録
    if (contacts && contacts.length > 0) {
      for (const c of contacts) {
        const hash = await bcrypt.hash(c.password || 'demo', 10);
        await client.query(
          `INSERT INTO partner_contacts (partner_id, name, login_id, password_hash, phone, is_main)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [id, c.name, c.loginId, hash, c.phone || '', c.isMain || false]
        );
      }
    }

    await client.query('COMMIT');

    await db.query(
      `INSERT INTO audit_logs (company_code, user_id, user_name, action, target_type, target_id, details)
       VALUES ($1,$2,$3,'partner_create','partner',$4,$5)`,
      [req.user.companyCode, req.user.id, req.user.name, id, JSON.stringify({ name })]
    );

    res.status(201).json({ id, message: '管理会社を登録しました' });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') return res.status(409).json({ error: '同じコードの管理会社が既に存在します' });
    console.error('[PARTNERS] Create error:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  } finally {
    client.release();
  }
});

/**
 * PUT /api/partners/:id
 */
router.put('/:id', authorize('company_admin', 'system_admin'), async (req, res) => {
  try {
    const current = await db.query('SELECT * FROM partners WHERE id = $1', [req.params.id]);
    if (current.rows.length === 0) return res.status(404).json({ error: '管理会社が見つかりません' });

    const { name, phone, email, address, contactName, categories, status } = req.body;

    await db.query(
      `UPDATE partners SET
        name = COALESCE($1, name), phone = COALESCE($2, phone), email = COALESCE($3, email),
        address = COALESCE($4, address), contact_name = COALESCE($5, contact_name),
        categories = COALESCE($6, categories), status = COALESCE($7, status)
       WHERE id = $8`,
      [name, phone, email, address, contactName,
       categories ? JSON.stringify(categories) : null, status, req.params.id]
    );

    res.json({ message: '管理会社を更新しました' });
  } catch (err) {
    console.error('[PARTNERS] Update error:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

/**
 * DELETE /api/partners/:id (論理削除)
 */
router.delete('/:id', authorize('system_admin'), async (req, res) => {
  try {
    const current = await db.query('SELECT * FROM partners WHERE id = $1', [req.params.id]);
    if (current.rows.length === 0) return res.status(404).json({ error: '管理会社が見つかりません' });

    await db.query(`UPDATE partners SET status = 'inactive' WHERE id = $1`, [req.params.id]);

    await db.query(
      `INSERT INTO audit_logs (company_code, user_id, user_name, action, target_type, target_id, details)
       VALUES ($1,$2,$3,'partner_delete','partner',$4,$5)`,
      [req.user.companyCode, req.user.id, req.user.name, req.params.id, JSON.stringify({ name: current.rows[0].name })]
    );

    res.json({ message: '管理会社を無効化しました' });
  } catch (err) {
    console.error('[PARTNERS] Delete error:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

/**
 * POST /api/partners/:id/contacts
 * 担当者追加
 */
router.post('/:id/contacts', authorize('company_admin', 'system_admin'), async (req, res) => {
  try {
    const { name, loginId, password, phone, isMain } = req.body;
    if (!name || !loginId) return res.status(400).json({ error: '名前とログインIDを入力してください' });

    const hash = await bcrypt.hash(password || 'demo', 10);

    await db.query(
      `INSERT INTO partner_contacts (partner_id, name, login_id, password_hash, phone, is_main)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [req.params.id, name, loginId, hash, phone || '', isMain || false]
    );

    res.status(201).json({ message: '担当者を追加しました' });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: '同じログインIDが既に存在します' });
    console.error('[PARTNERS] Add contact error:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

// ========== ヘルパー ==========
function formatPartner(row) {
  return {
    id: row.id, partnerCode: row.partner_code, name: row.name,
    phone: row.phone, email: row.email, address: row.address,
    contactName: row.contact_name, categories: row.categories || [],
    status: row.status, assignedCompanies: row.assigned_companies || [],
    contactCount: parseInt(row.contact_count) || 0,
    contacts: row.contacts || [],
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

module.exports = router;
