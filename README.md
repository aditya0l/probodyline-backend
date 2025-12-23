# PRo-Bodyline Backend API

Backend API for PRo-Bodyline CRM/Sales/ERP system built with NestJS, Prisma, and PostgreSQL.

## Technology Stack

- **Framework**: NestJS 11
- **ORM**: Prisma 6
- **Database**: PostgreSQL
- **Language**: TypeScript

## Prerequisites

- Node.js (v18+ recommended)
- PostgreSQL database
- npm or yarn

## Setup

1. **Install dependencies**:
```bash
   npm install
   ```

2. **Set up PostgreSQL database**:
   - Install PostgreSQL if not already installed
   - Create a new database:
     ```sql
     CREATE DATABASE probodyline;
     ```

3. **Configure environment variables**:
   - Copy `.env.example` to `.env`:
     ```bash
     cp .env.example .env
     ```
   - Edit `.env` and update the `DATABASE_URL` with your PostgreSQL credentials:
     ```env
     DATABASE_URL="postgresql://username:password@localhost:5432/probodyline?schema=public"
     PORT=3001
     NODE_ENV=development
     FRONTEND_URL=http://localhost:3000
     MAX_FILE_SIZE=10485760
     ```

4. **Run database migrations**:
```bash
   npm run prisma:migrate
   ```
   This will create all database tables based on the Prisma schema.

5. **Generate Prisma Client**:
```bash
   npm run prisma:generate
   ```
   This generates the Prisma Client for type-safe database access.

6. **Seed initial data (optional)**:
```bash
   npm run prisma:seed
   ```
   This creates a default organization and sample products for testing.

7. **Start development server**:
```bash
   npm run start:dev
   ```

The API will be available at `http://localhost:3001`
API Documentation (Swagger) will be available at `http://localhost:3001/api/docs`

## Verification

After starting the server, verify everything is working:

1. **Health Check**: Visit `http://localhost:3001/api/health`
   - Should return `{"status":"ok","database":"connected"}`

2. **Swagger Documentation**: Visit `http://localhost:3001/api/docs`
   - Should show all available API endpoints

3. **Test an endpoint**: 
   ```bash
   curl http://localhost:3001/api/organizations
   ```
   - Should return an empty array `[]` or seeded organizations

## Available Scripts

- `npm run start:dev` - Start development server with hot reload
- `npm run build` - Build the application
- `npm run start:prod` - Start production server
- `npm run prisma:generate` - Generate Prisma Client
- `npm run prisma:migrate` - Run database migrations
- `npm run prisma:studio` - Open Prisma Studio (database GUI)
- `npm run prisma:seed` - Run seed script to populate initial data
- `npm run test` - Run unit tests
- `npm run test:e2e` - Run end-to-end tests

## API Endpoints

### Organizations
- `GET /api/organizations` - List all organizations
- `GET /api/organizations/:id` - Get organization by ID
- `POST /api/organizations` - Create organization
- `PATCH /api/organizations/:id` - Update organization
- `DELETE /api/organizations/:id` - Delete organization

### Categories
- `GET /api/categories` - List categories (optional: ?organizationId=uuid)
- `GET /api/categories/:id` - Get category by ID
- `POST /api/categories` - Create category
- `PATCH /api/categories/:id` - Update category
- `DELETE /api/categories/:id` - Delete category (soft delete)

