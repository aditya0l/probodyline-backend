import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto, UpdateProductMediaDto } from './dto/update-product.dto';
import { Product, Prisma } from '@prisma/client';
import { QRCodeService } from './qr-code.service';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class ProductsService implements OnModuleInit {
  constructor(
    private prisma: PrismaService,
    private qrCodeService: QRCodeService,
    private eventsGateway: EventsGateway,
  ) {}

  async onModuleInit() {
    console.log('[ProductsService] Running product name migration...');
    const productsToUpdate = await this.prisma.product.findMany({
      where: {
        OR: [
          { name: null },
          { name: '' }
        ]
      }
    });
    
    if (productsToUpdate.length > 0) {
      console.log(`[ProductsService] Found ${productsToUpdate.length} products to migrate names for.`);
      for (const product of productsToUpdate) {
        await this.prisma.product.update({
          where: { id: product.id },
          data: { name: product.modelNumber }
        });
      }
      console.log('[ProductsService] Product name migration complete.');
    }
  }

  async findAll(filters?: {
    search?: string;
    productType?: string;
    categoryId?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: any[]; total: number }> {
    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      ...(filters?.search && {
        OR: [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { modelNumber: { contains: filters.search, mode: 'insensitive' } },
          { seriesName: { contains: filters.search, mode: 'insensitive' } },
          { keyword: { has: filters.search } },
        ],
      }),
      ...(filters?.productType && { productType: filters.productType }),
      ...(filters?.categoryId && { categoryId: filters.categoryId }),
    };

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip: (filters?.page || 0) * (filters?.limit || 50),
        take: filters?.limit || 50,
        orderBy: { srNo: 'asc' },
        select: {
          id: true,
          srNo: true,
          priority: true,
          name: true,
          modelNumber: true,
          seriesName: true,
          thumbnail: true,
          price: true,
          image: true,
          images: true,
          qrCode: true,
          todaysStock: true,
          category: {
            select: { id: true, name: true },
          },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    // Fetch opening stock from transactions for the returned products
    if (data.length > 0) {
      const productIds = data.map(p => p.id);
      const openingStocks = await this.prisma.stockTransaction.groupBy({
        by: ['productId'],
        where: {
          productId: { in: productIds },
          referenceType: 'OPENING_STOCK',
        },
        _sum: {
          quantity: true,
        },
      });

      const openingStockMap = new Map();
      openingStocks.forEach(os => {
        openingStockMap.set(os.productId, os._sum.quantity || 0);
      });

      const enrichedData = data.map(p => ({
        ...p,
        openingStockQty: openingStockMap.get(p.id) || 0,
      }));

      return { data: enrichedData, total };
    }

    return { data, total };
  }

  async findOne(id: string): Promise<Product | null> {
    return this.prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
      },
    });
  }

  async create(data: CreateProductDto): Promise<Product> {
    // Validate price
    if (data.price !== undefined && data.price < 0) {
      throw new BadRequestException('Price must be greater than or equal to 0');
    }

    // Validate priority
    if (data.priority !== undefined && data.priority < 0) {
      throw new BadRequestException(
        'Priority must be greater than or equal to 0',
      );
    }

    // Validate arrays don't exceed limits
    if (data.images && data.images.length > 5) {
      throw new BadRequestException('Maximum 5 images allowed');
    }

    // Validate model number uniqueness (required field)
    const existingProduct = await this.prisma.product.findFirst({
      where: {
        modelNumber: data.modelNumber,
        deletedAt: null,
      },
    });

    if (existingProduct) {
      throw new ConflictException(
        'Product with this model number already exists',
      );
    }

    // Get next srNo globally
    const lastProduct = await this.prisma.product.findFirst({
      orderBy: { srNo: 'desc' },
    });

    const srNo = (lastProduct?.srNo || 0) + 1;

    const productData = {
      ...data,
      srNo,
      priority: data.priority || 1,
      cousinMachine: data.cousinMachine || [],
      orderTogether: data.orderTogether || [],
      swapMachine: data.swapMachine || [],
    };

    console.log('[ProductsService.create] Creating product with data:', {
      modelNumber: productData.modelNumber,
      name: productData.name,
      srNo: productData.srNo,
      priority: productData.priority,
      hasId: false, // Will be generated by Prisma
      dataKeys: Object.keys(productData),
    });

    const createdProduct = await this.prisma.product.create({
      data: productData as Prisma.ProductUncheckedCreateInput,
    });

    console.log('[ProductsService.create] Product created successfully:', {
      id: createdProduct.id,
      idType: typeof createdProduct.id,
      srNo: createdProduct.srNo,
      srNoType: typeof createdProduct.srNo,
      modelNumber: createdProduct.modelNumber,
      name: createdProduct.name,
      priority: createdProduct.priority,
      priorityType: typeof createdProduct.priority,
      allFields: Object.keys(createdProduct),
      product: createdProduct,
    });

    // Generate QR code if model number exists (it's now always required)
    if (createdProduct.modelNumber) {
      try {
        const qrCodePath = await this.qrCodeService.generateProductQRCode(
          createdProduct.id,
          createdProduct.modelNumber,
        );

        // Update product with QR code path
        return this.prisma.product.update({
          where: { id: createdProduct.id },
          data: { qrCode: qrCodePath },
        });
      } catch (error) {
        console.error(
          '[ProductsService.create] Failed to generate QR code:',
          error,
        );
        // Return product without QR code if generation fails
        return createdProduct;
      }
    }

    // Return product without QR code if model number is null
    return createdProduct;
  }

  async saveOpeningStock(dto: import('./dto/opening-stock.dto').BatchOpeningStockDto): Promise<void> {
    await this.prisma.$transaction(async (prisma) => {
      for (const item of dto.data) {
        // Delete existing OPENING_STOCK transactions for this product
        await prisma.stockTransaction.deleteMany({
          where: {
            productId: item.productId,
            referenceType: 'OPENING_STOCK',
          },
        });

        // Create new OPENING_STOCK transaction if quantity > 0
        if (item.quantity > 0) {
          await prisma.stockTransaction.create({
            data: {
              productId: item.productId,
              transactionType: 'IN',
              quantity: item.quantity,
              referenceType: 'OPENING_STOCK',
              date: new Date('2026-04-01T00:00:00Z'),
              notes: 'Opening Stock',
            },
          });
        }

        // Recalculate todaysStock
        const result = await prisma.stockTransaction.aggregate({
          where: { productId: item.productId },
          _sum: { quantity: true },
        });

        const currentStock = result._sum.quantity || 0;
        await prisma.product.update({
          where: { id: item.productId },
          data: { todaysStock: currentStock },
        });

        this.eventsGateway.broadcastEntityUpdate('STOCK', item.productId);
      }
    });
  }

  async update(id: string, data: UpdateProductDto): Promise<Product> {
    // Check if product exists
    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Validate price
    if (data.price !== undefined && data.price < 0) {
      throw new BadRequestException('Price must be greater than or equal to 0');
    }

    // Validate priority
    if (data.priority !== undefined && data.priority < 0) {
      throw new BadRequestException(
        'Priority must be greater than or equal to 0',
      );
    }

    // Validate arrays don't exceed limits
    if (data.images && data.images.length > 5) {
      throw new BadRequestException('Maximum 5 images allowed');
    }

    // Note: modelNumber is immutable and cannot be updated (excluded from UpdateProductDto)

    return this.prisma.product.update({
      where: { id },
      data: data as Prisma.ProductUncheckedUpdateInput,
    });
  }

  async updateMedia(id: string, data: UpdateProductMediaDto): Promise<Product> {
    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return this.prisma.product.update({
      where: { id },
      data: data as Prisma.ProductUncheckedUpdateInput,
    });
  }

  async findQuotationsByProduct(productId: string) {
    return this.prisma.quotation.findMany({
      where: {
        items: {
          some: {
            productId,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        customer: true,
      },
    });
  }

  async findSalesOrdersByProduct(productId: string) {
    return this.prisma.salesOrder.findMany({
      where: {
        quotation: {
          items: {
            some: {
              productId,
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        quotation: {
          include: {
            customer: true,
          },
        },
      },
    });
  }

  async remove(id: string): Promise<Product> {
    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Soft delete: Rename modelNumber to free it up for reuse
    return this.prisma.product.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        modelNumber: `${product.modelNumber}_DEL_${Date.now()}`,
      },
    });
  }

  async duplicate(id: string): Promise<Product> {
    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Get next srNo globally
    const lastProduct = await this.prisma.product.findFirst({
      orderBy: { srNo: 'desc' },
    });

    const srNo = (lastProduct?.srNo || 0) + 1;

    const {
      id: _,
      srNo: __,
      createdAt: ___,
      updatedAt: ____,
      deletedAt: _____,
      ...productData
    } = product;

    return this.prisma.product.create({
      data: {
        ...productData,
        name: `${product.name} (Copy)`,
        srNo,
        stockByDate: product.stockByDate as any,
      },
    });
  }

  async syncStockFromTransactions(productId: string): Promise<Product> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Calculate current stock from transactions
    const result = await this.prisma.stockTransaction.aggregate({
      where: { productId },
      _sum: { quantity: true },
    });

    const currentStock = result._sum.quantity || 0;

    // Update product's todaysStock
    return this.prisma.product.update({
      where: { id: productId },
      data: { todaysStock: currentStock },
    });
  }

  async syncAllStocks(): Promise<void> {
    // Get all products
    const products = await this.prisma.product.findMany({
      where: {
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (products.length === 0) return;

    // Calculate stock for all products in a single query using groupBy
    const stockAggregations = await this.prisma.stockTransaction.groupBy({
      by: ['productId'],
      where: {
        productId: { in: products.map((p) => p.id) },
      },
      _sum: {
        quantity: true,
      },
    });

    // Create a map of productId -> currentStock
    const stockMap = new Map<string, number>();
    stockAggregations.forEach((agg) => {
      stockMap.set(agg.productId, agg._sum.quantity || 0);
    });

    // Batch update all products in parallel
    await Promise.all(
      products.map((product) => {
        const currentStock = stockMap.get(product.id) || 0;
        return this.prisma.product.update({
          where: { id: product.id },
          data: { todaysStock: currentStock },
        });
      }),
    );
  }

  async findDeleted(): Promise<Product[]> {
    return this.prisma.product.findMany({
      where: {
        deletedAt: { not: null },
      },
      include: {
        category: {
          select: { id: true, name: true },
        },
      },
      orderBy: { deletedAt: 'desc' },
    });
  }

  async restore(id: string): Promise<Product> {
    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (!product.deletedAt) {
      throw new BadRequestException('Product is not deleted');
    }

    return this.prisma.product.update({
      where: { id },
      data: { deletedAt: null },
    });
  }

  async toggleDormant(id: string, isDormant: boolean): Promise<Product> {
    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return this.prisma.product.update({
      where: { id },
      data: { isDormant },
    });
  }

  async regenerateAllQRs(): Promise<{ count: number; errors: number }> {
    const products = await this.prisma.product.findMany({
      where: { deletedAt: null },
      select: { id: true, modelNumber: true },
    });

    let count = 0;
    let errors = 0;

    for (const product of products) {
      if (product.modelNumber) {
        try {
          const qrCodePath = await this.qrCodeService.generateProductQRCode(
            product.id,
            product.modelNumber,
          );

          await this.prisma.product.update({
            where: { id: product.id },
            data: { qrCode: qrCodePath },
          });
          count++;
        } catch (error) {
          console.error(
            `Failed to regenerate QR for product ${product.id}:`,
            error,
          );
          errors++;
        }
      }
    }

    return { count, errors };
  }

  async clearAllOpeningStock(): Promise<void> {
    await this.prisma.stockTransaction.deleteMany({
      where: { referenceType: 'OPENING_STOCK' },
    });
    await this.syncAllStocks();
  }
}
