import { PurchaseOrdersService } from './purchase-orders.service';

/**
 * Small in-memory stand-in for the Prisma calls PurchaseOrdersService.update()
 * makes. `$transaction(cb)` just runs `cb` with the same fake client.
 */
function makeFakePrisma(initial: { po: any; stockTxs: any[] }) {
  const state = {
    po: JSON.parse(JSON.stringify(initial.po), reviveDates),
    stockTxs: initial.stockTxs.map((t) => ({ ...t })),
  };
  let seq = 0;

  const matches = (t: any, where: any) =>
    (where.referenceType === undefined || t.referenceType === where.referenceType) &&
    (where.referenceId === undefined ||
      (typeof where.referenceId === 'object'
        ? where.referenceId.in.includes(t.referenceId)
        : t.referenceId === where.referenceId)) &&
    (where.productId === undefined ||
      (typeof where.productId === 'object'
        ? where.productId.in.includes(t.productId)
        : t.productId === where.productId));

  const client: any = {
    purchaseOrder: {
      // return a fresh copy each time, like real Prisma does
      findUnique: jest.fn(async () => JSON.parse(JSON.stringify(state.po), reviveDates)),
      update: jest.fn(async ({ data }: any) => {
        Object.assign(state.po, data);
        return JSON.parse(JSON.stringify(state.po), reviveDates);
      }),
    },
    purchaseOrderItem: {
      upsert: jest.fn(async ({ where, update, create }: any) => {
        const existing = state.po.items.find((i: any) => i.id === where.id);
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const created = { id: `item-new-${++seq}`, ...create };
        state.po.items.push(created);
        return created;
      }),
      deleteMany: jest.fn(async ({ where }: any) => {
        state.po.items = state.po.items.filter(
          (i: any) => !where.productId.in.includes(i.productId),
        );
      }),
    },
    stockTransaction: {
      create: jest.fn(async ({ data }: any) => {
        const row = { id: `tx-new-${++seq}`, ...data };
        state.stockTxs.push(row);
        return row;
      }),
      deleteMany: jest.fn(async ({ where }: any) => {
        state.stockTxs = state.stockTxs.filter((t) => !matches(t, where));
      }),
      aggregate: jest.fn(async ({ where }: any) => ({
        _sum: {
          quantity: state.stockTxs
            .filter((t) => t.productId === where.productId)
            .reduce((s, t) => s + t.quantity, 0),
        },
      })),
    },
    product: { update: jest.fn(async () => ({})) },
  };
  client.$transaction = jest.fn(async (cb: any) => cb(client));
  return { client, state };
}

function reviveDates(key: string, value: any) {
  if ((key === 'jaipurArrival' || key === 'bookedOn' || key === 'date') && typeof value === 'string') {
    return new Date(value);
  }
  return value;
}

const OLD_DATE = new Date('2026-11-05T00:00:00.000Z');
const NEW_DATE = '2027-06-28T00:00:00.000Z';

function basePo() {
  return {
    id: 'po-1',
    poNumber: 'PO_20260086',
    supplierName: 'Factory A',
    bookedOn: new Date('2026-01-01T00:00:00.000Z'),
    jaipurArrival: OLD_DATE,
    jaipurArrivalManual: false,
    piNo: null,
    approvedOn: null,
    status: 'DRAFT',
    notes: null,
    items: [
      { id: 'item-a', productId: 'prod-a', productName: 'A', modelNumber: 'A1', rate: 100, quantity: 10, amount: 1000 },
      { id: 'item-b', productId: 'prod-b', productName: 'B', modelNumber: 'B1', rate: 50, quantity: 4, amount: 200 },
    ],
    splits: [
      {
        id: 'split-1',
        jaipurArrival: new Date('2026-12-01T00:00:00.000Z'),
        items: [{ id: 'si-1', purchaseOrderItemId: 'item-a', quantity: 3 }],
      },
    ],
  };
}

function baseStockTxs() {
  return [
    // pending rows on the old PO date (A: 10 - 3 allocated = 7, B: 4)
    { id: 'tx-a', productId: 'prod-a', quantity: 7, transactionType: 'IN', referenceType: 'PURCHASE_ORDER', referenceId: 'po-1', date: OLD_DATE, notes: 'PO Pending — PO_20260086 (7 of 10 unallocated)' },
    { id: 'tx-b', productId: 'prod-b', quantity: 4, transactionType: 'IN', referenceType: 'PURCHASE_ORDER', referenceId: 'po-1', date: OLD_DATE, notes: 'PO Pending — PO_20260086 (4 of 4 unallocated)' },
    // split row, dated by the split's own arrival
    { id: 'tx-split', productId: 'prod-a', quantity: 3, transactionType: 'IN', referenceType: 'PURCHASE_ORDER_SPLIT', referenceId: 'split-1', date: new Date('2026-12-01T00:00:00.000Z') },
  ];
}

