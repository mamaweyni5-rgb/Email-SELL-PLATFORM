FROM node:22 AS base

WORKDIR /app

COPY package.json ./
COPY artifacts/main-app/package.json artifacts/main-app/package.json
COPY artifacts/api-server/package.json artifacts/api-server/package.json
COPY artifacts/mockup-sandbox/package.json artifacts/mockup-sandbox/package.json
COPY lib/api-client-react/package.json lib/api-client-react/package.json
COPY lib/api-zod/package.json lib/api-zod/package.json
COPY lib/db/package.json lib/db/package.json
COPY lib/api-spec/package.json lib/api-spec/package.json
COPY scripts/package.json scripts/package.json
COPY tsconfig.json tsconfig.base.json ./

RUN find . -name "package.json" -not -path "*/node_modules/*" \
    -exec sed -i 's/"workspace:\*"/"*"/g' {} \;

RUN npm install --legacy-peer-deps

COPY lib/ ./lib/
COPY artifacts/ ./artifacts/
COPY scripts/ ./scripts/

RUN npm run build -w @workspace/main-app > /tmp/main-build.log 2>&1 || \
    (echo "=== MAIN-APP BUILD FAILED ===" && cat /tmp/main-build.log && exit 1)

RUN npm run build -w @workspace/api-server > /tmp/api-build.log 2>&1 || \
    (echo "=== API-SERVER BUILD FAILED ===" && cat /tmp/api-build.log && exit 1)

FROM node:22-slim AS runner

WORKDIR /app

COPY --from=base /app/node_modules ./node_modules
COPY package.json ./

COPY --from=base /app/artifacts/api-server/dist ./artifacts/api-server/dist
COPY --from=base /app/artifacts/main-app/dist ./artifacts/main-app/dist

ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "--enable-source-maps", "./artifacts/api-server/dist/index.mjs"]
