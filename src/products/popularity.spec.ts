import { rankPopularity, type ActivityCounts } from './popularity';

const c = (shares180: number, quotes180 = 0, shares7 = 0, quotes7 = 0): ActivityCounts => ({
  shares180,
  quotes180,
  shares7,
  quotes7,
});

describe('rankPopularity', () => {
  const ids = Array.from({ length: 40 }, (_, i) => `p${i}`);

  it('top 10 are Bestseller, next 20 Popular, rest none', () => {
    // p0 has the most activity, p39 the least (but > 0)
    const counts = new Map(ids.map((id, i) => [id, c(0, 40 - i)]));
    const r = rankPopularity(ids, counts);
    expect(r.get('p0')!.badge).toBe('BESTSELLER');
    expect(r.get('p9')!.badge).toBe('BESTSELLER');
    expect(r.get('p10')!.badge).toBe('POPULAR');
    expect(r.get('p29')!.badge).toBe('POPULAR');
    expect(r.get('p30')!.badge).toBeNull();
  });

  it('adds shares and quotations together', () => {
    const counts = new Map([
      ['a', c(3, 0)],
      ['b', c(1, 1)],
    ]);
    const r = rankPopularity(['b', 'a'], counts);
    expect(r.get('a')!.avgPerDay).toBe(Math.round((3 / 180) * 100) / 100);
    expect(r.get('b')!.shares180 + r.get('b')!.quotes180).toBe(2);
    expect(r.get('a')!.badges).toContain('BESTSELLER');
  });

  it('never badges products with no activity', () => {
    const r = rankPopularity(['x', 'y'], new Map([['x', c(1)]]));
    expect(r.get('x')!.badge).toBe('BESTSELLER');
    expect(r.get('y')!.badges).toEqual([]);
    expect(r.get('y')!.avgPerDay).toBe(0);
  });

  it('trending uses the last 7 days and can stack with Bestseller', () => {
    const counts = new Map([
      ['old', c(50, 0, 0, 0)],
      ['hot', c(5, 0, 3, 2)],
    ]);
    const r = rankPopularity(['old', 'hot'], counts);
    expect(r.get('hot')!.week).toBe(5);
    expect(r.get('hot')!.badges).toEqual(['BESTSELLER', 'TRENDING']);
    expect(r.get('old')!.badges).toEqual(['BESTSELLER']);
  });

  it('shows Trending on the card when not a Bestseller', () => {
    const counts = new Map(ids.map((id, i) => [id, c(0, 40 - i)]));
    counts.set('p35', c(0, 5, 0, 4));
    const r = rankPopularity(ids, counts);
    expect(r.get('p35')!.badge).toBe('TRENDING');
  });
});
