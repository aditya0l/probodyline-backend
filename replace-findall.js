const fs = require('fs');

let content = fs.readFileSync('src/products/products.service.ts', 'utf8');

const findAllRegex = /async findAll\(filters\?: \{[\s\S]*?\}\): Promise<\{ data: any\[\]; total: number \}> \{[\s\S]*?return \{ data, total \};\n  \}/;

const newFindAll = `async findAll(filters?: {
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
        openingStock: openingStockMap.get(p.id) || 0,
      }));

      return { data: enrichedData, total };
    }

    return { data, total };
  }`;

content = content.replace(findAllRegex, newFindAll);

fs.writeFileSync('src/products/products.service.ts', content);
console.log('Updated findAll');
