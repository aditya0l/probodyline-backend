const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const items = await prisma.salesOrderItem.findMany({
    take: 5,
    include: {
      product: true,
      quotationItem: true
    }
  });

  for (const item of items) {
    console.log(item.productName);
    console.log("SalesOrderItem productImage:", item.productImage);
    console.log("QuotationItem productImage:", item.quotationItem?.productImage);
    console.log("Product image:", item.product?.image);
    console.log("Product thumbnail:", item.product?.thumbnail);
    console.log("---");
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