### Products
- `GET /api/products` - List products (required: ?organizationId=uuid, optional: search, productType, categoryId, page, limit)
- `GET /api/products/:id` - Get product by ID
- `POST /api/products` - Create product
- `PATCH /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product (soft delete)
- `POST /api/products/:id/duplicate` - Duplicate product

### Customers
- `GET /api/customers` - List customers (optional: ?organizationId=uuid)
- `GET /api/customers/:id` - Get customer by ID
- `POST /api/customers` - Create customer
- `PATCH /api/customers/:id` - Update customer
- `DELETE /api/customers/:id` - Delete customer (soft delete)

### Quotations
- `GET /api/quotations` - List quotations (optional: ?organizationId=uuid)
- `GET /api/quotations/:id` - Get quotation by ID
- `POST /api/quotations` - Create quotation
- `PATCH /api/quotations/:id` - Update quotation
- `DELETE /api/quotations/:id` - Delete quotation (soft delete)
- `PATCH /api/quotations/:id/status` - Update quotation status
- `POST /api/quotations/:id/items` - Add item to quotation
- `PATCH /api/quotations/:id/items/:itemId` - Update quotation item
- `DELETE /api/quotations/:id/items/:itemId` - Remove item from quotation

### Stock
- `POST /api/stock/transactions` - Create stock transaction
- `GET /api/stock/transactions` - List transactions (filters: organizationId, productId, startDate, endDate, transactionType)
- `GET /api/stock/transactions/:id` - Get transaction by ID
- `GET /api/stock/products/:productId/current` - Get current stock for product
- `GET /api/stock/products/:productId/history` - Get stock history for product
- `GET /api/stock/products/low-stock` - Get low stock products (required: ?organizationId=uuid, optional: threshold)
- `PATCH /api/stock/transactions/:id` - Update transaction
- `DELETE /api/stock/transactions/:id` - Delete transaction

### Vendors
- `GET /api/vendors` - List vendors (optional: ?organizationId=uuid)
- `GET /api/vendors/:id` - Get vendor by ID
- `POST /api/vendors` - Create vendor
- `PATCH /api/vendors/:id` - Update vendor
- `DELETE /api/vendors/:id` - Delete vendor (soft delete)

### Reports
- `GET /api/reports/sales` - Sales report (required: ?organizationId=uuid, optional: startDate, endDate, customerId, productId, status)
- `GET /api/reports/stock` - Stock report (required: ?organizationId=uuid, optional: lowStockThreshold, productId, categoryId)
- `GET /api/reports/quotations` - Quotation analytics (required: ?organizationId=uuid, optional: startDate, endDate)
- `GET /api/reports/financial` - Financial summary (required: ?organizationId=uuid, optional: startDate, endDate)

### Analytics
- `GET /api/analytics/dashboard` - Dashboard summary (required: ?organizationId=uuid)
- `GET /api/analytics/sales-trends` - Sales trends (required: ?organizationId=uuid, optional: period, startDate, endDate)
- `GET /api/analytics/top-products` - Top selling products (required: ?organizationId=uuid, optional: limit, startDate, endDate)
- `GET /api/analytics/top-customers` - Top customers by revenue (required: ?organizationId=uuid, optional: limit, startDate, endDate)

### Files
- `POST /api/files/upload` - Upload file (multipart/form-data, optional: ?folder=subfolder)
- `GET /api/files/:filepath` - Get file
- `DELETE /api/files/:filepath` - Delete file

### PDF
- `POST /api/pdf/quotations/:id/generate` - Generate PDF for quotation (optional: ?template=default)
- `GET /api/pdf/quotations/:id/preview` - Preview HTML for quotation (optional: ?template=default)

### Health
- `GET /api/health` - Health check endpoint

## Project Structure

```
src/
├── common/              # Shared utilities, PrismaService, filters, interceptors
├── organizations/       # Organization module
├── categories/          # Category module
├── files/              # File upload/storage module
├── products/           # Product module
├── quotations/         # Quotation module
├── customers/          # Customer module
├── stock/              # Stock transaction module
├── vendors/            # Vendor module
├── reports/            # Reports module
├── analytics/          # Analytics module
├── pdf/                # PDF generation service
└── main.ts            # Application entry point
```

## Development

The backend runs on port 3001 by default. Make sure your frontend is configured to call `http://localhost:3001/api/*` endpoints.

## License

Private project - PRo Bodyline
