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
    if (tx.transactionType === 'IN') {
      sortDate = new Date(tx.date);
    } else {
      sortDate = tx.bookedOn ? new Date(tx.bookedOn) : (tx.createdAt ? new Date(tx.createdAt) : new Date(tx.date));
    }
    return { ...tx, sortDate };
  });

  // 2. Sort by sortDate ascending
  txs.sort((a, b) => {
    const timeA = a.sortDate.getTime();
    const timeB = b.sortDate.getTime();
    if (timeA !== timeB) return timeA - timeB;
    return (a.createdAt?.getTime() || 0) - (b.createdAt?.getTime() || 0);
  });

  // 3. Time simulation and running balance
  // INs add to stock, OUTs subtract. 
  // If running balance is negative, it means we have more bookings than stock at this point in the timeline.
  
  let runningStock = startBalance;
  
  // To determine CONFIRM vs WAITING, we just see if the overall total stock (start + all INs up to this point)
  // covers this OUT. Because they are sorted by bookedOn, the running balance perfectly represents
  // whether there is stock available for THIS priority level.
  
  const results = txs.map(tx => {
    let status = 'CONFIRM';
    let waitingQuantity = 0;
    
    if (tx.transactionType === 'IN') {
      runningStock += tx.quantity;
    } else if (tx.transactionType === 'OUT') {
      const required = Math.abs(tx.quantity);
      if (runningStock >= required) {
        status = 'CONFIRM';
        waitingQuantity = 0;
        runningStock -= required;
      } else {
        status = 'WAITING_LIST';
        // If we have some stock but not enough, we partially allocate (runningStock becomes 0)
        // If we are already negative/zero, we just add to waiting list.
        waitingQuantity = required - Math.max(0, runningStock);
        runningStock -= required; // runningStock can go negative to show backlog size!
      }
    } else {
      runningStock += tx.quantity;
    }

    return {
      ...tx,
      runningBalance: runningStock, // Note: For OUTs, this is balance AFTER transaction
      status,
      waitingQuantity
    };
  });

  return results;
}
