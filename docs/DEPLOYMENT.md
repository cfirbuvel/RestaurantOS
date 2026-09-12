# RestaurantOS — Master Deployment & Infrastructure Architecture

**Document ID:** `DOC-DEP-001`  
**Version:** `1.0.0`  
**Status:** Approved Deployment Blueprint  

---

## 1. Infrastructure Topology & Cloud Architecture

RestaurantOS is designed for cloud-native deployment on managed Kubernetes (AWS EKS, GCP GKE, or Azure AKS) with multi-zone high availability (HA).

```mermaid
graph TD
    UserTraffic[Incoming User & Webhook Traffic] --> Cloudflare[Cloudflare Edge / DDoS / SSL]
    Cloudflare --> Ingress[NGINX Ingress Controller / AWS ALB]
    
    subgraph Kubernetes Cluster [Production Kubernetes Cluster (EKS / GKE)]
        Ingress --> WebAppPods[Next.js App & UI Pods (Autoscaled 3-20)]
        Ingress --> RealtimePods[WebSocket / SSE Real-time Gateway Pods]
        
        WorkerPods[Outbox & Event Relay Background Workers]
        CronPods[Scheduled Cron Jobs (EOD, Daily Reports, Billing)]
    end
    
    subgraph Managed Cloud Data Plane
        WebAppPods --> PgBouncer[PgBouncer Connection Pooler]
        RealtimePods --> PgBouncer
        WorkerPods --> PgBouncer
        
        PgBouncer --> PostgresPrimary[(PostgreSQL 16 Primary DB)]
        PostgresPrimary -.-> PostgresReplica[(PostgreSQL Read Replica)]
        
        WebAppPods --> RedisCluster[(Redis 7 HA Cluster)]
        RealtimePods --> RedisCluster
        WorkerPods --> RedisCluster
        
        WebAppPods --> S3Storage[(AWS S3 / Cloud Storage)]
    end
```

---

## 2. Multi-Stage Production Dockerfile Blueprint

```dockerfile
# syntax=docker/dockerfile:1.4
# Multi-stage production build for RestaurantOS

FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

FROM base AS dependencies
COPY package.json package-lock.json* ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
```

---

## 3. Environment Variable Matrix & Secrets Reference

| Variable Name | Description | Environment | Sensitive |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | Runtime environment (`production`, `staging`, `development`). | All | No |
| `DATABASE_URL` | PostgreSQL connection string with SSL mode. | All | **Yes** |
| `DATABASE_REPLICA_URL`| PostgreSQL read-replica connection string. | Staging / Prod | **Yes** |
| `REDIS_URL` | Redis cluster connection URI with TLS. | All | **Yes** |
| `JWT_SECRET` | 256-bit secret key for signing session tokens. | All | **Yes** |
| `WOLT_WEBHOOK_SECRET` | HMAC secret for verifying inbound Wolt orders. | Staging / Prod | **Yes** |
| `TENBIS_API_KEY` | API credentials for 10bis aggregator gateway. | Staging / Prod | **Yes** |
| `STRIPE_SECRET_KEY` | Stripe payment gateway API secret. | Staging / Prod | **Yes** |
| `MESHULAM_API_KEY` | Israeli credit card clearing credentials. | Staging / Prod | **Yes** |
| `TWILIO_AUTH_TOKEN` | SMS / WhatsApp notification gateway token. | Staging / Prod | **Yes** |

---

## 4. CI/CD Pipeline & Zero-Downtime Rollouts

1. **Continuous Integration (GitHub Actions):**
   - Step 1: Type checking (`tsc --noEmit`) & Linting (`eslint`).
   - Step 2: Unit and integration tests (`vitest run --coverage`).
   - Step 3: Database migration dry-run on ephemeral PostgreSQL container.
   - Step 4: Security scan (Snyk & Trivy vulnerability audit).
   - Step 5: Docker container build and image signing.
2. **Continuous Deployment (GitOps with ArgoCD):**
   - Production deployment uses **Kubernetes Rolling Updates** (`maxSurge: 25%`, `maxUnavailable: 0`).
   - Readiness probes (`GET /health/ready`) ensure traffic is only routed once database migrations and warm connection pools are verified.
   - Immediate automated rollback triggered if error rate exceeds `1.0%` within 5 minutes post-deployment.
