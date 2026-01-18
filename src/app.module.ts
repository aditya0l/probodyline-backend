import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CommonModule } from './common/common.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { CategoriesModule } from './categories/categories.module';
import { FilesModule } from './files/files.module';
import { ProductsModule } from './products/products.module';
import { CustomersModule } from './customers/customers.module';
import { QuotationsModule } from './quotations/quotations.module';
import { PdfModule } from './pdf/pdf.module';
import { StockModule } from './stock/stock.module';
import { VendorsModule } from './vendors/vendors.module';
import { ReportsModule } from './reports/reports.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuthModule } from './auth/auth.module';
import { ClientsModule } from './clients/clients.module';
import { GymsModule } from './gyms/gyms.module';
import { LeadsModule } from './leads/leads.module';
import { BookingsModule } from './bookings/bookings.module';
import { SalesOrdersModule } from './sales-orders/sales-orders.module';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import configuration from './config/configuration';
import { configValidationSchema } from './config/config.schema';

@Module({
  imports: [
    // Serve assets from /public (e.g., logo.png) at the root path; exclude API routes
    ServeStaticModule.forRoot(
      {
        rootPath: join(__dirname, '..', 'public'),
        exclude: ['/api/(.*)'],
        // Explicitly parse path to avoid default '*' which fails path-to-regexp validation
        renderPath: '/__no_fallback__',
      },
      {
        rootPath: join(__dirname, '..', 'uploads'),
        serveRoot: '/uploads',
        // Use a dummy string path to prevent wildcard generation and disable SPA fallback
        renderPath: '/uploads/__non_existent__',
      }
    ),
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: configValidationSchema,
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
    }),
    ThrottlerModule.forRoot([{
      ttl: 60000, // 1 minute
      limit: 100, // 100 requests per minute per IP
    }]),
    CommonModule,
    OrganizationsModule,
    CategoriesModule,
    FilesModule,
    ProductsModule,
    CustomersModule,
    QuotationsModule,
    PdfModule,
    StockModule,
    VendorsModule,
    ReportsModule,
    AnalyticsModule,
    AuthModule,
    // IMPORTANT: GymsModule and ClientsModule must be imported AFTER CommonModule
    // since they depend on PrismaService from CommonModule
    GymsModule,
    ClientsModule,
    LeadsModule,
    BookingsModule,
    SalesOrdersModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  constructor() {
    console.log('🔵 AppModule constructor called');
    console.log('🔵 Checking GymsModule:', typeof GymsModule, GymsModule.name);
    console.log('🔵 Checking ClientsModule:', typeof ClientsModule, ClientsModule.name);
  }

  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
