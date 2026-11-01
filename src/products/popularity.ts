// Ranks products into Bestseller / Popular / Trending from activity counts.
// Activity = WhatsApp shares + quotations the product appears on (one per quotation).

export const POPULARITY_WINDOW_DAYS = 180;
export const TRENDING_WINDOW_DAYS = 7;
export const BESTSELLER_COUNT = 10;
export const POPULAR_COUNT = 20;
export const TRENDING_COUNT = 10;

export type PopularityBadge = 'BESTSELLER' | 'POPULAR' | 'TRENDING';

export interface ActivityCounts {
  shares180: number;
  shares7: number;
  quotes180: number;
  quotes7: number;
}

export interface Popularity extends ActivityCounts {
  avgPerDay: number; // (shares + quotes) per day over the last 180 days
  week: number; // shares + quotes in the last 7 days
  badges: PopularityBadge[];
  badge: PopularityBadge | null; // the one shown on the card
}

const EMPTY: ActivityCounts = { shares180: 0, shares7: 0, quotes180: 0, quotes7: 0 };

/** Top N ids by score; zero scores never qualify, ties keep input order. */
function topIds(ids: string[], score: (id: string) => number, skip: number, take: number): string[] {
  return ids
    .filter((id) => score(id) > 0)
    .map((id, i) => ({ id, i, s: score(id) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(skip, skip + take)
    .map((x) => x.id);
}

export function rankPopularity(
  productIds: string[],
  counts: Map<string, ActivityCounts>,
): Map<string, Popularity> {
  const get = (id: string) => counts.get(id) ?? EMPTY;
  const total = (id: string) => get(id).shares180 + get(id).quotes180;
  const week = (id: string) => get(id).shares7 + get(id).quotes7;

  const best = new Set(topIds(productIds, total, 0, BESTSELLER_COUNT));
  const popular = new Set(topIds(productIds, total, BESTSELLER_COUNT, POPULAR_COUNT));
  const trending = new Set(topIds(productIds, week, 0, TRENDING_COUNT));

  const out = new Map<string, Popularity>();
  for (const id of productIds) {
    const badges: PopularityBadge[] = [];
    if (best.has(id)) badges.push('BESTSELLER');
    if (trending.has(id)) badges.push('TRENDING');
    if (popular.has(id)) badges.push('POPULAR');
    out.set(id, {
      ...get(id),
      avgPerDay: Math.round((total(id) / POPULARITY_WINDOW_DAYS) * 100) / 100,
      week: week(id),
      badges,
      badge: badges[0] ?? null,
    });
  }
  return out;
}
