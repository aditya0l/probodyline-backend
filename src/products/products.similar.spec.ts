import { ProductsService } from './products.service';

describe('ProductsService.findSimilar', () => {
  const queryRaw = jest.fn();
  const service = new ProductsService({ $queryRaw: queryRaw } as any, {} as any, {} as any);
  beforeEach(() => queryRaw.mockReset());

  it('returns matches using the normalised key', async () => {
    const rows = [{ id: '1', name: 'X', modelNumber: 'BL_05_TT', seriesName: null, image: null, thumbnail: null }];
    queryRaw.mockResolvedValue(rows);
    await expect(service.findSimilar('bl-05 tt')).resolves.toEqual(rows);
    const values = queryRaw.mock.calls[0].slice(1);
    expect(values).toContain('bl05tt');
    expect(values).toContain(null);
  });

  it('passes excludeId', async () => {
    queryRaw.mockResolvedValue([]);
    await service.findSimilar('BL05TT', 'abc');
    expect(queryRaw.mock.calls[0].slice(1)).toContain('abc');
  });

  it('returns [] for blank without querying', async () => {
    await expect(service.findSimilar('  -_ ')).resolves.toEqual([]);
    expect(queryRaw).not.toHaveBeenCalled();
  });
});
