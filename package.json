const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

const router = express.Router();

/**
 * GET /api/categories
 * カテゴリ一覧取得（全ユーザー共通）
 * ※フロントはこのAPIからカテゴリを取得する
 * ※ハードコードしないので仕様変更はDBのINSERT/UPDATEだけで完了
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, name, sort_order, is_system
       FROM categories
       WHERE status = 'active'
       ORDER BY sort_order, id`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[CATEGORIES] List error:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

/**
 * POST /api/categories
 * カテゴリ追加（system_admin のみ）
 */
router.post('/', authenticate, authorize('system_admin'), async (req, res) => {
  try {
    const { name, sort_order } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'カテゴリ名を入力してください' });
    }

    const result = await db.query(
      `INSERT INTO categories (name, sort_order, is_system)
       VALUES ($1, $2, FALSE)
       RETURNING *`,
      [name, sort_order || 50]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') { // unique violation
      return res.status(409).json({ error: '同じ名前のカテゴリが既に存在します' });
    }
    console.error('[CATEGORIES] Create error:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

module.exports = router;
