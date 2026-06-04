import { BookingStatus } from '@prisma/client';

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
