import { Prisma } from '@prisma/client';

export async function syncProductStock(
  tx: Prisma.TransactionClient,
  productId: string,
) {
  const stockResult = await tx.stockTransaction.aggregate({
    where: { productId },
    _sum: { quantity: true },
  });
  const currentStock = stockResult._sum.quantity || 0;
  await tx.product.update({
    where: { id: productId },
    data: { todaysStock: currentStock },
  });
}
