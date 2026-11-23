import { dormantStockMessage } from './http-exception.filter';

describe('dormantStockMessage', () => {
  it('extracts the trigger message from a Prisma error', () => {
    const e = new Error(
      'Invalid `tx.stockTransaction.create()` invocation:\n\n\nError occurred during query execution:\nConnectorError(ConnectorError { user_facing_error: None, kind: QueryError(PostgresError { code: "P0001", message: "PRODUCT_DORMANT: BL05_TT is dormant and cannot take stock in or out", severity: "ERROR" }) })',
    );
    expect(dormantStockMessage(e)).toBe('BL05_TT is dormant and cannot take stock in or out');
  });
  it('handles a plain message', () => {
    expect(dormantStockMessage(new Error('PRODUCT_DORMANT: OK6_093B is dormant and cannot take stock in or out'))).toBe(
      'OK6_093B is dormant and cannot take stock in or out',
    );
  });
  it('ignores other errors', () => {
    expect(dormantStockMessage(new Error('Unique constraint failed'))).toBeNull();
    expect(dormantStockMessage(undefined)).toBeNull();
  });
});
