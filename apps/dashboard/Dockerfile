# syntax=docker/dockerfile:1

FROM node:24-alpine AS build

# Install corepack for yarn berry
RUN corepack enable

WORKDIR /app

# Copy root package files for workspace setup
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn ./.yarn
COPY apps/dashboard/package.json ./apps/dashboard/

# Install dependencies
RUN yarn install

# Copy source files
COPY tsconfig.json ./
COPY apps/dashboard ./apps/dashboard

# Build
RUN yarn workspace @gemindex/dashboard build

# Production stage
FROM nginx:alpine AS production

# Copy built files to nginx
COPY --from=build /app/apps/dashboard/dist /usr/share/nginx/html

# Copy nginx config template for SPA routing
COPY apps/dashboard/nginx.conf /etc/nginx/templates/default.conf.template

# Default API URL (can be overridden at runtime)
ENV API_URL=http://api:4000

# Only substitute API_URL, preserve nginx variables
ENV NGINX_ENVSUBST_OUTPUT_DIR=/etc/nginx/conf.d
ENV NGINX_ENVSUBST_TEMPLATE_SUFFIX=.template
ENV NGINX_ENVSUBST_FILTER=API_URL

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
