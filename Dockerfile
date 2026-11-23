FROM node:22-slim

WORKDIR /app

# Copy package files first for layer caching
COPY package*.json ./

# Install deps and compile server TypeScript cleanly for fast container cold starts
RUN npm ci

# Copy source
COPY . .

RUN npm run build:server

# Fly assigns PORT env var — server reads it via process.env.PORT
EXPOSE 3001

CMD ["node", "dist-server/server/index.js"]
