# Midhkar render service
FROM node:20-slim

# FFmpeg + fontconfig for canvas
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg fontconfig && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /srv

# Install render-service dependencies
COPY render-service/package.json render-service/package-lock.json* ./
RUN npm install --no-audit --no-fund

# Copy render service
COPY render-service/src ./src
COPY render-service/tsconfig.json ./

RUN fc-cache -f 2>/dev/null || true

ENV NODE_ENV=production

EXPOSE 10000

CMD ["npx", "tsx", "src/server.ts"]