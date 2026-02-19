/**
 * デモデータ投入: 既存のデモアカウント/事業所/業者をDBに登録
 * 使い方: node db/seed.js
 */
const bcrypt = require('bcryptjs');
const db = require('./index');

async function seed() {
  console.log('[SEED] デモデータ投入を開始...');
  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    // ========== 会社 ==========
    await client.query(`
      INSERT INTO companies (code, name, status) VALUES
        ('TAMJ', 'タムジ株式会社', 'active'),
        ('SYSTEM', 'ワンタッチ管理運営', 'active')
      ON CONFLICT (code) DO NOTHING
    `);
    console.log('[SEED] 会社データ OK');

    // ========== 事業所 ==========
    await client.query(`
      INSERT INTO offices (code, company_code, name, service_type, status) VALUES
        ('TAMJ-J0001', 'TAMJ', '東京事業所', '介護老人福祉施設', 'active'),
        ('TAMJ-H001', 'TAMJ', '本社', '', 'active')
      ON CONFLICT (code) DO NOTHING
    `);
    console.log('[SEED] 事業所データ OK');

    // ========== アカウント ==========
    const demoHash = await bcrypt.hash('demo', 10);
    const adminHash = await bcrypt.hash('admin', 10);

    await client.query(`
      INSERT INTO accounts (id, company_code, office_code, name, role, password_hash, office_name, company_name, is_first_login, status) VALUES
        ('demo-staff', 'TAMJ', 'TAMJ-J0001', 'デモスタッフ', 'staff', $1, '東京事業所', 'タムジ株式会社', FALSE, 'active'),
        ('demo-office', 'TAMJ', 'TAMJ-J0001', 'デモ事業所管理者', 'office_admin', $1, '東京事業所', 'タムジ株式会社', FALSE, 'active'),
        ('TAMJ-H001', 'TAMJ', 'TAMJ-H001', 'デモ本社管理者', 'company_admin', $1, '本社', 'タムジ株式会社', FALSE, 'active'),
        ('admin', 'SYSTEM', NULL, 'システム管理者', 'system_admin', $2, '', 'ワンタッチ管理運営', FALSE, 'active')
      ON CONFLICT (id) DO NOTHING
    `, [demoHash, adminHash]);
    console.log('[SEED] アカウントデータ OK');

    // ========== 業者 ==========
    await client.query(`
      INSERT INTO partners (id, partner_code, name, contact_name, categories, status) VALUES
        ('PN001', 'PN001', '東京設備工業株式会社', '山田 太郎', '["部屋・共用部の家具・家電", "厨房・食事の道具", "介護医療・お風呂の道具"]', 'active'),
        ('PN002', 'PN002', '関東水道サービス', '佐藤 花子', '["建物・外まわり"]', 'active'),
        ('PN003', 'PN003', '日本電気工事', '鈴木 一郎', '["通信・呼出し・防火の機器"]', 'active')
      ON CONFLICT (id) DO NOTHING
    `);
    console.log('[SEED] 業者データ OK');

    // ========== 業者担当者 ==========
    await client.query(`
      INSERT INTO partner_contacts (partner_id, name, login_id, password_hash, phone, is_main) VALUES
        ('PN001', '山田 太郎', 'pn001-yamada', $1, '090-1234-5678', TRUE),
        ('PN001', '高橋 次郎', 'pn001-takahashi', $1, '090-8765-4321', FALSE),
        ('PN002', '佐藤 花子', 'p002-sato', $1, '090-1111-2222', TRUE),
        ('PN003', '鈴木 一郎', 'p003-suzuki', $1, '090-3333-4444', TRUE)
      ON CONFLICT (login_id) DO NOTHING
    `, [demoHash]);
    console.log('[SEED] 業者担当者データ OK');

    // ========== 契約 ==========
    await client.query(`
      INSERT INTO contracts (id, partner_id, company_code, categories, status) VALUES
        ('CNT-001', 'PN001', 'TAMJ', '["部屋・共用部の家具・家電", "厨房・食事の道具", "介護医療・お風呂の道具"]', 'active'),
        ('CNT-002', 'PN002', 'TAMJ', '["建物・外まわり"]', 'active'),
        ('CNT-003', 'PN003', 'TAMJ', '["通信・呼出し・防火の機器"]', 'active')
      ON CONFLICT (id) DO NOTHING
    `);
    console.log('[SEED] 契約データ OK');

    await client.query('COMMIT');
    console.log('[SEED] 全データ投入完了');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[SEED] エラー:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await db.pool.end();
  }
}

seed();
