# =============================================
# ワンタッチ管理システム Dockerfile
# Phase 1: Lightsail で直接実行
# Phase 3: ECS Fargate でそのまま使用
# =============================================

FROM node:20-alpine

WORKDIR /app

# 依存関係インストール（キャッシュ活用）
COPY server/package.json server/package-lock.json* ./server/
RUN cd server && npm ci --production

# アプリケーションコード
COPY server/ ./server/
COPY public/ ./public/

# ヘルスチェック
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget -qO- http://localhost:3000/api/auth/me || exit 1

EXPOSE 3000

CMD ["node", "server/index.js"]
