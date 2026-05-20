FROM node:22-slim AS base

RUN corepack enable && corepack prepare pnpm@10.26.1 --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY lib/ ./lib/
COPY artifacts/ ./artifacts/
COPY tsconfig.json ./

RUN sed -i 's/minimumReleaseAge: 1440/minimumReleaseAge: 0/' pnpm-workspace.yaml && \
    pnpm install --frozen-lockfile

RUN PORT=3000 BASE_PATH=/ pnpm --filter @workspace/main-app run build

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
