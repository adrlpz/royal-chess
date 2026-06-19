FROM node:20-alpine
WORKDIR /app

# Install deps
COPY package.json ./
COPY prisma ./prisma/
RUN npm install --legacy-peer-deps
RUN npx prisma generate

# Copy source
COPY src ./src/
COPY tsconfig.json ./

EXPOSE 3001
CMD ["sh", "-c", "npx prisma db push --skip-generate && npx tsx src/index.ts"]
