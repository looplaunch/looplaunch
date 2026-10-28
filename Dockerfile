# ─────────────────────────────────────────────────────────
# Loop Launch Next.js Web App — Render Production Dockerfile
# ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package manifests from looplaunch-app subdirectory
COPY looplaunch-app/package.json looplaunch-app/package-lock.json* ./

# Install all dependencies
RUN npm install

# Copy application source
COPY looplaunch-app/ ./

# Disable Next.js telemetry
ENV NEXT_TELEMETRY_DISABLED=1

# NEXT_PUBLIC_* values are baked into the browser bundle at build time. Render only passes
# environment variables into a Docker build when they are declared here as build args.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=$NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION

# Build the Next.js production bundle
RUN npm run build

# ─── Production Runner ───
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Copy entire application and build output
COPY --from=builder /app ./

EXPOSE 3000

# Start Next.js bound to 0.0.0.0 with dynamic PORT support for Render
CMD ["sh", "-c", "npx next start -p ${PORT:-3000} -H 0.0.0.0"]
