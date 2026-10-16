# Multi-stage Dockerfile for Autonomous Operations Specialist Backend
FROM node:20-alpine AS builder

WORKDIR /app

# Copy server package definitions
COPY package*.json tsconfig.json ./
RUN npm install

# Copy source and build
COPY src ./src
RUN npm run build

# Production runtime stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5001

COPY package*.json ./
RUN npm install --only=production

COPY --from=builder /app/dist ./dist

EXPOSE 5001

CMD ["node", "dist/server.js"]
