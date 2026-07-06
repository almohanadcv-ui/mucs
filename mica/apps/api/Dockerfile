FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml package.json ./
COPY packages/config/package.json packages/config/
COPY packages/shared-types/package.json packages/shared-types/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @mica-mab/api...

FROM base AS build
COPY --from=deps /repo /repo
COPY packages/config packages/config
COPY packages/shared-types packages/shared-types
COPY apps/api apps/api
RUN pnpm --filter @mica-mab/shared-types build
RUN pnpm --filter @mica-mab/api prisma:generate
RUN pnpm --filter @mica-mab/api build

FROM node:20-alpine AS runtime
RUN corepack enable
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=build /repo /repo
WORKDIR /repo/apps/api
EXPOSE 4000
CMD ["node", "dist/main.js"]
