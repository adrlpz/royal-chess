FROM node:20-alpine AS base
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/backend/package.json ./packages/backend/
COPY packages/frontend/package.json ./packages/frontend/

# Install pnpm & deps
RUN corepack enable && corepack prepare pnpm@9 --activate
RUN pnpm install 2>&1 || npm install --legacy-peer-deps

# ─── Backend Build ──────────────────────────────────────────────
FROM base AS backend-build
COPY packages/backend/ ./packages/backend/
RUN cd packages/backend && npx prisma generate && npx tsc

# ─── Frontend Build ─────────────────────────────────────────────
FROM base AS frontend-build
COPY packages/frontend/ ./packages/frontend/
RUN cd packages/frontend && npx next build

# ─── Backend Runtime ────────────────────────────────────────────
FROM node:20-alpine AS backend
ENV NODE_ENV=production
WORKDIR /app/packages/backend
COPY --from=backend-build /app/node_modules /app/node_modules
COPY --from=backend-build /app/packages/backend/dist ./dist
COPY --from=backend-build /app/packages/backend/prisma ./prisma
COPY --from=backend-build /app/packages/backend/node_modules ./node_modules 2>/dev/null || true
EXPOSE 3001
CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/index.js"]

# ─── Frontend Runtime ───────────────────────────────────────────
FROM node:20-alpine AS frontend
ENV NODE_ENV=production
WORKDIR /app/packages/frontend
COPY --from=frontend-build /app/packages/frontend/.next ./.next
COPY --from=frontend-build /app/packages/frontend/public ./public
COPY --from=frontend-build /app/packages/frontend/node_modules ./node_modules
COPY --from=frontend-build /app/packages/frontend/package.json ./
COPY --from=frontend-build /app/packages/frontend/next.config.js ./
EXPOSE 3000
CMD ["npx", "next", "start"]
