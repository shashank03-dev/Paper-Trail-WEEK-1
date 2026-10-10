# Paper Trail web app — multi-stage, Next.js standalone output.
FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Only the public address is needed at build time (absolute link-preview URLs).
# Keys are runtime-only and never passed to the build.
ARG PUBLIC_URL
ENV NEXT_TELEMETRY_DISABLED=1 NEXT_OUTPUT=standalone PUBLIC_URL=$PUBLIC_URL
RUN pnpm build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S app -G app
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/fixtures/places ./fixtures/places
COPY --from=build /app/fixtures/weather ./fixtures/weather
COPY --from=build /app/fixtures/llm ./fixtures/llm
# Fonts for the link-preview images (next/og reads them from disk).
COPY --from=build /app/lib/og ./lib/og
RUN mkdir -p .cache && chown -R app:app .cache
USER app
EXPOSE 3000
CMD ["node", "server.js"]
