FROM node:20-alpine

RUN npm install -g pnpm@9

WORKDIR /app

# Copy workspace root config files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc tsconfig.json tsconfig.base.json ./

# Copy all workspace packages needed
COPY artifacts/api-server/ ./artifacts/api-server/
COPY artifacts/voiceover-tool/ ./artifacts/voiceover-tool/
COPY lib/ ./lib/

# Install dependencies
RUN pnpm install --no-frozen-lockfile --ignore-scripts

# Build frontend first
RUN pnpm --filter @workspace/voiceover-tool run build

# Build API server
RUN pnpm --filter @workspace/api-server run build

ENV NODE_ENV=production

EXPOSE 8080

CMD ["node", "--enable-source-maps", "./artifacts/api-server/dist/index.mjs"]
