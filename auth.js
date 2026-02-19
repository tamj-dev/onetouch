const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * JWT検証ミドルウェア
 * リクエストヘッダーの Authorization: Bearer <token> を検証
 * 検証成功 → req.user にユーザー情報をセット
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '認証が必要です' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'トークンの有効期限が切れています' });
    }
    return res.status(401).json({ error: '無効なトークンです' });
  }
}

/**
 * JWTトークン生成
 */
function generateToken(user) {
  const payload = {
    id: user.id,
    name: user.name,
    role: user.role,
    companyCode: user.company_code,
    companyName: user.company_name,
    officeCode: user.office_code,
    officeName: user.office_name,
  };

  return jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN,
  });
}

module.exports = { authenticate, generateToken };
