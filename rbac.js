require('dotenv').config();

module.exports = {
  // サーバー
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',

  // データベース
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://onetouch:onetouch@localhost:5432/onetouch',

  // JWT
  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',

  // AWS S3（Phase 1で使用）
  AWS_REGION: process.env.AWS_REGION || 'ap-northeast-1',
  S3_BUCKET: process.env.S3_BUCKET || 'onetouch-photos',

  // レート制限
  RATE_LIMIT_WINDOW: 15 * 60 * 1000, // 15分
  RATE_LIMIT_MAX: 100, // 15分あたり100リクエスト

  // ページネーション
  DEFAULT_PAGE_SIZE: 30,
  MAX_PAGE_SIZE: 100,
};
