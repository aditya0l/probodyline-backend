import { BookingStatus } from '@prisma/client';

export type EnrichedTransaction = any;

/**
 * Legacy single-row calculation for simple endpoints
 */
export function calculateFifoAllocation(runningStock: number, requiredQuantity: number) {
  let status: BookingStatus;
  let waitingQuantity = 0;
  let newRunningStock = runningStock;

  if (runningStock >= requiredQuantity) {
    status = BookingStatus.CONFIRM;
    waitingQuantity = 0;
    newRunningStock = runningStock - requiredQuantity;
  } else {
    status = BookingStatus.WAITING_LIST;
    waitingQuantity = requiredQuantity - Math.max(0, runningStock);
    newRunningStock = 0;
  }

  return {
    status,
    waitingQuantity,
    runningStock: newRunningStock,
  };
}

/**
 * Strict BookedOn FIFO Allocation for Ledger
 */
export function processStrictFifoLedger(
  transactions: EnrichedTransaction[],
  startBalance: number
): EnrichedTransaction[] {
  // 1. Assign sortDate: physical date for IN, bookedOn for OUT
  const txs = transactions.map(tx => {
    let sortDate: Date;
    if (tx.transactionType === 'IN' || tx.transactionType === 'PURCHASE') {
      sortDate = new Date(tx.date);
    } else {
      sortDate = tx.bookedOn ? new Date(tx.bookedOn) : (tx.createdAt ? new Date(tx.createdAt) : new Date(tx.date));
    }
    return { ...tx, sortDate };
  });

  // 2. Sort by sortDate ascending for display purposes
  txs.sort((a, b) => {
    const timeA = a.sortDate.getTime();
    const timeB = b.sortDate.getTime();
    if (timeA !== timeB) return timeA - timeB;
    return (a.createdAt?.getTime() || 0) - (b.createdAt?.getTime() || 0);
  });

  // 3. Bucket Allocation Algorithm
  // Create buckets for available stock (Opening stock + all INs)
  interface StockBucket {
    date: Date;
    available: number;
    total: number;
  }
  
  const buckets: StockBucket[] = [];
  buckets.push({ date: new Date(0), available: startBalance, total: startBalance }); // Available since beginning of time
  
  for (const tx of transactions) {
    if (tx.transactionType === 'IN' || tx.transactionType === 'PURCHASE') {
      buckets.push({ date: new Date(tx.date), available: tx.quantity, total: tx.quantity });
    }
  }
  
  // Sort buckets chronologically
  buckets.sort((a, b) => a.date.getTime() - b.date.getTime());

  // 4. Sort OUT transactions strictly by Priority (BookedOn) to process allocation
  const outs = txs.filter(t => t.transactionType === 'OUT' || t.transactionType === 'SALE');
  const outsForAllocation = [...outs].sort((a, b) => {
    const timeA = (a.bookedOn ? new Date(a.bookedOn) : new Date(a.date)).getTime();
    const timeB = (b.bookedOn ? new Date(b.bookedOn) : new Date(b.date)).getTime();
    if (timeA !== timeB) return timeA - timeB;
    return (a.createdAt?.getTime() || 0) - (b.createdAt?.getTime() || 0);
  });

  // Process allocation by priority
  const allocationMap = new Map<string, { status: string, waitingQuantity: number }>();
  
  for (const tx of outsForAllocation) {
    let required = Math.abs(tx.quantity);
    let fulfilled = 0;
    const txDate = new Date(tx.date); // Dispatch date
    
    // Find stock from buckets, strict priority allocation regardless of arrival date vs dispatch date
    // (If stock arrives later than requested dispatch, it's a delayed delivery, but the stock is still theirs)
    for (const bucket of buckets) {
      if (bucket.available > 0) {
        const take = Math.min(bucket.available, required - fulfilled);
        bucket.available -= take;
        fulfilled += take;
        if (fulfilled === required) break;
      }
    }
    
    if (fulfilled === required) {
      allocationMap.set(tx.id, { status: 'CONFIRM', waitingQuantity: 0 });
    } else {
      allocationMap.set(tx.id, { status: 'WAITING_LIST', waitingQuantity: required - fulfilled });
    }
  }

  // 5. Calculate sequential running balances 
  // This produces a standard top-to-bottom ledger balance as requested by the user
  let currentBalance = startBalance;
  
  const results = txs.map(tx => {
    let status = 'CONFIRM';
    let waitingQuantity = 0;
    
    if (tx.transactionType === 'IN' || tx.transactionType === 'PURCHASE') {
      currentBalance += tx.quantity;
    } else if (tx.transactionType === 'OUT' || tx.transactionType === 'SALE') {
      const alloc = allocationMap.get(tx.id);
      if (alloc) {
        status = alloc.status;
        waitingQuantity = alloc.waitingQuantity;
      }
      currentBalance -= Math.abs(tx.quantity);
    }

    return {
      ...tx,
      runningBalance: currentBalance, 
      status,
      waitingQuantity
    };
  });

  return results;
}
