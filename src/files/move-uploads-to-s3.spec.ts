import { toLocalRelPath, s3KeyFor, s3UrlFor, remapArray, isQrCode } from '../../scripts/move-uploads-to-s3';

describe('move-uploads-to-s3 helpers', () => {
  it('recognises server-disk addresses in every stored form', () => {
    expect(toLocalRelPath('uploads/a b.png')).toBe('uploads/a b.png');
    expect(toLocalRelPath('/uploads/products/x.jpg')).toBe('uploads/products/x.jpg');
    expect(toLocalRelPath('https://api.probodyline.co.in/api/files/uploads/a%20b.png')).toBe('uploads/a b.png');
    expect(toLocalRelPath('uploads/x.png?v=2')).toBe('uploads/x.png');
  });
  it('ignores S3/CDN/data URLs and unsafe paths', () => {
    expect(toLocalRelPath('https://probodyline-uploads.s3.us-east-1.amazonaws.com/products/x.webp')).toBeNull();
    expect(toLocalRelPath('data:image/png;base64,AAA')).toBeNull();
    expect(toLocalRelPath('uploads/../.env')).toBeNull();
    expect(toLocalRelPath('')).toBeNull();
    expect(toLocalRelPath(null)).toBeNull();
  });
  it('maps files to S3 keys and URLs', () => {
    expect(s3KeyFor('uploads/1779-Screenshot_1.png')).toBe('migrated-uploads/1779-Screenshot_1.webp');
    expect(s3KeyFor('uploads/products/a.JPEG')).toBe('migrated-uploads/products/a.webp');
    expect(s3KeyFor('uploads/doc.pdf')).toBe('migrated-uploads/doc.pdf');
    expect(s3UrlFor('migrated-uploads/a b.webp', 'bkt', 'us-east-1')).toBe('https://bkt.s3.us-east-1.amazonaws.com/migrated-uploads/a%20b.webp');
  });
  it('remaps arrays only when something changes, keeping order', () => {
    const m = new Map([['uploads/a.png', 'S3A']]);
    expect(remapArray(['x', 'uploads/a.png', 'y'], m)).toEqual(['x', 'S3A', 'y']);
    expect(remapArray(['x'], m)).toBeNull();
  });
  it('leaves QR codes alone', () => {
    expect(isQrCode('uploads/qr-00107864-9a03.png')).toBe(true);
    expect(isQrCode('uploads/1779-x.png')).toBe(false);
  });
});
