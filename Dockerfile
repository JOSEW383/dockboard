# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --ignore-scripts

COPY . .

# Provide a minimal valid config so the build doesn't fail
# (the real config.yml is volume-mounted at runtime)
RUN echo "title: Dockboard\nsections: []" > config.yml

RUN npm run build

# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./

# Config and icons are mounted as volumes at runtime.
# These env vars tell the app exactly where to find them.
ENV HOST=0.0.0.0
ENV PORT=4321
ENV CONFIG_PATH=/app/config.yml
ENV ICONS_PATH=/app/icons

# Create default mount-point directories so the container
# starts cleanly even if volumes are not mounted
RUN mkdir -p /app/icons && \
    printf 'title: Dockboard\nsubtitle: Mount your config.yml volume\nsections: []\n' > /app/config.yml

EXPOSE 4321

CMD ["node", "./dist/server/entry.mjs"]
