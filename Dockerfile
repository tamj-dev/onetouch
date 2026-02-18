const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authenticate, generateToken } = require('../middleware/auth');

const router = express.Router();

/**
 * POST /api/auth/login
 * ログイン → JWTトークン発行
 */
router.post('/login', async (req, res) => {
  try {
    const { loginId, password } = req.body;

    if (!loginId || !password) {
      return res.status(400).json({ error: 'ログインIDとパスワードを入力してください' });
    }

    // 1. 通常アカウント（accounts）から検索
    let result = await db.query(
      `SELECT a.*, c.name as company_name, o.name as office_name
       FROM accounts a
       LEFT JOIN companies c ON a.company_code = c.code
       LEFT JOIN offices o ON a.office_code = o.code
       WHERE a.id = $1 AND a.status = 'active'`,
      [loginId]
    );

    if (result.rows.length > 0) {
      const user = result.rows[0];
      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        return res.status(401).json({ error: 'パスワードが正しくありません' });
      }

      // 最終ログイン日時を更新
      await db.query('UPDATE accounts SET last_login_at = NOW() WHERE id = $1', [loginId]);

      const token = generateToken(user);
      return res.json({
        token,
        user: {
          id: user.id,
          name: user.name,
          role: user.role,
          companyCode: user.company_code,
          companyName: user.company_name,
          officeCode: user.office_code,
          officeName: user.office_name,
          isFirstLogin: user.is_first_login,
        }
      });
    }

    // 2. 業者アカウント（partner_contacts）から検索
    result = await db.query(
      `SELECT pc.*, p.name as company_name, p.id as partner_id, p.partner_code, p.categories
       FROM partner_contacts pc
       JOIN partners p ON pc.partner_id = p.id
       WHERE pc.login_id = $1 AND pc.status = 'active'`,
      [loginId]
    );

    if (result.rows.length > 0) {
      const contact = result.rows[0];
      const valid = await bcrypt.compare(password, contact.password_hash);
      if (!valid) {
        return res.status(401).json({ error: 'パスワードが正しくありません' });
      }

      await db.query('UPDATE partner_contacts SET last_login_at = NOW() WHERE id = $1', [contact.id]);

      // 業者の担当会社を契約テーブルから取得
      const contractResult = await db.query(
        `SELECT DISTINCT company_code FROM contracts WHERE partner_id = $1 AND status = 'active'`,
        [contact.partner_id]
      );
      const assignedCompanies = contractResult.rows.map(r => r.company_code);

      const token = generateToken({
        id: contact.login_id,
        name: contact.name,
        role: 'contractor',
        company_code: contact.partner_id,
        company_name: contact.company_name,
        office_code: '',
        office_name: '',
      });

      return res.json({
        token,
        user: {
          id: contact.login_id,
          name: contact.name,
          role: 'contractor',
          companyCode: contact.partner_id,
          companyName: contact.company_name,
          partnerId: contact.partner_id,
          partnerCode: contact.partner_code,
          categories: contact.categories,
          assignedCompanies,
        }
      });
    }

    return res.status(401).json({ error: 'ログインIDが見つかりません' });

  } catch (err) {
    console.error('[AUTH] Login error:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

/**
 * GET /api/auth/me
 * 現在のユーザー情報取得
 */
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

/**
 * POST /api/auth/change-password
 * パスワード変更
 */
router.post('/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: '現在のパスワードと新しいパスワードを入力してください' });
    }

    if (newPassword.length < 4) {
      return res.status(400).json({ error: 'パスワードは4文字以上にしてください' });
    }

    // 現在のパスワード確認
    const result = await db.query('SELECT password_hash FROM accounts WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'アカウントが見つかりません' });
    }

    const valid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!valid) {
      return res.status(401).json({ error: '現在のパスワードが正しくありません' });
    }

    // 新しいパスワードをハッシュ化して保存
    const hash = await bcrypt.hash(newPassword, 10);
    await db.query(
      'UPDATE accounts SET password_hash = $1, is_first_login = FALSE WHERE id = $2',
      [hash, req.user.id]
    );

    res.json({ message: 'パスワードを変更しました' });

  } catch (err) {
    console.error('[AUTH] Change password error:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

module.exports = router;
