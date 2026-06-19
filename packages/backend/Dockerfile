FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/backend/package.json ./packages/backend/
COPY packages/frontend/package.json ./packages/frontend/
RUN pnpm install --no-frozen-lockfile

# Build backend
FROM deps AS build
COPY packages/backend/ ./packages/backend/
RUN cd packages/backend && npx prisma generate && pnpm build

# Run
FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app/packages/backend
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/packages/backend/dist ./dist
COPY --from=build /app/packages/backend/prisma ./prisma

EXPOSE 3001
CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/index.js"]
