const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const config = require('./config');

const app = express();

// ========== ミドルウェア ==========

// セキュリティヘッダー
app.use(helmet({ contentSecurityPolicy: false }));

// CORS（開発時はフロントの別ポートからのアクセスを許可）
app.use(cors({
  origin: config.NODE_ENV === 'development' ? '*' : undefined,
  credentials: true,
}));

// レート制限（API全体）
const limiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW,
  max: config.RATE_LIMIT_MAX,
  message: { error: 'リクエストが多すぎます。しばらく待ってから再試行してください。' },
});
app.use('/api/', limiter);

// ログインはさらに厳しく制限（ブルートフォース対策）
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // 15分に10回まで
  message: { error: 'ログイン試行回数が上限に達しました。15分後に再試行してください。' },
});
app.use('/api/auth/login', loginLimiter);

// JSONパーサー
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// リクエストログ（開発時のみ）
if (config.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
      console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.path}`);
    }
    next();
  });
}

// ========== APIルート ==========
app.use('/api/auth', require('./routes/auth'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/items', require('./routes/items'));

// Phase 2 以降で追加
// app.use('/api/offices', require('./routes/offices'));
// app.use('/api/partners', require('./routes/partners'));
// app.use('/api/contracts', require('./routes/contracts'));
// app.use('/api/accounts', require('./routes/accounts'));

// ========== 静的ファイル（フロントエンド）==========
// public/ に現在のHTML/JS/CSSを配置
app.use(express.static(path.join(__dirname, '..', 'public')));

// SPA対応（APIでないリクエストはindex.htmlを返す）
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  }
});

// ========== エラーハンドリング ==========
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.stack);
  res.status(500).json({ error: 'サーバー内部エラーが発生しました' });
});

// ========== サーバー起動 ==========
app.listen(config.PORT, () => {
  console.log(`
╔═══════════════════════════════════════════╗
║   ワンタッチ管理システム API サーバー     ║
║   Port: ${config.PORT}                            ║
║   Env:  ${config.NODE_ENV.padEnd(30)}  ║
╚═══════════════════════════════════════════╝
  `);
});

module.exports = app;
