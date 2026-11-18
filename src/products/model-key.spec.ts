import { modelKey } from './model-key';

describe('modelKey', () => {
  it('normalises case and separators', () => {
    for (const v of ['BL05_TT', 'BL_05_TT', 'bl-05 tt', 'BL.05.TT']) {
      expect(modelKey(v)).toBe('bl05tt');
    }
  });
  it('returns empty for blank/missing', () => {
    expect(modelKey('')).toBe('');
    expect(modelKey('  -_. ')).toBe('');
    expect(modelKey(null)).toBe('');
    expect(modelKey(undefined)).toBe('');
  });
});
