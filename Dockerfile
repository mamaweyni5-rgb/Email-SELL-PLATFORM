FROM node:22-slim AS base

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.26.1 --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY lib/ ./lib/
COPY artifacts/ ./artifacts/
COPY tsconfig.json ./

RUN sed -i 's/minimumReleaseAge: 1440/minimumReleaseAge: 0/' pnpm-workspace.yaml && \
    pnpm install --frozen-lockfile

RUN node --version && pnpm --version && uname -a

RUN node -e "require('@rollup/rollup-linux-x64-gnu'); console.log('rollup OK')"
RUN node -e "require('@tailwindcss/oxide-linux-x64-gnu'); console.log('oxide OK')"
RUN node -e "require('lightningcss-linux-x64-gnu'); console.log('lightningcss OK')"
RUN node -e "require('esbuild'); console.log('esbuild OK')"

RUN pnpm --filter @workspace/main-app run build > /tmp/vite-build.log 2>&1 || \
    (echo "=== VITE BUILD FAILED - FULL OUTPUT ===" && cat /tmp/vite-build.log && exit 1)

RUN pnpm --filter @workspace/api-server run build

FROM node:22-slim AS runner

WORKDIR /app

COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/artifacts/api-server/node_modules ./artifacts/api-server/node_modules
COPY package.json pnpm-workspace.yaml ./
COPY artifacts/api-server/package.json ./artifacts/api-server/package.json

COPY --from=base /app/artifacts/api-server/dist ./artifacts/api-server/dist
COPY --from=base /app/artifacts/main-app/dist ./artifacts/main-app/dist

ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "--enable-source-maps", "./artifacts/api-server/dist/index.mjs"]
