# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/
COPY public ./public/

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma Client with a dummy DATABASE_URL for build time
# This is only needed for TypeScript compilation
ENV DATABASE_URL="postgresql://dummy:dummy@dummy:5432/dummy?schema=public"
RUN npm run prisma:generate

# Build application
RUN npm run build

# Production stage
FROM node:18-alpine AS production

WORKDIR /app

# Install system Chromium for Puppeteer
RUN apk add --no-cache chromium nss freetype ttf-freefont
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install production dependencies only
RUN npm ci --only=production
# Install ts-node for runtime seed if dist seed is absent
RUN npm install ts-node

# Copy built application from builder
COPY --from=builder /app/dist ./dist
# Copy public assets (e.g., logo.png) from builder
COPY --from=builder /app/public ./public

# Verify dist folder was copied
RUN ls -la /app/dist && echo "✅ dist folder copied successfully"

# Copy startup scripts
COPY start.sh ./
COPY migrate-and-start.sh ./
RUN chmod +x start.sh migrate-and-start.sh

# Create uploads directory
RUN mkdir -p uploads

# Expose port (Railway will override this with $PORT)
EXPOSE 3001

# Health check - uses PORT environment variable for Railway compatibility
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 3001) + '/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application via migration + seed helper
CMD ["./migrate-and-start.sh"]

