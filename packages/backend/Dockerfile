FROM node:20-alpine AS builder
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9.15.4

# Copy workspace config & lockfile
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/backend/package.json ./packages/backend/package.json
COPY packages/frontend/package.json ./packages/frontend/package.json

# Install deps & generate prisma
COPY packages/backend/prisma ./packages/backend/prisma
RUN pnpm install --frozen-lockfile 2>&1 || (echo "=== frozen-lockfile failed, retrying ===" && pnpm install)
RUN cd packages/backend && npx prisma generate

# Copy source & build
COPY packages/backend/src ./packages/backend/src
COPY packages/backend/tsconfig.json ./packages/backend/tsconfig.json
RUN cd packages/backend && pnpm run build

# ─── Runtime ────────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

RUN npm install -g pnpm@9.15.4

COPY --from=builder /app/packages/backend/dist ./dist
COPY --from=builder /app/packages/backend/prisma ./prisma
COPY --from=builder /app/packages/backend/node_modules ./node_modules
COPY --from=builder /app/packages/backend/package.json ./

EXPOSE 3001
CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/index.js"]
