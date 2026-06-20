FROM node:20-alpine AS builder
WORKDIR /app

# Enable pnpm via corepack (matches packageManager field)
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

# Build-time env vars (Coolify passes these as --build-arg)
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ARG NEXT_PUBLIC_WS_URL=ws://localhost:3001
ARG NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=$NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID

# Copy workspace config & lockfile first (for better caching)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/frontend/package.json ./packages/frontend/package.json

# Install deps
RUN pnpm install --frozen-lockfile

# Copy source & build
COPY packages/frontend ./packages/frontend
RUN cd packages/frontend && pnpm run build

# ─── Runtime ────────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

RUN corepack enable

COPY --from=builder /app/packages/frontend/.next ./.next
COPY --from=builder /app/packages/frontend/public ./public
COPY --from=builder /app/packages/frontend/node_modules ./node_modules
COPY --from=builder /app/packages/frontend/package.json ./
COPY --from=builder /app/packages/frontend/next.config.js ./

EXPOSE 3000
CMD ["pnpm", "start"]
