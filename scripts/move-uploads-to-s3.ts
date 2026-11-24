/**
 * Move product photos that still live on the server disk (uploads/...) to S3,
 * so they load through the CloudFront CDN and quotation PDFs embed them at full
 * resolution (local files are shrunk to 400px JPEG by the PDF helper).
 *
 *   npx ts-node scripts/move-uploads-to-s3.ts                    # dry run (default): converts in memory, uploads nothing, writes nothing
 *   npx ts-node scripts/move-uploads-to-s3.ts --apply            # backup JSON, upload to S3, then repoint database rows
 *   npx ts-node scripts/move-uploads-to-s3.ts --revert <file>    # dry run of the revert
 *   npx ts-node scripts/move-uploads-to-s3.ts --revert <file> --apply
 *   --quality <n>   WebP quality (default 90). --lossless for lossless WebP.
 *
 * Images (png/jpg/jpeg/gif/webp) become WebP, same pixel size (capped at 2000px,
 * like new uploads). Other files are uploaded unchanged. Originals on disk are
 * never deleted, so old addresses keep working. products.qrCode is not touched
 * (the app generates those files itself).
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import { PrismaClient } from '@prisma/client';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

export interface PhotoColumn {
  table: string;
  column: string;
  array: boolean;
  label: string;
}

/** Every column that stores a product photo address (found by scanning the schema for "uploads/" values). */
export const PHOTO_COLUMNS: PhotoColumn[] = [
  { table: 'products', column: 'images', array: true, label: 'product photos' },
  { table: 'products', column: 'image', array: false, label: 'product main photo' },
  { table: 'products', column: 'thumbnail', array: false, label: 'product thumbnail' },
  { table: 'quotation_items', column: 'productImage', array: false, label: 'quotation lines' },
  { table: 'sales_order_items', column: 'productImage', array: false, label: 'sales order lines' },
  { table: 'purchase_order_items', column: 'productImage', array: false, label: 'purchase order lines' },
  { table: 'bookings', column: 'productThumbnail', array: false, label: 'bookings' },
];

export const S3_PREFIX = 'migrated-uploads/';
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp']);
const CONTENT_TYPE: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

