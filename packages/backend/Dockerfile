FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
COPY packages/backend/package.json ./packages/backend/
COPY pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --filter @royalchess/backend...

# Build
FROM deps AS build
COPY packages/backend/ ./packages/backend/
RUN cd packages/backend && npx prisma generate && pnpm build

# Run
FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app/packages/backend
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/backend/dist ./dist
COPY --from=build /app/packages/backend/prisma ./prisma
COPY --from=build /app/packages/backend/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/packages/backend/node_modules/@prisma ./node_modules/@prisma
RUN npx prisma generate

EXPOSE 3001
CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/index.js"]
