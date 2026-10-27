# syntax=docker/dockerfile:1
# Finding with Nemo: one image that serves the built client and the API (server.ts).
#
#   docker build -t nemo \
#     --build-arg VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co \
#     --build-arg VITE_SUPABASE_ANON_KEY=YOUR-PUBLISHABLE-KEY \
#     --build-arg GOOGLE_MAPS_PLATFORM_KEY=YOUR-BROWSER-MAPS-KEY .
#
# Build args are public by design (they end up in the browser bundle): the Supabase publishable key and a Maps key
# restricted to your domain. Every secret (Nebius, Tavily, encryption key, server Maps key) is passed at run time.

FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG GOOGLE_MAPS_PLATFORM_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY \
    GOOGLE_MAPS_PLATFORM_KEY=$GOOGLE_MAPS_PLATFORM_KEY
RUN npm run build

FROM node:22-slim AS runtime
ENV NODE_ENV=production PORT=3000
WORKDIR /app
# Only the six packages dist/server.cjs requires at run time (about 54 MB), not the whole build toolchain.
COPY --from=build /app/package.json ./package.full.json
COPY --from=build /app/scripts/runtime-package.mjs ./runtime-package.mjs
RUN node runtime-package.mjs package.full.json package.json \
 && npm install --omit=dev --no-audit --no-fund \
 && rm package.full.json runtime-package.mjs
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/server.cjs"]
