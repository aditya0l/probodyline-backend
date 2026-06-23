import { PrismaClient, StockTransaction } from '@prisma/client';
import { formatInTimeZone } from 'date-fns-tz';

const IST = 'Asia/Kolkata';

// In-memory cache for the allocation algorithm
const cache = new Map<string, { data: any[]; timestamp: number }>();
const CACHE_TTL = 30 * 1000; // 30 seconds

export function invalidateLedgerCache(productId: string) {
  cache.delete(productId);
}

export async function getLedgerTransactions(
  prisma: any, // or PrismaClient
  productId: string,
  filters?: { startDate?: string; endDate?: string }
) {
  // 1. Check cache if no filters (full ledger)
  if (!filters?.startDate && !filters?.endDate) {
    const cached = cache.get(productId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return { data: cached.data, total: cached.data.length };
    }
  }

  // 2. Fetch product (No openingStock field exists on Prisma model, default to 0)
  const openingStock = 0;

  // 3. Fetch all transactions for this product, strict date ascending
  // Secondary sort by createdAt ascending to ensure deterministic order for same date
  const transactionsRaw = await prisma.stockTransaction.findMany({
    where: { productId },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
  });

  // 4. Single Batch Query Enrichment
  const quotationIds = Array.from(new Set(
    transactionsRaw
      .filter(t => ['PI_BOOKING', 'QUOTATION', 'DISPATCH_SPLIT', 'UNBOOK_SO', 'REVERT_DISPATCH_SPLIT'].includes(t.referenceType))
      .map(t => t.referenceId)
      .filter(Boolean)
  ));

  let quotations: any[] = [];
  if (quotationIds.length > 0) {
    quotations = await prisma.quotation.findMany({
      where: { id: { in: quotationIds } },
      select: {
        id: true,
        clientName: true,
        gymName: true,
        quoteNumber: true,
        bookingDate: true,
        clientCity: true,
        customer: { select: { name: true } },
      }
    });
  }

  const poIds = Array.from(new Set(
    transactionsRaw
      .filter(t => ['PURCHASE_ORDER', 'PURCHASE_ORDER_SPLIT'].includes(t.referenceType))
      .map(t => t.referenceId)
      .filter(Boolean)
  ));

  let purchaseOrders: any[] = [];
  if (poIds.length > 0) {
    purchaseOrders = await prisma.purchaseOrder.findMany({
      where: { id: { in: poIds } },
      select: {
        id: true,
        supplierName: true,
        poNumber: true
      }
    });
  }

  const quotationMap = new Map(quotations.map(q => [q.id, q]));
  const poMap = new Map(purchaseOrders.map(p => [p.id, p]));

  // 5. Build Enriched Rows Map
  let ledgerRows = transactionsRaw.map(t => {
    // Attempt mapping based on referenceType
    let quotation: any = null;
    let po: any = null;

    if (['PI_BOOKING', 'QUOTATION', 'DISPATCH_SPLIT', 'UNBOOK_SO', 'REVERT_DISPATCH_SPLIT'].includes(t.referenceType)) {
      quotation = quotationMap.get(t.referenceId);
    }
    if (['PURCHASE_ORDER', 'PURCHASE_ORDER_SPLIT'].includes(t.referenceType)) {
      po = poMap.get(t.referenceId);
    }

    const type = t.quantity > 0 ? 'IN' : 'OUT';
    
    // Convert date to IST string for display
    const dateStr = formatInTimeZone(t.date, IST, 'yyyy-MM-dd');
    let bookedOnStr: string | null = null;
    if (quotation?.bookingDate) {
      bookedOnStr = formatInTimeZone(quotation.bookingDate, IST, 'yyyy-MM-dd');
    }

    return {
      id: t.id,
      date: dateStr, 
      dispatchDate: dateStr, // Used generically below
      type,
      inQty: type === 'IN' ? t.quantity : null,
      originalOutQty: type === 'OUT' ? Math.abs(t.quantity) : null,
      currentOutQty: type === 'OUT' ? Math.abs(t.quantity) : null,
      outQty: type === 'OUT' ? Math.abs(t.quantity) : null,
      qty: Math.abs(t.quantity), // For calculations
      todaysPhysicalStock: 0,
      factoryName: po?.supplierName ?? '—',
      customerName: quotation?.clientName ?? quotation?.customer?.name ?? '—',
      gymName: quotation?.gymName ?? '—',
      orderNumber: quotation?.quoteNumber ?? po?.poNumber ?? '—',
      bookedOn: bookedOnStr,
      stateCode: quotation?.customer?.stateCode ?? '—',
      city: quotation?.clientCity ?? '—',
      stockOnDispatchDate: 0,
      status: type === 'OUT' ? 'CONFIRM' : null,
      statusQty: type === 'OUT' ? 0 : null,
      exhausted: false, // For rollback algo
      originalTx: t // For filtering
    };
  });

  // 6. Running Balance Calculation (First Pass)
  let runningBalance = openingStock;
  for (const row of ledgerRows) {
    if (row.type === 'IN') {
      runningBalance += row.qty;
    } else if (row.type === 'OUT') {
      runningBalance -= row.qty;
    }
    row.todaysPhysicalStock = runningBalance;
  }

  // 7. Calculate Stock on Dispatch Date (Direct Array Lookup)
  for (const row of ledgerRows) {
    const targetDate = row.date;
    // Find the last row in the ledger on or before this transaction's date
    const previousRows = ledgerRows.filter(r => r.date <= targetDate);
    row.stockOnDispatchDate = previousRows.length > 0 
      ? previousRows[previousRows.length - 1].todaysPhysicalStock 
      : openingStock;
  }

  // 8. Run Rollback Algorithm
  const outRows = ledgerRows
    .filter(r => r.type === 'OUT')
    .sort((a, b) => {
      // Sort ascending by bookedOn
      const aTime = a.bookedOn ? new Date(a.bookedOn).getTime() : 0;
      const bTime = b.bookedOn ? new Date(b.bookedOn).getTime() : 0;
      return aTime - bTime;
    });

  const checkForNegatives = (rows: typeof ledgerRows) => rows.some(r => r.stockOnDispatchDate < 0);

  const recalculateRunningBalances = (rows: typeof ledgerRows) => {
    let running = openingStock;
    for (const row of rows) {
      if (row.type === 'IN') running += row.qty;
      if (row.type === 'OUT') running -= row.currentOutQty;
      row.todaysPhysicalStock = running;
    }

    for (const row of rows) {
      const targetDate = row.date;
      const previousRows = rows.filter(r => r.date <= targetDate);
      row.stockOnDispatchDate = previousRows.length > 0 
        ? previousRows[previousRows.length - 1].todaysPhysicalStock 
        : openingStock;
    }
  };

  let hasNegative = checkForNegatives(ledgerRows);

  while (hasNegative) {
    const candidate = [...outRows]
      .reverse()
      .find(r => r.currentOutQty > 0 && !r.exhausted);

    if (!candidate) break; // Infinite loop safeguard

    // Scan ONLY from this candidate's date downward
    const rowsFromCandidateDown = ledgerRows.filter(r => r.date >= candidate.date);
    const hasNegativeFromHereDown = rowsFromCandidateDown.some(r => r.stockOnDispatchDate < 0);

    if (hasNegativeFromHereDown) {
      if (candidate.currentOutQty > 0) {
        candidate.currentOutQty -= 1;
        candidate.statusQty += 1;
        
        recalculateRunningBalances(ledgerRows);
        hasNegative = checkForNegatives(ledgerRows);
      }
    } else {
      candidate.exhausted = true;
    }
  }

  // 9. Final Status Assignment & Formatting
  for (const row of ledgerRows) {
    if (row.type === 'OUT') {
      row.outQty = row.currentOutQty;
      if (row.statusQty === 0) {
        row.status = 'CONFIRM';
      } else if (row.statusQty > 0 && row.currentOutQty > 0) {
        row.status = 'PARTIAL';
      } else if (row.statusQty > 0 && row.currentOutQty === 0) {
        row.status = 'WAITING LIST';
      }
    }
  }

  // Build the final exact output shape
  const finalOutput = ledgerRows.map(r => ({
    id: r.id,
    date: r.date,
    type: r.type,
    inQty: r.inQty,
    outQty: r.outQty,
    originalOutQty: r.originalOutQty,
    todaysPhysicalStock: r.todaysPhysicalStock,
    factoryName: r.factoryName,
    customerName: r.customerName,
    gymName: r.gymName,
    orderNumber: r.orderNumber,
    bookedOn: r.bookedOn,
    stateCode: r.stateCode,
    city: r.city,
    stockOnDispatchDate: r.stockOnDispatchDate,
    status: r.status,
    statusQty: r.statusQty
  })).reverse(); // Reverse for display so newest is first

  // Filter if dates provided
  let returnRows = finalOutput;
  if (filters?.startDate || filters?.endDate) {
    returnRows = finalOutput.filter(r => {
      let keep = true;
      if (filters.startDate && r.date < filters.startDate) keep = false;
      if (filters.endDate && r.date > filters.endDate) keep = false;
      return keep;
    });
  }

  // Update Cache
  if (!filters?.startDate && !filters?.endDate) {
    cache.set(productId, { data: finalOutput, timestamp: Date.now() });
  }

  return { data: returnRows, total: returnRows.length };
}
