# Railway Deployment Guide

This guide provides step-by-step instructions for deploying the Pro-Bodyline backend to Railway.

## Prerequisites

- Railway account (sign up at [railway.app](https://railway.app))
- Railway CLI installed (optional, for local commands)
- Git repository with your code pushed to GitHub/GitLab/Bitbucket
- Basic understanding of environment variables

## Architecture Overview

Your Railway deployment will consist of:
- **Backend Service**: NestJS application running in Docker
- **PostgreSQL Database**: Managed by Railway
- **Volume Storage**: Persistent storage for file uploads

## Step-by-Step Deployment

### 1. Create a New Railway Project

1. Log in to [Railway Dashboard](https://railway.app/dashboard)
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"** (or GitLab/Bitbucket)
4. Authorize Railway to access your repositories
5. Select the `pro-bodyline-backend` repository

### 2. Add PostgreSQL Database

1. In your Railway project, click **"+ New"**
2. Select **"Database"**
3. Choose **"PostgreSQL"**
4. Railway will automatically:
   - Create a PostgreSQL instance
   - Generate a `DATABASE_URL` environment variable
   - Link it to your backend service

### 3. Configure Environment Variables

In your backend service settings, go to **"Variables"** tab and add:

```env
NODE_ENV=production
JWT_SECRET=<generate-a-strong-random-secret>
JWT_EXPIRES_IN=7d
FRONTEND_URL=https://your-frontend-domain.com
MAX_FILE_SIZE=10485760
```

**Important Notes:**
- ✅ `DATABASE_URL` is automatically provided by Railway PostgreSQL
- ✅ `PORT` is automatically assigned by Railway - **DO NOT set this manually**
- 🔐 Generate a strong `JWT_SECRET` using: `openssl rand -base64 32`
- 🌐 Update `FRONTEND_URL` to your actual frontend domain for CORS

### 4. Set Up Volume for File Uploads

1. In your backend service, go to **"Settings"** tab
2. Scroll to **"Volumes"** section
3. Click **"+ Add Volume"**
4. Configure:
   - **Mount Path**: `/app/uploads`
   - **Size**: 1GB (or as needed)
5. Click **"Add"**

This ensures uploaded files (images, PDFs) persist across deployments.

### 5. Configure Build Settings (Optional)

Railway should auto-detect the Dockerfile, but you can verify:

1. Go to **"Settings"** tab
2. Under **"Build"** section:
   - **Builder**: Should be set to `Dockerfile`
   - **Dockerfile Path**: `Dockerfile`
3. Under **"Deploy"** section:
   - **Start Command**: `node dist/main` (optional, already in Dockerfile)

### 6. Deploy the Application

1. Railway will automatically trigger a deployment after configuration
2. Monitor the build logs in the **"Deployments"** tab
3. Wait for the build to complete (typically 3-5 minutes)

### 7. Run Database Migrations

After the first successful deployment, you need to run Prisma migrations:

#### Option A: Using Railway Dashboard (Recommended)

1. Go to your backend service
2. Click on **"Settings"** tab
3. Scroll to **"Service"** section
4. Click **"Deploy"** dropdown → **"Run a Command"**
5. Enter: `npx prisma migrate deploy`
6. Click **"Run"**

#### Option B: Using Railway CLI

```bash
# Install Railway CLI (if not already installed)
npm i -g @railway/cli

# Login to Railway
railway login

# Link to your project
railway link

# Run migrations
railway run npx prisma migrate deploy
```

### 8. Seed Initial Data (Optional)

To populate the database with initial organization data:

```bash
# Using Railway CLI
railway run npm run prisma:seed

# Or via Railway Dashboard
# Run command: npm run prisma:seed
```

### 9. Verify Deployment

1. **Get Your Service URL**:
   - Go to **"Settings"** tab
   - Find **"Domains"** section
   - Your app URL: `https://your-app.up.railway.app`

2. **Test Health Endpoint**:
   ```bash
   curl https://your-app.up.railway.app/api/health
   ```
   
   Expected response:
   ```json
   {
     "status": "ok",
     "timestamp": "2024-01-01T00:00:00.000Z",
     "database": "connected"
   }
   ```

3. **Access API Documentation**:
   - Open: `https://your-app.up.railway.app/api/docs`
   - You should see the Swagger UI

### 10. Add Custom Domain (Optional)

1. Go to **"Settings"** tab
2. Under **"Domains"** section
3. Click **"+ Custom Domain"**
4. Enter your domain (e.g., `api.probodyline.com`)
5. Add the provided CNAME record to your DNS provider
6. Wait for DNS propagation (5-30 minutes)

## Environment Variables Reference

| Variable | Required | Source | Description |
|----------|----------|--------|-------------|
| `DATABASE_URL` | ✅ | Auto-generated | PostgreSQL connection string |
| `PORT` | ✅ | Auto-assigned | Application port (dynamic) |
| `NODE_ENV` | ✅ | Manual | Set to `production` |
| `JWT_SECRET` | ✅ | Manual | Strong random secret (32+ chars) |
| `JWT_EXPIRES_IN` | ✅ | Manual | Token expiry (e.g., `7d`) |
| `FRONTEND_URL` | ✅ | Manual | Frontend domain for CORS |
| `MAX_FILE_SIZE` | ⚠️ | Manual | Max upload size in bytes (default: 10MB) |

## Post-Deployment Tasks

### Update Frontend Configuration

Update your frontend to use the Railway backend URL:

```javascript
// In your frontend .env or config
NEXT_PUBLIC_API_URL=https://your-app.up.railway.app/api
# or
VITE_API_URL=https://your-app.up.railway.app/api
```

### Monitor Application

1. **View Logs**:
   - Go to **"Deployments"** tab
   - Click on latest deployment
   - View real-time logs

2. **Monitor Metrics**:
   - Go to **"Metrics"** tab
   - View CPU, Memory, Network usage

3. **Set Up Alerts** (Optional):
   - Configure notifications for deployment failures
   - Set up health check alerts

## Common Issues & Troubleshooting

### Issue: Build Fails with "npm ci" Error

**Solution**: Ensure `package-lock.json` is committed to your repository.

```bash
git add package-lock.json
git commit -m "Add package-lock.json"
git push
```

### Issue: Database Connection Error

**Symptoms**: Logs show `Can't reach database server`

**Solutions**:
1. Verify PostgreSQL service is running in Railway dashboard
2. Check `DATABASE_URL` is automatically set (don't set it manually)
3. Ensure database and backend are in the same Railway project
4. Wait 1-2 minutes for database to fully initialize

### Issue: Port Binding Error

**Symptoms**: `Error: listen EADDRINUSE: address already in use`

**Solution**: Ensure you're NOT setting `PORT` environment variable manually. Railway assigns this automatically.

### Issue: File Uploads Not Persisting

**Symptoms**: Uploaded files disappear after redeployment

**Solution**: Ensure Railway volume is properly mounted at `/app/uploads`:
1. Go to **"Settings"** → **"Volumes"**
2. Verify mount path is `/app/uploads`
3. Redeploy the service

### Issue: CORS Errors from Frontend

**Symptoms**: Browser console shows CORS policy errors

**Solution**: Update `FRONTEND_URL` environment variable:
1. Set to your actual frontend domain (e.g., `https://probodyline.com`)
2. Include protocol (`https://`)
3. No trailing slash
4. Redeploy after changing

### Issue: Health Check Failing

**Symptoms**: Service shows as unhealthy in Railway

**Solutions**:
1. Check `/api/health` endpoint is accessible
2. Verify database connection is working
3. Check application logs for errors
4. Ensure migrations have been run

### Issue: Prisma Client Not Generated

**Symptoms**: `Cannot find module '@prisma/client'`

**Solution**: The Dockerfile already handles this, but if needed:
```bash
railway run npx prisma generate
```

## Maintenance Commands

### View Logs
```bash
railway logs
```

### Run Migrations
```bash
railway run npx prisma migrate deploy
```

### Access Database
```bash
railway run npx prisma studio
```

### Restart Service
```bash
railway restart
```

### Rollback Deployment
1. Go to **"Deployments"** tab
2. Find previous successful deployment
3. Click **"⋯"** → **"Redeploy"**

## Scaling & Performance

### Vertical Scaling
Railway automatically scales resources based on usage. For more control:
1. Go to **"Settings"** → **"Resources"**
2. Adjust memory/CPU limits

### Database Connection Pooling
Prisma automatically handles connection pooling. For high traffic:
1. Update `DATABASE_URL` with connection limit:
   ```
   postgresql://user:pass@host:5432/db?connection_limit=10
   ```

### Monitoring Performance
- Use Railway metrics dashboard
- Enable application logging
- Consider adding APM tools (New Relic, Datadog)

## Security Best Practices

1. ✅ **Strong JWT Secret**: Use `openssl rand -base64 32`
2. ✅ **HTTPS Only**: Railway provides SSL automatically
3. ✅ **Environment Variables**: Never commit secrets to Git
4. ✅ **CORS Configuration**: Restrict to your frontend domain only
5. ✅ **Rate Limiting**: Already enabled in the application
6. ✅ **Helmet Security Headers**: Already configured

## Backup & Recovery

### Database Backups

Railway PostgreSQL includes automatic backups. To create manual backup:

```bash
# Export database
railway run pg_dump $DATABASE_URL > backup.sql

# Restore database
railway run psql $DATABASE_URL < backup.sql
```

### File Uploads Backup

Volume data should be backed up separately:
1. Consider using S3/Cloudinary for production file storage
2. Or implement periodic backup script

## Cost Optimization

- **Free Tier**: $5 credit/month (good for development)
- **Hobby Plan**: $5/month (includes $5 credit)
- **Pro Plan**: $20/month (includes $20 credit)

**Tips**:
- Monitor usage in Railway dashboard
- Optimize Docker image size
- Use appropriate volume sizes
- Clean up unused deployments

## Next Steps

1. ✅ Set up custom domain
2. ✅ Configure frontend to use Railway backend
3. ✅ Set up monitoring and alerts
4. ✅ Test all API endpoints
5. ✅ Create admin user account
6. ✅ Populate initial organization data
7. ✅ Test file upload functionality
8. ✅ Verify PDF generation works

## Support & Resources

- **Railway Documentation**: [docs.railway.app](https://docs.railway.app)
- **Railway Discord**: [discord.gg/railway](https://discord.gg/railway)
- **NestJS Documentation**: [docs.nestjs.com](https://docs.nestjs.com)
- **Prisma Documentation**: [prisma.io/docs](https://prisma.io/docs)

## Useful Railway CLI Commands

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Link to project
railway link

# View environment variables
railway variables

# Run command in Railway environment
railway run <command>

# View logs
railway logs

# Open dashboard
railway open

# Deploy current branch
railway up
```

---

**Deployment Checklist**

- [ ] Railway project created
- [ ] PostgreSQL database added
- [ ] Environment variables configured
- [ ] Volume mounted at `/app/uploads`
- [ ] Application deployed successfully
- [ ] Database migrations run
- [ ] Health check passing
- [ ] API documentation accessible
- [ ] CORS configured for frontend
- [ ] Custom domain added (optional)
- [ ] Frontend updated with backend URL
- [ ] Initial data seeded
- [ ] File upload tested
- [ ] All API endpoints tested

---

**Questions or Issues?**

If you encounter any problems not covered in this guide, please:
1. Check Railway dashboard logs
2. Review the troubleshooting section
3. Consult Railway documentation
4. Ask in Railway Discord community

