import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Product, Prisma } from '@prisma/client';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    filters?: {
      search?: string;
      productType?: string;
      categoryId?: string;
      page?: number;
      limit?: number;
    },
  ): Promise<{ data: Product[]; total: number }> {
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
          image: true,
          images: true,
          price: true,
          productType: true,
          categoryId: true,
          seriesName: true,
          packagingDescription: true,
          keyword: true,
          todaysStock: true,
          stockPlus360Days: true,
          dateSelectStock: true,
          stockByDate: true,
          mrpStickers: true,
          customDeclarations: true,
          cartonLabel: true,
          machineArtwork: true,
          brochure: true,
          thumbnail: true,
          cousinMachine: true,
          orderTogether: true,
          swapMachine: true,
          brand: true,
          warranty: true,
          notes: true,
          createdAt: true,
          updatedAt: true,
          deletedAt: true,
          category: {
            select: { id: true, name: true },
          },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

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
      throw new BadRequestException('Priority must be greater than or equal to 0');
    }

    // Validate arrays don't exceed limits
    if (data.images && data.images.length > 5) {
      throw new BadRequestException('Maximum 5 images allowed');
    }

    // Validate product name uniqueness
    const existingProduct = await this.prisma.product.findFirst({
      where: {
        name: data.name,
        deletedAt: null,
      },
    });

    if (existingProduct) {
      throw new ConflictException('Product with this name already exists');
    }

    // Get next srNo globally
    const lastProduct = await this.prisma.product.findFirst({
      orderBy: { srNo: 'desc' },
    });

    const srNo = (lastProduct?.srNo || 0) + 1;

    return this.prisma.product.create({
      data: {
        ...data,
        srNo,
        priority: data.priority || 1,
      },
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
      throw new BadRequestException('Priority must be greater than or equal to 0');
    }

    // Validate arrays don't exceed limits
    if (data.images && data.images.length > 5) {
      throw new BadRequestException('Maximum 5 images allowed');
    }

    // Validate product name uniqueness (if name is being changed)
    if (data.name && data.name !== product.name) {
      const existingProduct = await this.prisma.product.findFirst({
        where: {
          name: data.name,
          deletedAt: null,
          NOT: { id },
        },
      });

      if (existingProduct) {
        throw new ConflictException('Product with this name already exists');
      }
    }

    return this.prisma.product.update({
      where: { id },
      data,
    });
  }

  async remove(id: string): Promise<Product> {
    // Soft delete
    return this.prisma.product.update({
      where: { id },
      data: { deletedAt: new Date() },
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

    const { id: _, srNo: __, createdAt: ___, updatedAt: ____, deletedAt: _____, ...productData } = product;

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
}

