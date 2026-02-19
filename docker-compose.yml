# ローカル開発用 docker-compose
# 使い方: docker-compose up -d
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://onetouch:onetouch@db:5432/onetouch
      - JWT_SECRET=dev-secret-change-in-production
    depends_on:
      db:
        condition: service_healthy
    volumes:
      - ./server:/app/server
      - ./public:/app/public

  db:
    image: postgres:15-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: onetouch
      POSTGRES_PASSWORD: onetouch
      POSTGRES_DB: onetouch
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./server/db/schema.sql:/docker-entrypoint-initdb.d/01_schema.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U onetouch"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  pgdata:
