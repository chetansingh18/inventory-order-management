# syntax=docker/dockerfile:1

# ---------- Build stage ----------
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Optional: bake an absolute API base URL into the bundle for split
# deployments. Leave empty to use the relative "/api" path proxied by nginx.
ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

# ---------- Runtime stage ----------
FROM nginx:1.27-alpine

# The official nginx image runs envsubst over templates at startup, so
# ${BACKEND_URL} in the config is filled from the environment.
ENV BACKEND_URL=http://backend:8000
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
