const fs = require('fs');

let content = fs.readFileSync('src/products/products.service.ts', 'utf8');

// 1. Update saveOpeningStock
content = content.replace(
  /async saveOpeningStock\(dto: import\('\.\/dto\/opening-stock\.dto'\)\.BatchOpeningStockDto\): Promise<void> \{[\s\S]*?\}\);\n  \}/,
  `async saveOpeningStock(dto: import('./dto/opening-stock.dto').BatchOpeningStockDto): Promise<void> {
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
      }
    });
  }`
);

// 2. Update syncStockFromTransactions
content = content.replace(
  /const currentStock = \(product\.openingStock \|\| 0\) \+ \(result\._sum\.quantity \|\| 0\);/,
  `const currentStock = result._sum.quantity || 0;`
);

// 3. Add clearAllOpeningStock
const classEndIndex = content.lastIndexOf('}');
const clearAllOpeningStockMethod = `
  async clearAllOpeningStock(): Promise<void> {
    await this.prisma.stockTransaction.deleteMany({
      where: { referenceType: 'OPENING_STOCK' },
    });
    await this.syncAllStocks();
  }
`;
content = content.slice(0, classEndIndex) + clearAllOpeningStockMethod + content.slice(classEndIndex);

// 4. Update findAll to fetch opening stock dynamically
// Wait, findAll is currently:
// async findAll(params: { search?: string; ... }): Promise<{ data: Product[]; total: number; page: number; totalPages: number }> { ... }
// I need to map the output to include openingStock.
// Let's find findAll and update it.

fs.writeFileSync('src/products/products.service.ts', content);
console.log('Updated products.service.ts');
