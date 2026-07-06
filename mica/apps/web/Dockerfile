FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml package.json ./
COPY packages/config/package.json packages/config/
COPY packages/shared-types/package.json packages/shared-types/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter @mica-mab/web...

FROM base AS build
COPY --from=deps /repo /repo
COPY packages/config packages/config
COPY packages/shared-types packages/shared-types
COPY apps/web apps/web
RUN pnpm --filter @mica-mab/shared-types build
RUN pnpm --filter @mica-mab/web build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /repo/apps/web/public ./public
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
EXPOSE 3001
ENV PORT=3001
CMD ["node", "apps/web/server.js"]
