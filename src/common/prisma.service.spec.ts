import { PrismaService } from './prisma.service';

// Captures the query Prisma would send to the engine, without a database.
function captureQuery(prisma: PrismaService, run: () => Promise<unknown>) {
  let protocolQuery: any;
  jest
    .spyOn((prisma as any)._requestHandler, 'request')
    .mockImplementation(async (req: any) => {
      protocolQuery = req.protocolQuery;
      return null;
    });
  return run().then(() => protocolQuery);
}

describe('PrismaService password omission', () => {
  let prisma: PrismaService;

  beforeAll(() => {
    process.env.DATABASE_URL ??= 'postgresql://u:p@localhost:5432/db';
    prisma = new PrismaService();
  });

  it('leaves password out of nested user relations (SO detail)', async () => {
    const query = await captureQuery(prisma, () =>
      prisma.salesOrder.findUnique({
        where: { id: 'so-1' },
        include: {
          quantityRequests: { include: { user: true, reviewer: true } },
          activities: { include: { user: true } },
        },
      }),
    );
    const sel = query.query.selection;
    expect(sel.quantityRequests.selection.user.selection.password).toBe(false);
    expect(sel.quantityRequests.selection.reviewer.selection.password).toBe(false);
    expect(sel.activities.selection.user.selection.password).toBe(false);
  });

  it('leaves password out of direct user queries', async () => {
    const query = await captureQuery(prisma, () => prisma.user.findMany());
    expect(query.query.selection.password).toBe(false);
  });

  it('includes password only when a query opts back in', async () => {
    const query = await captureQuery(prisma, () =>
      prisma.user.findUnique({
        where: { email: 'a@b.c' },
        omit: { password: false },
      }),
    );
    expect(query.query.selection.password).not.toBe(false);
  });
});
