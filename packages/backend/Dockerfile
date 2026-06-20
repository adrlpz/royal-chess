FROM node:20-alpine AS builder
WORKDIR /app

# Enable pnpm via corepack (matches packageManager field)
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

# Copy ALL workspace package.json files + lockfile (workspace: packages/*)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/backend/package.json ./packages/backend/package.json
COPY packages/frontend/package.json ./packages/frontend/package.json

# Install deps & generate prisma
COPY packages/backend/prisma ./packages/backend/prisma
RUN pnpm install --frozen-lockfile
RUN cd packages/backend && npx prisma generate

# Copy source & build
COPY packages/backend/src ./packages/backend/src
COPY packages/backend/tsconfig.json ./packages/backend/tsconfig.json
RUN cd packages/backend && pnpm run build

# ─── Runtime ────────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

RUN corepack enable

COPY --from=builder /app/packages/backend/dist ./dist
COPY --from=builder /app/packages/backend/prisma ./prisma
COPY --from=builder /app/packages/backend/node_modules ./node_modules
COPY --from=builder /app/packages/backend/package.json ./

EXPOSE 3001
CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/index.js"]
