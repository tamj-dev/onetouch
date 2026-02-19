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
        ('PN001', 'PN001', 'TAMJ建設', '山田 太郎', '["建物・外まわり","部屋・共用部の家具・家電","介護医療・お風呂の道具","厨房・食事の道具","通信・呼出し・防火の機器"]', 'active'),
        ('PN002', 'PN002', 'ACタムジ', '青木 一郎', '["建物・外まわり"]', 'active'),
        ('PN003', 'PN003', 'EVタムジ', '江藤 健太', '["建物・外まわり"]', 'active'),
        ('PN004', 'PN004', 'タムタム家具', '田村 美咲', '["部屋・共用部の家具・家電","介護医療・お風呂の道具","厨房・食事の道具","通信・呼出し・防火の機器"]', 'active'),
        ('PN005', 'PN005', 'リネンTAMJ', '林 誠', '["部屋・共用部の家具・家電"]', 'active'),
        ('PN006', 'PN006', '福たむ', '福田 裕子', '["部屋・共用部の家具・家電","介護医療・お風呂の道具","厨房・食事の道具"]', 'active'),
        ('PN007', 'PN007', 'AEDタム', '安藤 大輔', '["介護医療・お風呂の道具"]', 'active'),
        ('PN008', 'PN008', 'お掃除タムタム', '大島 春菜', '["厨房・食事の道具"]', 'active'),
        ('PN009', 'PN009', 'キッチンタムジ', '北村 和也', '["厨房・食事の道具"]', 'active'),
        ('PN010', 'PN010', 'タムネット', '中田 翔', '["通信・呼出し・防火の機器"]', 'active'),
        ('PN011', 'PN011', 'タム電気', '堂本 光', '["通信・呼出し・防火の機器"]', 'active'),
        ('PN012', 'PN012', 'タムセキュリティ', '関口 武', '["通信・呼出し・防火の機器"]', 'active'),
        ('PN013', 'PN013', '介護タム', '加藤 優', '["通信・呼出し・防火の機器"]', 'active'),
        ('PN014', 'PN014', 'Nタムタム', '西村 拓', '["通信・呼出し・防火の機器"]', 'active'),
        ('PN015', 'PN015', 'タムコール', '小林 恵', '["通信・呼出し・防火の機器"]', 'active')
      ON CONFLICT (id) DO NOTHING
    `);
    console.log('[SEED] 管理会社データ OK');

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
        ('CNT-TAMJ-001', 'PN001', 'TAMJ', '["建物・外まわり","部屋・共用部の家具・家電","介護医療・お風呂の道具","厨房・食事の道具","通信・呼出し・防火の機器"]', 'active'),
        ('CNT-TAMJ-002', 'PN002', 'TAMJ', '["建物・外まわり"]', 'active'),
        ('CNT-TAMJ-003', 'PN003', 'TAMJ', '["建物・外まわり"]', 'active'),
        ('CNT-TAMJ-004', 'PN004', 'TAMJ', '["部屋・共用部の家具・家電","介護医療・お風呂の道具","厨房・食事の道具","通信・呼出し・防火の機器"]', 'active'),
        ('CNT-TAMJ-005', 'PN005', 'TAMJ', '["部屋・共用部の家具・家電"]', 'active'),
        ('CNT-TAMJ-006', 'PN006', 'TAMJ', '["部屋・共用部の家具・家電","介護医療・お風呂の道具","厨房・食事の道具"]', 'active'),
        ('CNT-TAMJ-007', 'PN007', 'TAMJ', '["介護医療・お風呂の道具"]', 'active'),
        ('CNT-TAMJ-008', 'PN008', 'TAMJ', '["厨房・食事の道具"]', 'active'),
        ('CNT-TAMJ-009', 'PN009', 'TAMJ', '["厨房・食事の道具"]', 'active'),
        ('CNT-TAMJ-010', 'PN010', 'TAMJ', '["通信・呼出し・防火の機器"]', 'active'),
        ('CNT-TAMJ-011', 'PN011', 'TAMJ', '["通信・呼出し・防火の機器"]', 'active'),
        ('CNT-TAMJ-012', 'PN012', 'TAMJ', '["通信・呼出し・防火の機器"]', 'active'),
        ('CNT-TAMJ-013', 'PN013', 'TAMJ', '["通信・呼出し・防火の機器"]', 'active'),
        ('CNT-TAMJ-014', 'PN014', 'TAMJ', '["通信・呼出し・防火の機器"]', 'active'),
        ('CNT-TAMJ-015', 'PN015', 'TAMJ', '["通信・呼出し・防火の機器"]', 'active')
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
