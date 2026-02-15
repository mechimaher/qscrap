# ========================================
# Stage 1: Build
# ========================================
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./

# Install ALL dependencies (including devDependencies for TypeScript build)
RUN npm ci --include=dev

COPY . .

# Build TypeScript
RUN npm run build

# ========================================
# Stage 2: Production
# ========================================
FROM node:18-alpine

# Install dependencies for Puppeteer/Chromium on Alpine (needed for invoice PDFs)
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Tell Puppeteer to skip installing Chrome. We'll be using the installed package.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app

# Copy package files and install production-only dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled JavaScript from builder
COPY --from=builder /app/dist ./dist

# Copy public assets and static files
COPY --from=builder /app/public ./public

# Copy migration runner and SQL files (for npm run db:migrate)
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/src/config/migrations ./src/config/migrations

# Create persistent storage directories and set permissions
RUN mkdir -p /app/uploads /app/logs && \
    chown -R node:node /app/uploads /app/logs

# Switch to non-root user for security
USER node

EXPOSE 3000

# Run compiled JavaScript in production
CMD ["npm", "run", "start"]
