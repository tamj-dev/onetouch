const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/auth');
const { authorize, officeScope } = require('../middleware/rbac');
const config = require('../config');

const router = express.Router();

// 全ルートに認証必須
router.use(authenticate);

/**
 * POST /api/reports
 * 新規通報作成 + 業者自動振り分け
 */
router.post('/', authorize('staff', 'office_admin', 'company_admin', 'system_admin'), async (req, res) => {
  try {
    const {
      itemId, type, title, category, description, location, photos
    } = req.body;

    if (!title) {
      return res.status(400).json({ error: '通報内容を入力してください' });
    }

    const user = req.user;
    const companyCode = user.companyCode;
    const officeCode = user.officeCode;

    // 商品情報から業者を取得（assignedPartnerId優先）
    let partnerId = null;
    let partnerName = '';

    if (itemId) {
      const itemResult = await db.query(
        'SELECT assigned_partner_id, assigned_partner_name, category FROM items WHERE item_id = $1',
        [itemId]
      );
      if (itemResult.rows.length > 0) {
        const item = itemResult.rows[0];
        if (item.assigned_partner_id) {
          partnerId = item.assigned_partner_id;
          partnerName = item.assigned_partner_name || '';
        }
      }
    }

    // 商品に業者が未設定 → 契約テーブルから自動振り分け
    if (!partnerId && category) {
      const resolved = await resolvePartnerFromContract(companyCode, officeCode, category);
      if (resolved) {
        partnerId = resolved.partnerId;
        partnerName = resolved.partnerName;
      }
    }

    // レポートID生成
    const id = 'RPT-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);

    await db.query(
      `INSERT INTO reports
        (id, company_code, office_code, item_id, type, title, category,
         description, location, status, assigned_partner_id, assigned_partner_name,
         reporter_id, reporter_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending',$10,$11,$12,$13)`,
      [id, companyCode, officeCode, itemId || null, type || 'report',
       title, category || null, description || '', location || '',
       partnerId, partnerName, user.id, user.name]
    );

    // 写真がある場合（Base64 → 将来S3に変更）
    if (photos && photos.length > 0) {
      for (const photo of photos) {
        await db.query(
          `INSERT INTO report_photos (report_id, s3_key, file_name, mime_type)
           VALUES ($1, $2, $3, $4)`,
          [id, photo.data || '', photo.name || '', photo.type || 'image/jpeg']
        );
      }
    }

    // 監査ログ
    await db.query(
      `INSERT INTO audit_logs (company_code, office_code, user_id, user_name, action, target_type, target_id, details)
       VALUES ($1,$2,$3,$4,'report_create','report',$5,$6)`,
      [companyCode, officeCode, user.id, user.name, id,
       JSON.stringify({ title, category, partnerId })]
    );

    res.status(201).json({
      id,
      message: '通報を送信しました',
      assignedPartner: partnerId ? { id: partnerId, name: partnerName } : null,
    });

  } catch (err) {
    console.error('[REPORTS] Create error:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

/**
 * GET /api/reports
 * 通報一覧（ロール別自動フィルタ + ページネーション + 検索）
 */
router.get('/', officeScope, async (req, res) => {
  try {
    const { status, category, search, page, limit, sort } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const pageSize = Math.min(config.MAX_PAGE_SIZE, parseInt(limit) || config.DEFAULT_PAGE_SIZE);
    const offset = (pageNum - 1) * pageSize;

    // WHERE条件を動的に構築
    const conditions = [];
    const params = [];
    let paramIdx = 1;

    // ロール別フィルタ
    if (req.user.role === 'contractor') {
      conditions.push(`r.assigned_partner_id = $${paramIdx++}`);
      params.push(req.user.companyCode); // 業者のcompanyCode = partnerId
    } else {
      if (req.companyFilter) {
        conditions.push(`r.company_code = $${paramIdx++}`);
        params.push(req.companyFilter);
      }
      if (req.officeFilter) {
        conditions.push(`r.office_code = $${paramIdx++}`);
        params.push(req.officeFilter);
      }
    }

    // フィルタ
    if (status) {
      conditions.push(`r.status = $${paramIdx++}`);
      params.push(status);
    }
    if (category) {
      conditions.push(`r.category = $${paramIdx++}`);
      params.push(category);
    }
    if (search) {
      conditions.push(`(r.title ILIKE $${paramIdx} OR r.description ILIKE $${paramIdx})`);
      params.push(`%${search}%`);
      paramIdx++;
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    // ソート
    const sortColumn = sort === 'oldest' ? 'r.created_at ASC' : 'r.created_at DESC';

    // 総件数
    const countResult = await db.query(
      `SELECT COUNT(*) FROM reports r ${whereClause}`,
      params
    );
    const totalCount = parseInt(countResult.rows[0].count);

    // データ取得
    const dataResult = await db.query(
      `SELECT r.*,
              (SELECT COUNT(*) FROM report_photos rp WHERE rp.report_id = r.id) as photo_count
       FROM reports r
       ${whereClause}
       ORDER BY ${sortColumn}
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      [...params, pageSize, offset]
    );

    res.json({
      data: dataResult.rows.map(formatReport),
      pagination: {
        page: pageNum,
        limit: pageSize,
        total: totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
      }
    });

  } catch (err) {
    console.error('[REPORTS] List error:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

/**
 * GET /api/reports/:id
 * 通報詳細
 */
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT r.*,
              json_agg(json_build_object('id', rp.id, 's3_key', rp.s3_key, 'file_name', rp.file_name)) FILTER (WHERE rp.id IS NOT NULL) as photos
       FROM reports r
       LEFT JOIN report_photos rp ON rp.report_id = r.id
       WHERE r.id = $1
       GROUP BY r.id`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '通報が見つかりません' });
    }

    const report = result.rows[0];

    // アクセス権チェック（同じ会社 or 担当業者）
    if (req.user.role === 'contractor') {
      if (report.assigned_partner_id !== req.user.companyCode) {
        return res.status(403).json({ error: 'アクセス権がありません' });
      }
    } else if (req.user.role !== 'system_admin') {
      if (report.company_code !== req.user.companyCode) {
        return res.status(403).json({ error: 'アクセス権がありません' });
      }
    }

    res.json(formatReport(report));

  } catch (err) {
    console.error('[REPORTS] Detail error:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

/**
 * PUT /api/reports/:id/status
 * ステータス更新（業者の対応開始/完了 など）
 */
router.put('/:id/status', async (req, res) => {
  try {
    const { status, contractorMemo } = req.body;
    const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: '無効なステータスです' });
    }

    // 通報の存在確認
    const current = await db.query('SELECT * FROM reports WHERE id = $1', [req.params.id]);
    if (current.rows.length === 0) {
      return res.status(404).json({ error: '通報が見つかりません' });
    }

    const report = current.rows[0];

    // 権限チェック
    if (req.user.role === 'contractor' && report.assigned_partner_id !== req.user.companyCode) {
      return res.status(403).json({ error: 'この通報を更新する権限がありません' });
    }

    const updates = ['status = $1', 'updated_at = NOW()'];
    const params = [status];
    let paramIdx = 2;

    if (status === 'completed') {
      updates.push(`completed_at = NOW()`);
    }
    if (contractorMemo !== undefined) {
      updates.push(`contractor_memo = $${paramIdx++}`);
      params.push(contractorMemo);
    }

    params.push(req.params.id);
    await db.query(
      `UPDATE reports SET ${updates.join(', ')} WHERE id = $${paramIdx}`,
      params
    );

    // 監査ログ
    await db.query(
      `INSERT INTO audit_logs (company_code, office_code, user_id, user_name, action, target_type, target_id, details)
       VALUES ($1,$2,$3,$4,'report_status_update','report',$5,$6)`,
      [report.company_code, report.office_code, req.user.id, req.user.name, req.params.id,
       JSON.stringify({ oldStatus: report.status, newStatus: status })]
    );

    res.json({ message: 'ステータスを更新しました', status });

  } catch (err) {
    console.error('[REPORTS] Status update error:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

// ========== ヘルパー関数 ==========

/**
 * 契約テーブルから業者を自動振り分け
 * 現在のdemo-mode.jsのresolvePartner()と同じロジック
 */
async function resolvePartnerFromContract(companyCode, officeCode, category) {
  // 優先1: 事業所指定の契約
  let result = await db.query(
    `SELECT c.partner_id, p.name as partner_name
     FROM contracts c
     JOIN partners p ON p.id = c.partner_id
     WHERE c.company_code = $1
       AND c.status = 'active'
       AND c.categories @> $2::jsonb
       AND (c.office_code = $3 OR c.office_code IS NULL)
     ORDER BY CASE WHEN c.office_code IS NOT NULL THEN 0 ELSE 1 END
     LIMIT 1`,
    [companyCode, JSON.stringify([category]), officeCode]
  );

  if (result.rows.length > 0) {
    return { partnerId: result.rows[0].partner_id, partnerName: result.rows[0].partner_name };
  }

  return null;
}

/**
 * DBのスネークケース → フロント用のキャメルケースに変換
 */
function formatReport(row) {
  return {
    id: row.id,
    companyCode: row.company_code,
    officeCode: row.office_code,
    itemId: row.item_id,
    type: row.type,
    title: row.title,
    category: row.category,
    description: row.description,
    location: row.location,
    status: row.status,
    assignedPartnerId: row.assigned_partner_id,
    assignedPartnerName: row.assigned_partner_name,
    reporterId: row.reporter_id,
    reporterName: row.reporter_name,
    contractorMemo: row.contractor_memo,
    photoCount: parseInt(row.photo_count) || 0,
    photos: row.photos || [],
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

module.exports = router;
