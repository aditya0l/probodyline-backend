const fs = require('fs');

let content = fs.readFileSync('src/products/products.service.ts', 'utf8');

const regex = /async syncAllStocks\(\): Promise<void> \{[\s\S]*?async findDeleted/g;

const newSyncAllStocks = `async syncAllStocks(): Promise<void> {
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

  async findDeleted`;

content = content.replace(regex, newSyncAllStocks);

fs.writeFileSync('src/products/products.service.ts', content);
console.log('Updated syncAllStocks');
