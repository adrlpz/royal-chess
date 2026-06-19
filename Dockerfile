FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

# ─── Install Dependencies ───────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/backend/package.json ./packages/backend/
COPY packages/frontend/package.json ./packages/frontend/
RUN pnpm install --ignore-scripts

# ─── Build Backend ───────────────────────────────────────────────
FROM deps AS backend-build
COPY packages/backend/ ./packages/backend/
RUN cd packages/backend && npx prisma generate && ./node_modules/.bin/tsc

# ─── Build Frontend ──────────────────────────────────────────────
FROM deps AS frontend-build
COPY packages/frontend/ ./packages/frontend/
RUN cd packages/frontend && ./node_modules/.bin/next build

# ─── Backend Runtime ────────────────────────────────────────────
FROM node:20-alpine AS backend
RUN corepack enable && corepack prepare pnpm@9 --activate
ENV NODE_ENV=production
WORKDIR /app/packages/backend
COPY --from=deps /app/node_modules /app/node_modules
COPY --from=backend-build /app/packages/backend/dist ./dist
COPY --from=backend-build /app/packages/backend/prisma ./prisma
COPY --from=backend-build /app/packages/backend/package.json ./
EXPOSE 3001
CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/index.js"]

# ─── Frontend Runtime ───────────────────────────────────────────
FROM node:20-alpine AS frontend
ENV NODE_ENV=production
WORKDIR /app/packages/frontend
COPY --from=deps /app/node_modules /app/node_modules
COPY --from=frontend-build /app/packages/frontend/.next ./.next
COPY --from=frontend-build /app/packages/frontend/public ./public
COPY --from=frontend-build /app/packages/frontend/package.json ./
COPY --from=frontend-build /app/packages/frontend/next.config.js ./
EXPOSE 3000
CMD ["npx", "next", "start"]
