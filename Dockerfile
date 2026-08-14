# --- Stage 1: build the dashboard (React/Vite) ---
FROM node:18-alpine AS dashboard-build

WORKDIR /dashboard

COPY dashboard/package.json dashboard/package-lock.json* ./
RUN npm install

COPY dashboard/ ./
RUN npm run build

# --- Stage 2: the backend runtime ---
FROM node:18-alpine
RUN apk add --no-cache postgresql16-client

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY src ./src
COPY migrations ./migrations

# The built dashboard is static files — src/index.js serves them from
COPY --from=dashboard-build /dashboard/dist ./dashboard/dist

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "src/index.js"]
