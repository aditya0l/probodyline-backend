import * as fs from 'fs';
import * as path from 'path';
import {
  PRODUCT_REFERENCES,
  chooseKeeper,
  findSchemaProductReferences,
  groupByModelKey,
  parseArgs,
  planFieldMerge,
  refLabel,
  rewriteModelArray,
  uniqueConstraintsTouching,
} from '../../scripts/merge-duplicate-products';

const schema = fs.readFileSync(path.join(__dirname, '../../prisma/schema.prisma'), 'utf8');
const p = (id: string, modelNumber: string, created: string) => ({ id, modelNumber, createdAt: new Date(created) });

describe('groupByModelKey', () => {
  it('groups punctuation/case variants, drops singletons and blank keys', () => {
    const groups = groupByModelKey([
      p('b', 'BL_05_TT', '2025-02-01'),
      p('a', 'BL05_TT', '2025-01-01'),
      p('c', 'bl-05 tt', '2025-03-01'),
      p('d', 'BL06', '2025-01-01'),
      p('e', '___', '2025-01-01'),
      p('f', '--', '2025-01-01'),
    ]);
    expect([...groups.keys()]).toEqual(['bl05tt']);
    expect(groups.get('bl05tt')!.map((x) => x.id)).toEqual(['a', 'b', 'c']); // oldest first
  });
});

describe('chooseKeeper', () => {
  const members = [p('old', 'BL05_TT', '2025-01-01'), p('new', 'BL_05_TT', '2025-06-01')];
  it('picks the most referenced', () => {
    const r = chooseKeeper(members, new Map([['old', 1], ['new', 9]]), new Set());
    expect(r.keeper.id).toBe('new');
  });
  it('tie -> oldest createdAt', () => {
    const r = chooseKeeper(members, new Map([['old', 3], ['new', 3]]), new Set());
    expect(r.keeper.id).toBe('old');
    expect(chooseKeeper(members, new Map(), new Set()).keeper.id).toBe('old');
  });
  it('--keep overrides', () => {
    expect(chooseKeeper(members, new Map([['old', 9]]), new Set(['new'])).keeper.id).toBe('new');
  });
  it('rejects two --keep in one group', () => {
    expect(() => chooseKeeper(members, new Map(), new Set(['old', 'new']))).toThrow();
  });
});

describe('planFieldMerge', () => {
  it('fills only empty keeper fields and never overwrites', () => {
    const keeper = { id: 'k', image: 'k.jpg', thumbnail: null, images: [], brochureUrl: '', youtubeLink: 'yt-k', stockByDate: null };
    const dup = { id: 'd', image: 'd.jpg', thumbnail: 'd-thumb.jpg', images: ['d1.jpg'], brochureUrl: 'd.pdf', brochureFilename: 'd.pdf', youtubeLink: 'yt-d', stockByDate: { '2026-01-01': 4 } };
    const { updates } = planFieldMerge(keeper, [dup]);
    expect(updates.image).toBeUndefined();
    expect(updates.youtubeLink).toBeUndefined();
    // thumbnail travels with image: keeper has an image, so the dup's thumbnail is NOT paired with it
    expect(updates.thumbnail).toBeUndefined();
    expect(updates.images.value).toEqual(['d1.jpg']);
    expect(updates.brochureUrl.value).toBe('d.pdf');
    expect(updates.brochureFilename.value).toBe('d.pdf');
    expect(updates.stockByDate.value).toEqual({ '2026-01-01': 4 });
  });
  it('reports conflicting stockByDate instead of merging', () => {
    const r = planFieldMerge({ id: 'k', stockByDate: { a: 1 } }, [{ id: 'd', stockByDate: { a: 2 } }]);
    expect(r.updates.stockByDate).toBeUndefined();
    expect(r.reviews.join()).toMatch(/stockByDate/);
  });
});

describe('rewriteModelArray', () => {
  it('maps any spelling to the keeper, dedupes, drops self refs', () => {
    expect(rewriteModelArray(['BL_05_TT', 'X1', 'bl05tt'], 'bl05tt', 'BL05_TT', 'OTHER')).toEqual(['BL05_TT', 'X1']);
    expect(rewriteModelArray(['BL_05_TT', 'X1'], 'bl05tt', 'BL05_TT', 'BL05_TT')).toEqual(['X1']);
    expect(rewriteModelArray(['BL05_TT', 'X1'], 'bl05tt', 'BL05_TT', 'OTHER')).toBeNull();
    expect(rewriteModelArray([], 'bl05tt', 'BL05_TT', 'OTHER')).toBeNull();
  });
});

describe('parseArgs', () => {
  it('normalises --only to a model key and collects repeatables', () => {
    const o = parseArgs(['--only', 'BL_05_TT', '--only', 'x-1', '--keep', 'id1', '--apply']);
    expect([...o.only]).toEqual(['bl05tt', 'x1']);
    expect([...o.keep]).toEqual(['id1']);
    expect(o.apply).toBe(true);
    expect(() => parseArgs(['--keep'])).toThrow();
  });
});

describe('PRODUCT_REFERENCES vs prisma/schema.prisma', () => {
  const covered = new Set(PRODUCT_REFERENCES.map(refLabel));

  it('covers every Product relation, productId field and model-number copy in the schema', () => {
    const found = findSchemaProductReferences(schema);
    // sanity: the parser really sees the schema
    expect(found.map(refLabel)).toEqual(expect.arrayContaining(['StockTransaction.productId', 'ProductShareEvent.productId', 'Product.cousinMachine']));
    const missing = found.filter((f) => !covered.has(refLabel(f))).map((f) => `${refLabel(f)} (${f.reason})`);
    expect(missing).toEqual([]);
  });

  it('every Product relation FK is re-pointed (not report-only)', () => {
    const fks = findSchemaProductReferences(schema).filter((f) => f.reason === 'relation to Product');
    expect(fks.length).toBeGreaterThanOrEqual(5);
    for (const fk of fks) {
      expect(PRODUCT_REFERENCES.find((r) => refLabel(r) === refLabel(fk))?.action).toBe('repoint');
    }
  });

  it('every listed field exists in the schema', () => {
    for (const r of PRODUCT_REFERENCES) {
      const m = schema.match(new RegExp(`^model\\s+${r.model}\\s*\\{([\\s\\S]*?)^\\}`, 'm'));
      expect(m).not.toBeNull();
      expect(m![1]).toMatch(new RegExp(`^\\s+${r.field}\\s`, 'm'));
      expect(m![1]).toContain(`@@map("${r.table}")`);
    }
  });

  it('no re-pointed field is part of a unique constraint (else the merge needs explicit collision handling)', () => {
    for (const r of PRODUCT_REFERENCES.filter((x) => x.action === 'repoint')) {
      expect({ ref: refLabel(r), unique: uniqueConstraintsTouching(schema, r.model, r.field) }).toEqual({ ref: refLabel(r), unique: [] });
    }
  });

  it('uniqueConstraintsTouching detects constraints', () => {
    expect(uniqueConstraintsTouching(schema, 'DispatchSplit', 'splitNumber')).toHaveLength(1);
    expect(uniqueConstraintsTouching(schema, 'Product', 'modelNumber')).toHaveLength(1);
  });
});
