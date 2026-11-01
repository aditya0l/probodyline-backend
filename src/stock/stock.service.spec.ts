import { StockService } from './stock.service';

// Minimal in-memory Prisma: just the filters the projection code uses.
function fakePrisma(products: any[], transactions: any[]) {
  const matches = (row: any, where: any = {}): boolean =>
    Object.entries(where).every(([key, cond]: [string, any]) => {
      const v = row[key];
      if (cond === null) return v === null || v === undefined;
      if (typeof cond !== 'object' || cond instanceof Date) return v === cond;
      if ('in' in cond && !cond.in.includes(v)) return false;
      if ('gte' in cond && !(v >= cond.gte)) return false;
      if ('gt' in cond && !(v > cond.gt)) return false;
      return true;
    });
  const byDate = (a: any, b: any) => a.date.getTime() - b.date.getTime();
  const counter = { queries: 0 };
  return {
    counter,
    product: {
      findMany: async ({ where }: any) => {
        counter.queries++;
        return products.filter((p) => matches(p, where));
      },
      findUnique: async ({ where }: any) => {
        counter.queries++;
        return products.find((p) => p.id === where.id) ?? null;
      },
    },
    stockTransaction: {
      findMany: async ({ where }: any) => {
        counter.queries++;
        return transactions.filter((t) => matches(t, where)).sort(byDate);
      },
      findFirst: async ({ where }: any) => {
        counter.queries++;
        return transactions.filter((t) => matches(t, where)).sort(byDate)[0] ?? null;
      },
    },
  };
}

const day = (offset: number) => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d;
};
const ymd = (offset: number) => day(offset).toISOString().split('T')[0];

describe('StockService.getBulkProjectedStock', () => {
  const products = [
    { id: 'p1', name: 'Bench', modelNumber: 'B-1', todaysStock: 10, cousinMachine: ['R-1', 'X-9'], orderTogether: [], swapMachine: ['B-2'], deletedAt: null },
    { id: 'p2', name: 'Bench Pro', modelNumber: 'B-2', todaysStock: 0, cousinMachine: [], orderTogether: ['B-1'], swapMachine: [], deletedAt: null },
    { id: 'p3', name: 'Rack', modelNumber: 'R-1', todaysStock: 3, cousinMachine: [], orderTogether: [], swapMachine: [], deletedAt: null },
    { id: 'p4', name: 'Old', modelNumber: 'X-9', todaysStock: null, cousinMachine: [], orderTogether: [], swapMachine: [], deletedAt: new Date() },
  ];
  const tx = (productId: string, offset: number, transactionType: string, quantity: number) => ({
    id: `${productId}-${offset}-${transactionType}`,
    productId,
    date: day(offset),
    transactionType,
    quantity,
  });
  const transactions = [
    tx('p1', -5, 'IN', 4),
    tx('p1', 2, 'OUT', 6),
    tx('p1', 10, 'PURCHASE', 5),
    tx('p1', 20, 'SALE', -12),
    tx('p1', 400, 'IN', 50),
    tx('p2', 1, 'IN', 2),
    tx('p2', 3, 'OUT', 5),
    tx('p2', 45, 'IN', 10),
    tx('p3', 8, 'ADJUSTMENT', -1),
  ];

  it.each([ymd(0), ymd(5), ymd(-3), ymd(40)])(
    'matches getStockProjection for every product (date %p)',
    async (date) => {
      const prisma = fakePrisma(products, transactions);
      const service = new StockService(prisma as any, {} as any);
      const ids = ['p1', 'p2', 'p3', 'p4', 'missing'];

      const bulk = await service.getBulkProjectedStock(ids, date);

      const expected = [];
      for (const p of products.filter((x) => ids.includes(x.id))) {
        const projection = await service.getStockProjection(p.id, date);
        expected.push({
          productId: p.id,
          ...projection,
          stockAtDispatch: projection.stockAfterOrderOnDate,
          stockPlus30: projection.stockAfterOrderPlus30Days,
          currentStock: projection.todaysPhysicalStock,
        });
      }
      expect(bulk).toEqual(expected);
    },
  );

  it('uses a fixed number of queries regardless of product count', async () => {
    const prisma = fakePrisma(products, transactions);
    const service = new StockService(prisma as any, {} as any);
    await service.getBulkProjectedStock(['p1', 'p2', 'p3', 'p4'], ymd(0));
    expect(prisma.counter.queries).toBe(4);
  });

  it('falls back per product when the date is unusable, like before', async () => {
    const prisma = fakePrisma(products, transactions);
    const service = new StockService(prisma as any, {} as any);
    const bulk = await service.getBulkProjectedStock(['p1', 'p3'], '');
    expect(bulk).toEqual(
      ['p1', 'p3'].map((productId) => ({
        productId,
        stockAtDispatch: 0,
        stockPlus30: 0,
        currentStock: 0,
        status: 'SAFE',
      })),
    );
  });

  it('returns an empty list when no product matches', async () => {
    const prisma = fakePrisma(products, transactions);
    const service = new StockService(prisma as any, {} as any);
    await expect(service.getBulkProjectedStock(['nope'], ymd(0))).resolves.toEqual([]);
  });
});
