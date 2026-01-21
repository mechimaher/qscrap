FROM node:18-alpine

# Install dependencies for Puppeteer/Chromium on Alpine
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

COPY package*.json ./

# Install ALL dependencies (including devDependencies for build)
RUN npm install --include=dev

COPY . .

# Build TypeScript
RUN npm run build

EXPOSE 3000

# Run compiled JavaScript in production
CMD ["npm", "run", "start"]