function itemsPayload(po: any) {
  return po.items.map((i: any) => ({
    productId: i.productId,
    productName: i.productName,
    modelNumber: i.modelNumber,
    rate: i.rate,
    quantity: i.quantity,
    amount: i.amount,
  }));
}

describe('PurchaseOrdersService.update — PO Pending stock rows', () => {
  const gateway = { broadcastEntityUpdate: jest.fn() };

  const pendingRows = (state: any) =>
    state.stockTxs.filter((t: any) => t.referenceType === 'PURCHASE_ORDER' && t.referenceId === 'po-1');

  it('re-dates every pending row when only the date changes but items are sent (Edit Order form)', async () => {
    const po = basePo();
    const { client, state } = makeFakePrisma({ po, stockTxs: baseStockTxs() });
    const service = new PurchaseOrdersService(client, gateway as any);

    await service.update('po-1', { jaipurArrival: NEW_DATE, items: itemsPayload(po) });

    const pending = pendingRows(state);
    expect(pending).toHaveLength(2);
    const a = pending.find((t: any) => t.productId === 'prod-a');
    const b = pending.find((t: any) => t.productId === 'prod-b');
    expect(a.date.toISOString()).toBe(NEW_DATE);
    expect(a.quantity).toBe(7); // 10 total - 3 allocated in split
    expect(a.notes).toBe('PO Pending — PO_20260086 (7 of 10 unallocated)');
    expect(b.date.toISOString()).toBe(NEW_DATE);
    expect(b.quantity).toBe(4);

    // split row untouched
    const split = state.stockTxs.find((t: any) => t.id === 'tx-split');
    expect(split.date.toISOString()).toBe('2026-12-01T00:00:00.000Z');
  });

  it('re-dates pending rows when the client sends explicit changed/new/removed ids that do not list them', async () => {
    const po = basePo();
    const { client, state } = makeFakePrisma({ po, stockTxs: baseStockTxs() });
    const service = new PurchaseOrdersService(client, gateway as any);

    await service.update('po-1', {
      jaipurArrival: NEW_DATE,
      items: itemsPayload(po),
      changedProductIds: [],
      newProductIds: [],
      removedProductIds: [],
    });

    const pending = pendingRows(state);
    expect(pending).toHaveLength(2);
    expect(pending.every((t: any) => t.date.toISOString() === NEW_DATE)).toBe(true);
  });

  it('still re-dates pending rows on a date-only change without items', async () => {
    const { client, state } = makeFakePrisma({ po: basePo(), stockTxs: baseStockTxs() });
    const service = new PurchaseOrdersService(client, gateway as any);

    await service.update('po-1', { jaipurArrival: NEW_DATE });

    const pending = pendingRows(state);
    expect(pending).toHaveLength(2);
    expect(pending.find((t: any) => t.productId === 'prod-a').quantity).toBe(7);
    expect(pending.every((t: any) => t.date.toISOString() === NEW_DATE)).toBe(true);
  });

  it('date change + quantity change + removed product: no duplicate rows, removed product cleared', async () => {
    const po = basePo();
    const { client, state } = makeFakePrisma({ po, stockTxs: baseStockTxs() });
    const service = new PurchaseOrdersService(client, gateway as any);

    const items = itemsPayload(po).filter((i: any) => i.productId === 'prod-a');
    items[0].quantity = 12;
    items.push({ productId: 'prod-c', productName: 'C', modelNumber: 'C1', rate: 10, quantity: 5, amount: 50 });

    await service.update('po-1', { jaipurArrival: NEW_DATE, items });

    const pending = pendingRows(state);
    expect(pending.map((t: any) => t.productId).sort()).toEqual(['prod-a', 'prod-c']);
    expect(pending.find((t: any) => t.productId === 'prod-a').quantity).toBe(9); // 12 - 3
    expect(pending.find((t: any) => t.productId === 'prod-c').quantity).toBe(5);
    expect(pending.every((t: any) => t.date.toISOString() === NEW_DATE)).toBe(true);
  });

  it('quantity change without date change only rebuilds the edited product', async () => {
    const po = basePo();
    const { client, state } = makeFakePrisma({ po, stockTxs: baseStockTxs() });
    const service = new PurchaseOrdersService(client, gateway as any);

    const items = itemsPayload(po);
    items.find((i: any) => i.productId === 'prod-b').quantity = 6;

    await service.update('po-1', { jaipurArrival: OLD_DATE.toISOString(), items });

    const pending = pendingRows(state);
    expect(pending).toHaveLength(2);
    // untouched original row for A
    expect(pending.find((t: any) => t.productId === 'prod-a').id).toBe('tx-a');
    const b = pending.find((t: any) => t.productId === 'prod-b');
    expect(b.id).not.toBe('tx-b');
    expect(b.quantity).toBe(6);
    expect(b.date.toISOString()).toBe(OLD_DATE.toISOString());
  });
});
