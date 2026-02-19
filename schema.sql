-- =============================================
-- ワンタッチ管理システム データベーススキーマ
-- PostgreSQL 15+
-- =============================================

-- 拡張機能
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- 1. 会社テーブル
-- =============================================
CREATE TABLE companies (
    code        VARCHAR(20) PRIMARY KEY,
    name        VARCHAR(200) NOT NULL,
    postal_code VARCHAR(10),
    prefecture  VARCHAR(20),
    address     TEXT,
    phone       VARCHAR(20),
    fax         VARCHAR(20),
    email       VARCHAR(200),
    logo_url    TEXT,
    status      VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 2. 事業所テーブル
-- =============================================
CREATE TABLE offices (
    code          VARCHAR(30) PRIMARY KEY,
    company_code  VARCHAR(20) NOT NULL REFERENCES companies(code) ON DELETE CASCADE,
    name          VARCHAR(200) NOT NULL,
    service_type  VARCHAR(100),
    postal_code   VARCHAR(10),
    prefecture    VARCHAR(20),
    address       TEXT,
    phone         VARCHAR(20),
    fax           VARCHAR(20),
    email         VARCHAR(200),
    building      VARCHAR(200),
    notes         TEXT,
    status        VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_offices_company ON offices(company_code);

-- =============================================
-- 3. アカウントテーブル
-- =============================================
CREATE TABLE accounts (
    id              VARCHAR(100) PRIMARY KEY,
    company_code    VARCHAR(20) NOT NULL REFERENCES companies(code) ON DELETE CASCADE,
    office_code     VARCHAR(30) REFERENCES offices(code) ON DELETE SET NULL,
    name            VARCHAR(100) NOT NULL,
    role            VARCHAR(20) NOT NULL CHECK (role IN ('staff', 'office_admin', 'company_admin', 'system_admin')),
    password_hash   VARCHAR(200) NOT NULL,
    office_name     VARCHAR(200),
    company_name    VARCHAR(200),
    status          VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    is_first_login  BOOLEAN DEFAULT TRUE,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_accounts_company ON accounts(company_code);
CREATE INDEX idx_accounts_office ON accounts(office_code);
CREATE INDEX idx_accounts_role ON accounts(company_code, role);

-- =============================================
-- 4. 業者テーブル
-- =============================================
CREATE TABLE partners (
    id              VARCHAR(20) PRIMARY KEY,
    partner_code    VARCHAR(20) UNIQUE NOT NULL,
    name            VARCHAR(200) NOT NULL,
    phone           VARCHAR(20),
    email           VARCHAR(200),
    address         TEXT,
    contact_name    VARCHAR(100),
    categories      JSONB DEFAULT '[]',
    status          VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 5. 業者担当者テーブル
-- =============================================
CREATE TABLE partner_contacts (
    id              SERIAL PRIMARY KEY,
    partner_id      VARCHAR(20) NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,
    login_id        VARCHAR(100) UNIQUE NOT NULL,
    password_hash   VARCHAR(200) NOT NULL,
    phone           VARCHAR(20),
    is_main         BOOLEAN DEFAULT FALSE,
    status          VARCHAR(20) DEFAULT 'active',
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_partner_contacts_partner ON partner_contacts(partner_id);
CREATE INDEX idx_partner_contacts_login ON partner_contacts(login_id);

-- =============================================
-- 6. 契約テーブル
-- =============================================
CREATE TABLE contracts (
    id              VARCHAR(30) PRIMARY KEY,
    partner_id      VARCHAR(20) NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
    company_code    VARCHAR(20) NOT NULL REFERENCES companies(code) ON DELETE CASCADE,
    office_code     VARCHAR(30) REFERENCES offices(code) ON DELETE SET NULL,
    categories      JSONB DEFAULT '[]',
    status          VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'expired')),
    start_date      DATE,
    end_date        DATE,
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_contracts_company ON contracts(company_code);
CREATE INDEX idx_contracts_partner ON contracts(partner_id);
CREATE INDEX idx_contracts_lookup ON contracts(company_code, status);

-- =============================================
-- 7. 商品（設備）テーブル
-- =============================================
CREATE TABLE items (
    item_id             VARCHAR(50) PRIMARY KEY,
    company_code        VARCHAR(20) NOT NULL REFERENCES companies(code) ON DELETE CASCADE,
    office_code         VARCHAR(30) NOT NULL REFERENCES offices(code) ON DELETE CASCADE,
    name                VARCHAR(300) NOT NULL,
    category            VARCHAR(50),
    maker               VARCHAR(200),
    model               VARCHAR(200),
    unit                VARCHAR(20),
    price               INTEGER DEFAULT 0,
    stock               INTEGER DEFAULT 0,
    description         TEXT,
    floor               VARCHAR(50),
    location            VARCHAR(200),
    assigned_partner_id   VARCHAR(20) REFERENCES partners(id) ON DELETE SET NULL,
    assigned_partner_name VARCHAR(200),
    status              VARCHAR(20) DEFAULT 'active',
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- 4万施設×3,000件 = 1.2億件を想定したインデックス
CREATE INDEX idx_items_office ON items(company_code, office_code);
CREATE INDEX idx_items_category ON items(company_code, office_code, category);
CREATE INDEX idx_items_search ON items(company_code, office_code, name varchar_pattern_ops);

-- =============================================
-- 8. 通報テーブル
-- =============================================
CREATE TABLE reports (
    id                      VARCHAR(50) PRIMARY KEY,
    company_code            VARCHAR(20) NOT NULL REFERENCES companies(code) ON DELETE CASCADE,
    office_code             VARCHAR(30) NOT NULL REFERENCES offices(code) ON DELETE CASCADE,
    item_id                 VARCHAR(50) REFERENCES items(item_id) ON DELETE SET NULL,
    type                    VARCHAR(30) DEFAULT 'report',
    title                   VARCHAR(300) NOT NULL,
    category                VARCHAR(50),
    description             TEXT,
    location                VARCHAR(200),
    status                  VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    assigned_partner_id     VARCHAR(20) REFERENCES partners(id) ON DELETE SET NULL,
    assigned_partner_name   VARCHAR(200),
    reporter_id             VARCHAR(100),
    reporter_name           VARCHAR(100),
    completed_at            TIMESTAMPTZ,
    contractor_memo         TEXT,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reports_office ON reports(company_code, office_code, status);
CREATE INDEX idx_reports_partner ON reports(assigned_partner_id, status);
CREATE INDEX idx_reports_date ON reports(company_code, created_at DESC);

-- =============================================
-- 9. 通報写真テーブル
-- =============================================
CREATE TABLE report_photos (
    id          SERIAL PRIMARY KEY,
    report_id   VARCHAR(50) NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    s3_key      TEXT NOT NULL,
    file_name   VARCHAR(300),
    file_size   INTEGER,
    mime_type   VARCHAR(100),
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_report_photos_report ON report_photos(report_id);

-- =============================================
-- 10. 監査ログテーブル
-- =============================================
CREATE TABLE audit_logs (
    id              BIGSERIAL PRIMARY KEY,
    company_code    VARCHAR(20),
    office_code     VARCHAR(30),
    user_id         VARCHAR(100),
    user_name       VARCHAR(100),
    action          VARCHAR(100) NOT NULL,
    target_type     VARCHAR(50),
    target_id       VARCHAR(100),
    details         JSONB,
    ip_address      VARCHAR(45),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_company_date ON audit_logs(company_code, created_at DESC);

-- =============================================
-- 11. セットアップ進捗テーブル
-- =============================================
CREATE TABLE setups (
    id              VARCHAR(50) PRIMARY KEY,
    company_code    VARCHAR(20) NOT NULL REFERENCES companies(code) ON DELETE CASCADE,
    current_step    INTEGER DEFAULT 1,
    data            JSONB DEFAULT '{}',
    created_by      VARCHAR(100),
    status          VARCHAR(20) DEFAULT 'in_progress',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 12. カテゴリマスタテーブル（仕様変更に強い構造）
-- =============================================
CREATE TABLE categories (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL UNIQUE,
    sort_order  INTEGER DEFAULT 0,
    is_system   BOOLEAN DEFAULT TRUE,
    status      VARCHAR(20) DEFAULT 'active',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 初期データ（5大分類+その他）
INSERT INTO categories (name, sort_order, is_system) VALUES
    ('建物・外まわり', 1, TRUE),
    ('部屋・共用部の家具・家電', 2, TRUE),
    ('介護医療・お風呂の道具', 3, TRUE),
    ('厨房・食事の道具', 4, TRUE),
    ('通信・呼出し・防火の機器', 5, TRUE),
    ('その他', 99, TRUE);

-- =============================================
-- 13. システム設定テーブル
-- =============================================
CREATE TABLE system_settings (
    key         VARCHAR(100) PRIMARY KEY,
    value       JSONB,
    updated_by  VARCHAR(100),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 更新日時の自動更新トリガー
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_companies_updated BEFORE UPDATE ON companies FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_offices_updated BEFORE UPDATE ON offices FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_accounts_updated BEFORE UPDATE ON accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_partners_updated BEFORE UPDATE ON partners FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_contracts_updated BEFORE UPDATE ON contracts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_items_updated BEFORE UPDATE ON items FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_reports_updated BEFORE UPDATE ON reports FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_setups_updated BEFORE UPDATE ON setups FOR EACH ROW EXECUTE FUNCTION update_updated_at();
