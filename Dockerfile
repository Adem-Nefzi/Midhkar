# Midhkar render service — HF Spaces (Docker SDK)
# 2 vCPU / 16GB free tier. ffmpeg via apt (has libx264 under GPL).
FROM node:20-slim

# ffmpeg (Debian's build includes libx264) + fontconfig for canvas
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg fontconfig && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /srv

# Deps first (layer cache)
COPY render-service/package.json render-service/package-lock.json* ./
RUN npm install --no-audit --no-fund

# App code + bundled fonts
COPY render-service/src ./src
COPY render-service/tsconfig.json ./
RUN fc-cache -f 2>/dev/null || true

ENV PORT=7860
ENV NODE_ENV=production

EXPOSE 7860

# tsx runs TS directly; keep it (the service is small enough that a
# separate build step isn't worth the complexity)
CMD ["npx", "tsx", "src/server.ts"]
