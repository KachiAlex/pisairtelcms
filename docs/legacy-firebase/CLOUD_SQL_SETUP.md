# Google Cloud SQL PostgreSQL Setup Guide

## Why Cloud SQL Instead of Supabase?

1. **No Connection Issues**: Proper connection pooling, SSL/TLS configured correctly
2. **Same Database**: PostgreSQL - zero code changes needed
3. **Native Integration**: Works seamlessly with Firebase/Cloud Run
4. **Better Reliability**: Enterprise-grade infrastructure
5. **Scalable**: No connection limits, proper resource management

## Step 1: Create Cloud SQL Instance

### Using Google Cloud Console

1. Go to [Cloud SQL Console](https://console.cloud.google.com/sql)
2. Click "Create Instance"
3. Choose **PostgreSQL**
4. Configure:
   - **Instance ID**: `ecclesia-db`
   - **Password**: Set a strong password (save it!)
   - **Region**: Same as your Cloud Run (e.g., `us-central1`)
   - **Database Version**: PostgreSQL 15 or 14
   - **Machine Type**: 
     - Development: `db-f1-micro` (Free tier eligible)
     - Production: `db-n1-standard-1` (1 vCPU, 3.75GB RAM) or higher

### Using gcloud CLI

```bash
# Set variables
export PROJECT_ID="your-project-id"
export INSTANCE_NAME="ecclesia-db"
export REGION="us-central1"
export DB_PASSWORD="your-secure-password"

# Create instance
gcloud sql instances create $INSTANCE_NAME \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=$REGION \
  --root-password=$DB_PASSWORD \
  --storage-type=SSD \
  --storage-size=10GB \
  --backup-start-time=03:00 \
  --enable-bin-log \
  --maintenance-window-day=SUN \
  --maintenance-window-hour=04 \
  --maintenance-release-channel=production
```

## Step 2: Create Database

```bash
# Create database
gcloud sql databases create ecclesia \
  --instance=$INSTANCE_NAME

# Or using psql
gcloud sql connect $INSTANCE_NAME --user=postgres
CREATE DATABASE ecclesia;
```

## Step 3: Configure Private IP (Recommended)

### Enable Private IP

```bash
# Allocate IP range
gcloud compute addresses create google-managed-services-default \
  --global \
  --purpose=VPC_PEERING \
  --prefix-length=16 \
  --network=default

# Create private connection
gcloud services vpc-peerings connect \
  --service=servicenetworking.googleapis.com \
  --ranges=google-managed-services-default \
  --network=default

# Update instance to use private IP
gcloud sql instances patch $INSTANCE_NAME \
  --network=default \
  --no-assign-ip
```

### Configure Cloud Run to Use Private IP

```bash
gcloud run services update ecclesia-app \
  --region=$REGION \
  --vpc-connector=projects/$PROJECT_ID/locations/$REGION/connectors/default \
  --vpc-egress=private-ranges-only
```

## Step 4: Configure Connection String

### For Public IP (Easier Setup)

```bash
# Get connection name
CONNECTION_NAME=$(gcloud sql instances describe $INSTANCE_NAME \
  --format='value(connectionName)')

# Connection string format:
# postgresql://postgres:PASSWORD@PUBLIC_IP:5432/ecclesia?host=/cloudsql/CONNECTION_NAME
```

### For Private IP (More Secure)

```bash
# Get private IP
PRIVATE_IP=$(gcloud sql instances describe $INSTANCE_NAME \
  --format='value(ipAddresses[0].ipAddress)')

# Connection string:
# postgresql://postgres:PASSWORD@PRIVATE_IP:5432/ecclesia
```

## Step 5: Set Up SSL/TLS (Recommended)

### Download SSL Certificate

```bash
# Download server certificate
gcloud sql ssl-certs create client-cert \
  --instance=$INSTANCE_NAME

# Download certificate files
gcloud sql ssl-certs describe client-cert \
  --instance=$INSTANCE_NAME \
  --format='value(cert)' > client-cert.pem

gcloud sql ssl-certs describe client-cert \
  --instance=$INSTANCE_NAME \
  --format='value(privateKey)' > client-key.pem

# Download CA certificate
gcloud sql instances describe $INSTANCE_NAME \
  --format='value(serverCaCert.cert)' > server-ca.pem
```

### Update Connection String with SSL

```env
DATABASE_URL="postgresql://postgres:PASSWORD@IP:5432/ecclesia?sslmode=require&sslcert=client-cert.pem&sslkey=client-key.pem&sslrootcert=server-ca.pem"
```

## Step 6: Configure Connection Pooling

### Using PgBouncer (Recommended for Production)

Cloud SQL provides built-in connection pooling. Update your connection string:

```env
# For Cloud SQL Proxy with connection pooling
DATABASE_URL="postgresql://postgres:PASSWORD@/ecclesia?host=/cloudsql/PROJECT_ID:REGION:INSTANCE_NAME&sslmode=require"
```

### Update Prisma Configuration

The `lib/prisma-cloud-sql.ts` file includes optimized settings for Cloud SQL.

## Step 7: Set Up Cloud SQL Proxy (For Local Development)

### Install Cloud SQL Proxy

```bash
# Download proxy
curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.0/cloud-sql-proxy.linux.amd64
chmod +x cloud-sql-proxy

# Or using Homebrew (Mac)
brew install cloud-sql-proxy
```

### Run Proxy

```bash
# Start proxy
./cloud-sql-proxy PROJECT_ID:REGION:INSTANCE_NAME

# Or with authentication
./cloud-sql-proxy PROJECT_ID:REGION:INSTANCE_NAME \
  --credentials-file=path/to/service-account.json
```

### Connect Locally

```env
# Local connection through proxy
DATABASE_URL="postgresql://postgres:PASSWORD@localhost:5432/ecclesia"
```

## Step 8: Update Environment Variables

### For Cloud Run Deployment

```bash
# Get connection name
CONNECTION_NAME=$(gcloud sql instances describe $INSTANCE_NAME \
  --format='value(connectionName)')

# Set environment variable
gcloud run services update ecclesia-app \
  --region=$REGION \
  --set-env-vars DATABASE_URL="postgresql://postgres:PASSWORD@/ecclesia?host=/cloudsql/$CONNECTION_NAME&sslmode=require" \
  --add-cloudsql-instances=$CONNECTION_NAME
```

### For Local Development

Create `.env.local`:

```env
DATABASE_URL="postgresql://postgres:PASSWORD@localhost:5432/ecclesia"
```

## Step 9: Run Migrations

```bash
# Generate Prisma Client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Or for development
npx prisma migrate dev
```

## Step 10: Verify Connection

```bash
# Test connection
npx prisma db pull

# Or using psql
psql "postgresql://postgres:PASSWORD@IP:5432/ecclesia"
```

## Security Best Practices

1. **Use Private IP**: More secure, no public exposure
2. **Enable SSL/TLS**: Encrypt all connections
3. **Use IAM Authentication**: More secure than passwords
4. **Restrict Access**: Use firewall rules
5. **Regular Backups**: Automatic backups enabled
6. **Monitor Connections**: Set up alerts

## Cost Estimation

### Development/Testing
- **db-f1-micro**: Free tier eligible (if eligible)
- **Storage**: $0.17/GB/month
- **Backups**: Included (7 days)

### Production (Small)
- **db-n1-standard-1**: ~$25/month
- **Storage**: $0.17/GB/month
- **Backups**: Included (7 days)

### Production (Medium)
- **db-n1-standard-2**: ~$50/month
- **Storage**: $0.17/GB/month
- **High Availability**: +$50/month

## Troubleshooting

### Connection Timeouts

```bash
# Check instance status
gcloud sql instances describe $INSTANCE_NAME

# Check logs
gcloud sql operations list --instance=$INSTANCE_NAME
```

### SSL Certificate Issues

```bash
# Regenerate certificates
gcloud sql ssl-certs delete client-cert --instance=$INSTANCE_NAME
gcloud sql ssl-certs create client-cert --instance=$INSTANCE_NAME
```

### Connection Pool Exhaustion

- Increase `max_connections` in Cloud SQL settings
- Use connection pooling (PgBouncer)
- Optimize queries

## Migration from Supabase

If you're currently using Supabase:

1. **Export Data**:
```bash
pg_dump "supabase-connection-string" > backup.sql
```

2. **Import to Cloud SQL**:
```bash
psql "cloud-sql-connection-string" < backup.sql
```

3. **Update Environment Variables**:
```env
DATABASE_URL="cloud-sql-connection-string"
```

4. **Test Application**: Verify all features work

## Next Steps

1. ✅ Create Cloud SQL instance
2. ✅ Configure connection string
3. ✅ Set up SSL/TLS
4. ✅ Update environment variables
5. ✅ Run migrations
6. ✅ Deploy to Cloud Run
7. ✅ Monitor and optimize

## Support

- [Cloud SQL Documentation](https://cloud.google.com/sql/docs/postgres)
- [Prisma with Cloud SQL](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-google-cloud-run)
- [Connection Pooling Guide](https://cloud.google.com/sql/docs/postgres/connect-connection-pooling)

