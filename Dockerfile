FROM node:20-alpine

RUN npm install -g pnpm@9

WORKDIR /app

# Copy workspace root config files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy all workspace packages
COPY artifacts/api-server/ ./artifacts/api-server/
COPY lib/ ./lib/

# Install dependencies from workspace root
RUN pnpm install --frozen-lockfile --ignore-scripts

# Build the API server
RUN pnpm --filter @workspace/api-server run build

EXPOSE 8080

CMD ["node", "--enable-source-maps", "./artifacts/api-server/dist/index.mjs"]
