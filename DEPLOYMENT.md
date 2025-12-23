# Deployment Guide

## Prerequisites

- Docker and Docker Compose installed
- PostgreSQL database (or use Docker Compose)
- Environment variables configured

## Quick Start with Docker Compose

1. **Set environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your production values
   ```

2. **Start services**:
   ```bash
   docker-compose up -d
   ```

3. **Run database migrations**:
   ```bash
   docker-compose exec backend npm run prisma:migrate
   ```

4. **Seed initial data (optional)**:
   ```bash
   docker-compose exec backend npm run prisma:seed
   ```

5. **Verify deployment**:
   - Health check: `http://localhost:3001/api/health`
   - API docs: `http://localhost:3001/api/docs`

## Manual Deployment

### 1. Build the application

```bash
npm install
npm run prisma:generate
npm run build
```

### 2. Set up database

```bash
# Create database
createdb probodyline

# Run migrations
npm run prisma:migrate

# Seed data (optional)
npm run prisma:seed
```

### 3. Configure environment

Create `.env` file with production values:
```env
DATABASE_URL=postgresql://user:password@host:5432/probodyline?schema=public
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://your-frontend-domain.com
JWT_SECRET=your-secure-random-secret
JWT_EXPIRES_IN=7d
MAX_FILE_SIZE=10485760
```

### 4. Start the application

```bash
npm run start:prod
```

## Production Considerations

### Environment Variables

- **JWT_SECRET**: Use a strong, random secret (at least 32 characters)
- **DATABASE_URL**: Use connection pooling for production
- **FRONTEND_URL**: Set to your frontend domain for CORS
- **NODE_ENV**: Set to `production` for optimized performance

### Database

- Use connection pooling (configured in Prisma)
- Set up regular backups
- Monitor database performance

### Security

- Change default JWT secret
- Use HTTPS in production
- Configure rate limiting (already enabled)
- Set up proper CORS origins
- Use Helmet for security headers (already enabled)

### Monitoring

- Health check endpoint: `/api/health`
- Logs are written to files (Winston logger)
- Monitor application metrics

### Scaling

- Use a process manager like PM2
- Set up load balancing for multiple instances
- Use a reverse proxy (nginx) for SSL termination

## Docker Commands

```bash
# Build image
docker build -t probodyline-backend .

# Run container
docker run -d \
  --name probodyline-backend \
  -p 3001:3001 \
  -e DATABASE_URL=postgresql://... \
  probodyline-backend

# View logs
docker-compose logs -f backend

# Stop services
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

## Troubleshooting

### Database Connection Issues

- Verify `DATABASE_URL` is correct
- Check database is accessible
- Ensure migrations have run

### Port Conflicts

- Change `PORT` in `.env` if 3001 is in use
- Update Docker port mapping if needed

### File Upload Issues

- Ensure `uploads` directory exists and is writable
- Check `MAX_FILE_SIZE` setting

