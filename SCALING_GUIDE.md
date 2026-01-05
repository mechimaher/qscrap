# Phase 1 & 2 Scaling Configuration Guide

## Environment Variables

Create or update your `.env` file with the following configurations:

### Core Configuration (Required)
```env
NODE_ENV=development
PORT=3000
DB_HOST=localhost
DB_USER=postgres
DB_PASSWORD=<strong-password-here>
DB_NAME=qscrap_db
DB_PORT=5432
JWT_SECRET=<strong-secret-here>
```

### Phase 1: Database Pool Optimization
```env
# Connection pool limits (adjust based on server RAM)
DB_POOL_MAX=20              # Max connections (increase on 16GB+ RAM)
DB_POOL_MIN=5               # Minimum idle connections
DB_IDLE_TIMEOUT=30000       # Close idle connections after 30s
DB_CONNECT_TIMEOUT=5000     # Connection timeout (5s)
DB_STATEMENT_TIMEOUT=30000  # Query timeout (30s)
```

### Phase 2: Read Replicas (Optional)
```env
# Enable ONLY if you have database read replicas
DB_READ_REPLICA_HOST=replica.example.com
DB_READ_REPLICA_PORT=5432
DB_READ_POOL_MAX=30         # Read replicas can have larger pools
```

### Phase 2: Redis Session Store (Optional)
```env
# Enable for horizontal scaling with multiple app servers
REDIS_URL=redis://localhost:6379
SESSION_SECRET=<unique-session-secret>
COOKIE_DOMAIN=.qscrap.qa    # For production
```

### Phase 2: File Storage - S3 (Optional)
```env
# AWS S3 or S3-compatible storage (MinIO, DigitalOcean Spaces)
S3_BUCKET=qscrap-uploads
S3_REGION=us-east-1
S3_ACCESS_KEY=<your-access-key>
S3_SECRET_KEY=<your-secret-key>
S3_BASE_URL=https://qscrap-uploads.s3.us-east-1.amazonaws.com
```

### Phase 2: File Storage - Azure Blob (Alternative to S3)
```env
# Azure Blob Storage
AZURE_STORAGE_ACCOUNT=qscrapstorageaccount
AZURE_STORAGE_CONTAINER=qscrap-uploads
AZURE_STORAGE_CONNECTION_STRING=<connection-string>
```

### CDN Configuration (Production)
```env
# No env vars needed - CDN works automatically in production mode
# Just point Cloudflare/CDN to your domain
```

## Installation

### Required Dependencies (Already installed)
```bash
npm install pg dotenv express cors helmet bcrypt jsonwebtoken
```

### Optional Dependencies for Phase 2

#### For Redis Sessions (Horizontal Scaling)
```bash
npm install redis connect-redis express-session
npm install --save-dev @types/express-session @types/connect-redis
```

#### For S3 Storage
```bash
npm install @aws-sdk/client-s3
```

#### For Azure Blob Storage
```bash
npm install @azure/storage-blob
```

## Deployment Scenarios

### Scenario 1: Single Server (Current - No changes needed)
- Uses local file storage
- In-memory sessions
- Single database
- **Works without any new env vars**

### Scenario 2: Vertical Scaling (4GB → 16GB RAM)
Add to `.env`:
```env
DB_POOL_MAX=40
DB_POOL_MIN=10
```

### Scenario 3: CDN for Static Assets
1. Deploy app to production server
2. Set `NODE_ENV=production`
3. Point Cloudflare CDN to your domain
4. Cache headers are automatically applied

### Scenario 4: Horizontal Scaling (Multiple App Servers)
1. Set up Redis:
   ```bash
   docker run -d -p 6379:6379 redis:alpine
   ```

2. Add to `.env`:
   ```env
   REDIS_URL=redis://your-redis-server:6379
   SESSION_SECRET=<generate-strong-secret>
   ```

3. Install Redis packages:
   ```bash
   npm install redis connect-redis express-session
   ```

4. Set up S3 or Azure Blob for shared file storage

