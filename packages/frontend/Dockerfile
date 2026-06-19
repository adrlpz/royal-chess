FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/backend/package.json ./packages/backend/
COPY packages/frontend/package.json ./packages/frontend/
RUN pnpm install --no-frozen-lockfile

# Build frontend
FROM deps AS build
COPY packages/frontend/ ./packages/frontend/
RUN cd packages/frontend && pnpm build

# Run
FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app/packages/frontend
COPY --from=build /app/packages/frontend/.next ./.next
COPY --from=build /app/packages/frontend/public ./public
COPY --from=build /app/packages/frontend/node_modules ./node_modules
COPY --from=build /app/packages/frontend/package.json ./
COPY --from=build /app/packages/frontend/next.config.js ./

EXPOSE 3000
CMD ["pnpm", "start"]
