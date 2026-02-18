const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

const router = express.Router();
router.use(authenticate);

/**
 * GET /api/setups
 * セットアップ一覧（system_adminは全件、company_adminは自社のみ）
 */
router.get('/', authorize('company_admin', 'system_admin'), async (req, res) => {
  try {
    const conditions = [];
    const params = [];
    let idx = 1;

    if (req.user.role !== 'system_admin') {
      conditions.push(`s.company_code = $${idx++}`);
      params.push(req.user.companyCode);
    }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const result = await db.query(
      `SELECT s.*, c.name as company_name
       FROM setups s
       LEFT JOIN companies c ON c.code = s.company_code
       ${where}
       ORDER BY s.updated_at DESC`,
      params
    );

    res.json(result.rows.map(formatSetup));
  } catch (err) {
    console.error('[SETUPS] List error:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

/**
 * GET /api/setups/:id
 * セットアップ詳細
 */
router.get('/:id', authorize('company_admin', 'system_admin'), async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM setups WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'セットアップが見つかりません' });

    const setup = result.rows[0];
    if (req.user.role !== 'system_admin' && setup.company_code !== req.user.companyCode) {
      return res.status(403).json({ error: 'アクセス権がありません' });
    }

    res.json(formatSetup(setup));
  } catch (err) {
    console.error('[SETUPS] Get error:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

/**
 * POST /api/setups
 * 新規セットアップ開始（ステップ1: 会社情報）
 */
router.post('/', authorize('system_admin'), async (req, res) => {
  try {
    const { companyCode, companyName } = req.body;
    if (!companyCode || !companyName) {
      return res.status(400).json({ error: '会社コードと会社名を入力してください' });
    }

    const id = 'SETUP-' + Date.now();

    // 会社テーブルに登録
    await db.query(
      `INSERT INTO companies (code, name) VALUES ($1, $2) ON CONFLICT (code) DO UPDATE SET name = $2`,
      [companyCode, companyName]
    );

    // セットアップ進捗作成
    await db.query(
      `INSERT INTO setups (id, company_code, current_step, data, created_by, status)
       VALUES ($1, $2, 2, $3, $4, 'in_progress')`,
      [id, companyCode, JSON.stringify({
        companyCode, companyName,
        offices: [], accounts: [], partnerId: null, partnerName: '',
        contractCategories: [], items: [],
      }), req.user.id]
    );

    await db.query(
      `INSERT INTO audit_logs (company_code, user_id, user_name, action, target_type, target_id, details)
       VALUES ($1,$2,$3,'setup_start','setup',$4,$5)`,
      [companyCode, req.user.id, req.user.name, id, JSON.stringify({ companyName })]
    );

    res.status(201).json({ id, message: 'セットアップを開始しました' });
  } catch (err) {
    console.error('[SETUPS] Create error:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

/**
 * PUT /api/setups/:id/step
 * ステップ完了 → 次のステップへ進む
 * 各ステップで実際のDB登録を行う
 */
router.put('/:id/step', authorize('company_admin', 'system_admin'), async (req, res) => {
  const client = await db.getClient();
  try {
    const { step, data } = req.body;

    const current = await client.query('SELECT * FROM setups WHERE id = $1', [req.params.id]);
    if (current.rows.length === 0) return res.status(404).json({ error: 'セットアップが見つかりません' });

    const setup = current.rows[0];
    const setupData = setup.data || {};
    const companyCode = setup.company_code;

    await client.query('BEGIN');

    switch (step) {
      // ステップ2完了: 事業所登録
      case 2: {
        const offices = data.offices || [];
        for (const o of offices) {
          await client.query(
            `INSERT INTO offices (code, company_code, name, service_type, phone, address)
             VALUES ($1,$2,$3,$4,$5,$6)
             ON CONFLICT (code) DO UPDATE SET name=$3, service_type=$4, phone=$5, address=$6`,
            [o.code, companyCode, o.name, o.serviceType || '', o.phone || '', o.address || '']
          );
        }
        setupData.offices = offices;
        break;
      }

      // ステップ3完了: アカウント登録
      case 3: {
        const accounts = data.accounts || [];
        for (const a of accounts) {
          const hash = await bcrypt.hash(a.password || 'password', 10);
          const companyResult = await client.query('SELECT name FROM companies WHERE code = $1', [companyCode]);
          const officeResult = await client.query('SELECT name FROM offices WHERE code = $1', [a.officeCode]);
          await client.query(
            `INSERT INTO accounts (id, company_code, office_code, name, role, password_hash, company_name, office_name)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
             ON CONFLICT (id) DO UPDATE SET name=$4, role=$5, office_code=$3`,
            [a.id, companyCode, a.officeCode || '', a.name, a.role || 'staff', hash,
             companyResult.rows[0]?.name || '', officeResult.rows[0]?.name || '']
          );
        }
        setupData.accounts = accounts;
        break;
      }

      // ステップ4完了: 業者登録
      case 4: {
        const partner = data.partner;
        if (partner) {
          const partnerId = partner.id || ('PN' + String(Date.now()).slice(-6));
          await client.query(
            `INSERT INTO partners (id, partner_code, name, contact_name, phone, categories)
             VALUES ($1,$1,$2,$3,$4,$5)
             ON CONFLICT (id) DO UPDATE SET name=$2, contact_name=$3, phone=$4, categories=$5`,
            [partnerId, partner.name, partner.contactName || '', partner.phone || '',
             JSON.stringify(partner.categories || [])]
          );

          // 担当者
          if (partner.contacts) {
            for (const c of partner.contacts) {
              const hash = await bcrypt.hash(c.password || 'demo', 10);
              await client.query(
                `INSERT INTO partner_contacts (partner_id, name, login_id, password_hash, phone, is_main)
                 VALUES ($1,$2,$3,$4,$5,$6)
                 ON CONFLICT (login_id) DO UPDATE SET name=$2, phone=$5`,
                [partnerId, c.name, c.loginId, hash, c.phone || '', c.isMain || false]
              );
            }
          }

          setupData.partnerId = partnerId;
          setupData.partnerName = partner.name;
        }
        break;
      }

      // ステップ5完了: 契約登録
      case 5: {
        const categories = data.contractCategories || [];
        if (setupData.partnerId && categories.length > 0) {
          const contractId = 'CNT-' + Date.now();
          await client.query(
            `INSERT INTO contracts (id, partner_id, company_code, categories)
             VALUES ($1,$2,$3,$4)`,
            [contractId, setupData.partnerId, companyCode, JSON.stringify(categories)]
          );
        }
        setupData.contractCategories = categories;
        break;
      }

      // ステップ6完了: 商品登録
      case 6: {
        const items = data.items || [];
        const defaultOffice = (setupData.offices && setupData.offices[0]) ? setupData.offices[0].code : '';
        for (const item of items) {
          const itemId = 'ITEM-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
          await client.query(
            `INSERT INTO items (item_id, company_code, office_code, name, category, maker, model, floor, location)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
            [itemId, companyCode, item.officeCode || defaultOffice,
             item.name, item.category || null, item.maker || '', item.model || '',
             item.floor || '', item.location || '']
          );
        }
        setupData.items = items;
        break;
      }
    }

    const nextStep = step + 1;
    const isComplete = step >= 6;

    await client.query(
      `UPDATE setups SET current_step = $1, data = $2, status = $3 WHERE id = $4`,
      [isComplete ? 7 : nextStep, JSON.stringify(setupData),
       isComplete ? 'completed' : 'in_progress', req.params.id]
    );

    await client.query('COMMIT');

    res.json({
      message: isComplete ? 'セットアップが完了しました' : `ステップ${step}を保存しました`,
      currentStep: isComplete ? 7 : nextStep,
      isComplete,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[SETUPS] Step error:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  } finally {
    client.release();
  }
});

/**
 * DELETE /api/setups/:id
 */
router.delete('/:id', authorize('system_admin'), async (req, res) => {
  try {
    await db.query(`UPDATE setups SET status = 'cancelled' WHERE id = $1`, [req.params.id]);
    res.json({ message: 'セットアップをキャンセルしました' });
  } catch (err) {
    console.error('[SETUPS] Delete error:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

// ========== ヘルパー ==========
function formatSetup(row) {
  return {
    id: row.id, companyCode: row.company_code, companyName: row.company_name,
    currentStep: row.current_step, data: row.data,
    createdBy: row.created_by, status: row.status,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

module.exports = router;