/** "uploads/a.png", "/uploads/a.png", "https://api.x/api/files/uploads/a.png" -> "uploads/a.png"; anything else -> null. */
export function toLocalRelPath(value: string | null | undefined): string | null {
  if (!value) return null;
  let v = value.trim();
  const i = v.indexOf('/api/files/');
  if (/^https?:\/\//i.test(v)) {
    if (i === -1) return null;
    v = v.slice(i + '/api/files/'.length);
    try {
      v = v.split('/').map(decodeURIComponent).join('/');
    } catch {
      return null;
    }
  }
  v = v.replace(/^\/+/, '').split(/[?#]/)[0];
  if (!v.startsWith('uploads/')) return null;
  if (v.split('/').some((seg) => seg === '..' || seg === '')) return null; // no traversal / empty segments
  return v;
}

export const isQrCode = (rel: string) => /^uploads\/qr-[^/]+\.png$/i.test(rel);

/** S3 key for a local file: keeps the folder and name, images get a .webp extension. */
export function s3KeyFor(rel: string): string {
  const ext = path.extname(rel).toLowerCase();
  const inside = rel.slice('uploads/'.length);
  const base = IMAGE_EXT.has(ext) ? inside.slice(0, inside.length - ext.length) + '.webp' : inside;
  return S3_PREFIX + base;
}

export function s3UrlFor(key: string, bucket: string, region: string): string {
  return `https://${bucket}.s3.${region}.amazonaws.com/${key.split('/').map(encodeURIComponent).join('/')}`;
}

/** Replace mapped entries of an array; returns null when nothing changes. */
export function remapArray(list: string[], map: Map<string, string>): string[] | null {
  let changed = false;
  const next = list.map((v) => {
    const n = map.get(v);
    if (n && n !== v) changed = true;
    return n ?? v;
  });
  return changed ? next : null;
}

// ---------------------------------------------------------------------------

interface FilePlan {
  rel: string;
  key: string;
  url: string;
  exists: boolean;
  converted: boolean;
  width?: number;
  height?: number;
  capped?: boolean;
  bytesBefore: number;
  bytesAfter: number;
  error?: string;
}

interface RowChange {
  table: string;
  column: string;
  id: string;
  old: string | string[];
  new: string | string[];
}

interface Backup {
  version: 1;
  createdAt: string;
  database: string;
  options: { quality: number; lossless: boolean };
  files: FilePlan[];
  rows: RowChange[];
  status: string;
}

function parseArgs(argv: string[]) {
  const o = { apply: false, revert: '', quality: 90, lossless: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') o.apply = true;
    else if (a === '--lossless') o.lossless = true;
    else if (a === '--quality') o.quality = Number(argv[++i]);
    else if (a === '--revert') o.revert = argv[++i];
    else throw new Error(`unknown argument ${a}`);
  }
  if (!(o.quality >= 1 && o.quality <= 100)) throw new Error('--quality must be 1-100');
  return o;
}

const kb = (n: number) => `${(n / 1024).toFixed(0)} KB`;
const mb = (n: number) => `${(n / 1048576).toFixed(1)} MB`;

function describeDb(): string {
  try {
    const u = new URL(process.env.DATABASE_URL ?? '');
    return `${u.hostname}:${u.port || 5432}${u.pathname}`;
  } catch {
    return '(DATABASE_URL not set)';
  }
}

async function convert(buf: Buffer, ext: string, opts: { quality: number; lossless: boolean }) {
  if (!IMAGE_EXT.has(ext)) return { body: buf, converted: false, contentType: CONTENT_TYPE[ext] ?? 'application/octet-stream' };
  const img = sharp(buf, { animated: ext === '.gif' }).rotate();
  const meta = await sharp(buf).metadata();
  const out = await img
    .resize(2000, 2000, { fit: 'inside', withoutEnlargement: true })
    .webp(opts.lossless ? { lossless: true } : { quality: opts.quality })
    .toBuffer({ resolveWithObject: true });
  const capped = (meta.width ?? 0) > 2000 || (meta.height ?? 0) > 2000;
  return { body: out.data, converted: true, contentType: 'image/webp', width: out.info.width, height: out.info.height, capped };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const uploadsRoot = path.resolve(process.env.UPLOADS_ROOT || path.join(__dirname, '..', 'uploads'));
  const bucket = process.env.AWS_S3_BUCKET || 'probodyline-uploads';
  const region = process.env.AWS_REGION || 'us-east-1';
  const prisma = new PrismaClient();
  const s3 = new S3Client({
    region,
    credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID || '', secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '' },
  });
  console.log(`Database: ${describeDb()}\nUploads folder: ${uploadsRoot}\nBucket: ${bucket} (${region})`);

  try {
    if (opts.revert) return await revert(prisma, opts.revert, opts.apply);

    console.log(`Mode: ${opts.apply ? 'APPLY' : 'DRY RUN (nothing uploaded or written)'}; WebP ${opts.lossless ? 'lossless' : `quality ${opts.quality}`}\n`);

    // 1. Collect references.
    const refs: Array<{ col: PhotoColumn; id: string; value: string | string[] }> = [];
    const perColumn = new Map<string, { rows: number; refs: number }>();
    const rels = new Set<string>();
    for (const col of PHOTO_COLUMNS) {
      const rows = await prisma.$queryRawUnsafe<{ id: string; v: any }[]>(`SELECT id, "${col.column}" AS v FROM "${col.table}"`);
      let nRows = 0, nRefs = 0;
      for (const r of rows) {
        const values: string[] = col.array ? r.v ?? [] : r.v ? [r.v] : [];
        const local = values.map(toLocalRelPath).filter((x): x is string => !!x && !isQrCode(x));
        if (!local.length) continue;
        nRows++;
        nRefs += local.length;
        local.forEach((x) => rels.add(x));
        refs.push({ col, id: r.id, value: r.v });
      }
      perColumn.set(`${col.table}.${col.column}`, { rows: nRows, refs: nRefs });
    }

    // 2. Plan (and in dry run, test-convert) each distinct file.
    const files: FilePlan[] = [];
    let done = 0;
    for (const rel of [...rels].sort()) {
      const full = path.resolve(path.dirname(uploadsRoot), rel);
      const key = s3KeyFor(rel);
      const plan: FilePlan = { rel, key, url: s3UrlFor(key, bucket, region), exists: false, converted: false, bytesBefore: 0, bytesAfter: 0 };
      if (!full.startsWith(uploadsRoot + path.sep) || !fs.existsSync(full)) {
        plan.error = 'file not found on server';
        files.push(plan);
        continue;
      }
      plan.exists = true;
      try {
        const buf = await fs.promises.readFile(full);
        plan.bytesBefore = buf.length;
        const c = await convert(buf, path.extname(rel).toLowerCase(), opts);
        plan.bytesAfter = c.body.length;
        plan.converted = c.converted;
        plan.width = c.width;
        plan.height = c.height;
        plan.capped = (c as any).capped;
        if (opts.apply) {
          await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: c.body, ContentType: c.contentType, CacheControl: 'public, max-age=31536000, immutable' }));
          await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key })); // confirm it is there before any row points at it
        }
      } catch (e) {
        plan.error = (e as Error).message;
      }
      files.push(plan);
      if (++done % 200 === 0) console.log(`  ...${done}/${rels.size} files`);
    }

    // 3. Row changes (only to files that are ready).
    const map = new Map<string, string>();
    const ready = new Map(files.filter((f) => !f.error).map((f) => [f.rel, f.url]));
    const changes: RowChange[] = [];
    for (const r of refs) {
      const values: string[] = r.col.array ? r.value as string[] : [r.value as string];
      for (const v of values) {
        const rel = toLocalRelPath(v);
        if (rel && ready.has(rel)) map.set(v, ready.get(rel)!);
      }
      if (r.col.array) {
        const next = remapArray(r.value as string[], map);
        if (next) changes.push({ table: r.col.table, column: r.col.column, id: r.id, old: r.value, new: next });
      } else if (map.has(r.value as string)) {
        changes.push({ table: r.col.table, column: r.col.column, id: r.id, old: r.value, new: map.get(r.value as string)! });
      }
    }

    // 4. Report.
    console.log('References to server-disk files (QR codes excluded):');
    for (const col of PHOTO_COLUMNS) {
      const c = perColumn.get(`${col.table}.${col.column}`)!;
      const ch = changes.filter((x) => x.table === col.table && x.column === col.column).length;
      if (c.rows) console.log(`  ${col.label.padEnd(22)} ${`${col.table}.${col.column}`.padEnd(36)} rows ${String(c.rows).padStart(5)}  -> will update ${ch}`);
    }
    const ok = files.filter((f) => !f.error);
    const before = ok.reduce((s, f) => s + f.bytesBefore, 0), after = ok.reduce((s, f) => s + f.bytesAfter, 0);
    console.log(`\nFiles: ${files.length} distinct, ${ok.length} ready (${ok.filter((f) => f.converted).length} images -> WebP, ${ok.filter((f) => !f.converted).length} copied as-is)`);
    console.log(`Size: ${mb(before)} -> ${mb(after)} (${before ? Math.round((1 - after / before) * 100) : 0}% smaller); average ${kb(before / (ok.length || 1))} -> ${kb(after / (ok.length || 1))}`);
    const capped = ok.filter((f) => f.capped).length;
    console.log(`Pixel size kept for ${ok.filter((f) => f.converted).length - capped} image(s); ${capped} larger than 2000px scaled down to 2000px (same limit as new uploads)`);
    const biggest = [...ok].sort((a, b) => b.bytesBefore - a.bytesBefore).slice(0, 5);
    console.log('Largest files:');
    biggest.forEach((f) => console.log(`  ${f.rel}  ${kb(f.bytesBefore)} -> ${kb(f.bytesAfter)}  ${f.width ?? '?'}x${f.height ?? '?'}`));
    const bad = files.filter((f) => f.error);
    if (bad.length) {
      console.log(`\nNOT moved (${bad.length}); their rows keep the old address:`);
      bad.slice(0, 20).forEach((f) => console.log(`  ${f.rel}: ${f.error}`));
      if (bad.length > 20) console.log(`  ... and ${bad.length - 20} more`);
    }
    console.log(`\nRow updates planned: ${changes.length}`);

    if (!opts.apply) {
      console.log('\nDry run: nothing uploaded, nothing written. Re-run with --apply to move.');
      return;
    }

    // 5. Backup, then update rows (one transaction; each row only if unchanged since read).
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const file = path.resolve(`move-uploads-${stamp}.json`);
    const backup: Backup = { version: 1, createdAt: new Date().toISOString(), database: describeDb(), options: { quality: opts.quality, lossless: opts.lossless }, files, rows: changes, status: 'pending' };
    fs.writeFileSync(file, JSON.stringify(backup, null, 1));
    console.log(`\nBackup written: ${file}`);
    let updated = 0, skipped = 0;
    await prisma.$transaction(async (tx) => {
      for (const c of changes) {
        const n = Array.isArray(c.old)
          ? await tx.$executeRawUnsafe(`UPDATE "${c.table}" SET "${c.column}" = $1::text[] WHERE id = $2 AND "${c.column}" = $3::text[]`, c.new, c.id, c.old)
          : await tx.$executeRawUnsafe(`UPDATE "${c.table}" SET "${c.column}" = $1 WHERE id = $2 AND "${c.column}" = $3`, c.new, c.id, c.old);
        if (n === 1) updated++;
        else skipped++;
      }
    }, { timeout: 600_000, maxWait: 10_000 });
    backup.status = 'applied';
    fs.writeFileSync(file, JSON.stringify(backup, null, 1));
    console.log(`Updated ${updated} row(s)${skipped ? `, skipped ${skipped} edited since planning` : ''}.`);
    console.log(`Undo with: npx ts-node scripts/move-uploads-to-s3.ts --revert ${file} --apply`);
  } finally {
    await prisma.$disconnect();
  }
}

