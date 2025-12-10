# syntax=docker/dockerfile:1

FROM node:24-alpine AS base

# Install corepack for yarn berry
RUN corepack enable

WORKDIR /app

# Copy root package files for workspace setup
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn ./.yarn
COPY apps/api/package.json ./apps/api/

# Install dependencies
RUN yarn install

# Copy source files
COPY tsconfig.json ./
COPY apps/api ./apps/api

# Build
RUN yarn workspace @gemindex/api build

# Production stage
FROM node:24-alpine AS production

RUN corepack enable

WORKDIR /app

# Copy root package files
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn ./.yarn
COPY apps/api/package.json ./apps/api/

# Install production dependencies only
RUN yarn workspaces focus @gemindex/api --production

# Copy built files
COPY --from=base /app/apps/api/dist ./apps/api/dist

WORKDIR /app/apps/api

ENV NODE_ENV=production
ENV PORT=4000

EXPOSE 4000

CMD ["node", "dist/index.js"]
