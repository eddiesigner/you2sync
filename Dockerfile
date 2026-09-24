# syntax=docker/dockerfile:1

FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# The Nitro output is self-contained: no node_modules install needed.
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    NUXT_DATABASE_PATH=/data/you2sync.db
COPY --from=build --chown=node:node /app/.output ./.output
RUN mkdir /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 3000
CMD ["node", "--max-old-space-size=192", ".output/server/index.mjs"]