async function revert(prisma: PrismaClient, file: string, apply: boolean) {
  const backup: Backup = JSON.parse(fs.readFileSync(file, 'utf8'));
  console.log(`Revert ${file} (${apply ? 'APPLY' : 'dry run'}); ${backup.rows.length} row(s) in backup`);
  let n = 0, skipped = 0;
  const run = async (db: any) => {
    for (const c of backup.rows) {
      const isArr = Array.isArray(c.old);
      const where = isArr ? `"${c.column}" = $3::text[]` : `"${c.column}" = $3`;
      if (!apply) {
        const [r] = await db.$queryRawUnsafe(`SELECT count(*)::int AS n FROM "${c.table}" WHERE id = $1 AND ${where.replace('$3', '$2')}`, c.id, c.new);
        r.n === 1 ? n++ : skipped++;
        continue;
      }
      const k = await db.$executeRawUnsafe(`UPDATE "${c.table}" SET "${c.column}" = $1${isArr ? '::text[]' : ''} WHERE id = $2 AND ${where}`, c.old, c.id, c.new);
      k === 1 ? n++ : skipped++;
    }
  };
  if (apply) await prisma.$transaction((tx) => run(tx), { timeout: 600_000, maxWait: 10_000 });
  else await run(prisma);
  console.log(`${apply ? 'Restored' : 'Would restore'} ${n} row(s); ${skipped} changed since the move (left alone). Files in S3 are kept.`);
  if (apply) {
    backup.status = 'reverted';
    fs.writeFileSync(file, JSON.stringify(backup, null, 1));
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
