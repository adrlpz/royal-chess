FROM node:20 AS builder
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9.15.4

# Build-time env vars (Coolify passes these as --build-arg)
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ARG NEXT_PUBLIC_WS_URL=ws://localhost:3001
ARG NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=$NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID

# Copy workspace config & lockfile
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/backend/package.json ./packages/backend/package.json
COPY packages/frontend/package.json ./packages/frontend/package.json

# Install deps
RUN pnpm install --frozen-lockfile

# Copy source & build
COPY packages/frontend ./packages/frontend
RUN cd packages/frontend && pnpm run build

# ─── Runtime ────────────────────────────────────────────────────
FROM node:20-slim
WORKDIR /app

COPY --from=builder /app/packages/frontend/.next ./.next
COPY --from=builder /app/packages/frontend/public ./public
COPY --from=builder /app/packages/frontend/node_modules ./node_modules
COPY --from=builder /app/packages/frontend/package.json ./
COPY --from=builder /app/packages/frontend/next.config.js ./

EXPOSE 3000
CMD ["pnpm", "start"]
