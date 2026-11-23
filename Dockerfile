FROM node:22-slim

WORKDIR /app

# Copy package files first for layer caching
COPY package*.json ./

# Install all deps (including dev — needed for tsx)
RUN npm ci

# Copy source
COPY . .

# Fly assigns PORT env var — server reads it via process.env.PORT
EXPOSE 8080

CMD ["npx", "tsx", "server/index.ts"]