5. Use load balancer (nginx) to distribute traffic

### Scenario 5: Database Read Replicas
1. Set up PostgreSQL read replica (Azure/AWS managed services)
2. Add to `.env`:
   ```env
   DB_READ_REPLICA_HOST=replica-server.database.windows.net
   DB_READ_REPLICA_PORT=5432
   DB_READ_POOL_MAX=30
   ```
3. Dashboard queries automatically use replica

## Monitoring

### Health Check Endpoint
```bash
curl http://localhost:3000/health
```

Response includes:
```json
{
  "success": true,
  "status": "OK",
  "timestamp": "2025-12-18T10:00:00.000Z",
  "environment": "production",
  "uptime": 3600.5,
  "database": {
    "primary": {
      "connected": true,
      "total": 20,
      "idle": 15,
      "waiting": 0
    },
    "replica": {
      "connected": true,
      "total": 30,
      "idle": 25,
      "waiting": 0
    }
  },
  "redis": {
    "connected": true
  },
  "storage": "S3"
}
```

## Rollback Plan

If you encounter issues, simply:
1. Remove new env vars from `.env`
2. Restart the app
3. System falls back to local storage + in-memory sessions

**No code changes needed - fully backwards compatible!**

## Performance Benchmarks

### Connection Pool Settings by Server Size

| Server RAM | DB_POOL_MAX | DB_POOL_MIN | Expected Users |
|------------|-------------|-------------|----------------|
| 2GB        | 10          | 2           | ~200           |
| 4GB        | 20 (default)| 5 (default) | ~500           |
| 8GB        | 40          | 10          | ~1,000         |
| 16GB       | 80          | 20          | ~2,000         |

### Database Replica Usage

Queries automatically routed to read replicas:
- Dashboard statistics
- Report generation
- Search queries
- Review listings

Queries that use primary (write pool):
- All INSERTs, UPDATEs, DELETEs
- Order creation
- Bid submission
- Payment processing

## Troubleshooting

### Redis Connection Fails
- **Symptom**: App starts but warns "Falling back to in-memory session store"
- **Fix**: App continues working normally with in-memory sessions
- **Resolution**: Check REDIS_URL and ensure Redis is running

### S3 Upload Fails
- **Symptom**: File uploads fail with S3 error
- **Fix**: App automatically falls back to local storage
- **Resolution**: Check S3 credentials and bucket permissions

### Database Pool Exhausted
- **Symptom**: "Pool exhausted" errors
- **Fix**: Increase `DB_POOL_MAX` in `.env`
- **Resolution**: Monitor `/health` endpoint for pool statistics

## Next Steps

1. ✅ Phase 1 implemented - database pool optimization complete
2. ✅ Phase 2 framework ready - install optional packages as needed
3. 📋 Test with current setup (works without changes)
4. 🚀 Add Redis/S3 when scaling to 1000+ users
5. 📊 Monitor `/health` endpoint for performance metrics

## Phase 3: Cloud Native Scale (10k - 100k Users)
**Objective**: Decouple logic from infrastructure to allow infinite auto-scaling.

### 1. Container Orchestration (Kubernetes / AWS ECS)
Move from `docker-compose` (single server) to **Kubernetes**.
- **Auto-Scaling**: Automatically spin up new API containers when CPU > 70%.
- **Self-Healing**: Automatically restart crashed pods.

### 2. Managed Database (AWS RDS / Azure SQL)
Stop managing Postgres yourself.
- **Multi-AZ**: Database exists in 2 physical data centers simultaneously.
- **Point-in-Time Recovery**: Restore data to any second in the last 30 days.

### 3. Event-Driven Architecture (Queues)
Use **Redis Streams** or **RabbitMQ** to decouple heavy tasks (Emails, Notifications) from the main API.

## Phase 4: Global Scale (100k+ Users)

### 1. Database Sharding
Split data by geography (e.g., Qatar users on Cluster A, Saudi users on Cluster B).

### 2. Edge Computing
Run logic on **Cloudflare Workers** to process requests milliseconds from the user.
