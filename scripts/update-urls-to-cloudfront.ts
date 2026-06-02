import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const S3_DOMAIN = 'probodyline-uploads.s3.amazonaws.com';
const S3_URL_REGEX = new RegExp(`https?://${S3_DOMAIN}`, 'g');
const CLOUDFRONT_DOMAIN = 'd3ts7f6tq8vpfi.cloudfront.net';

async function updateUrls() {
  const isDryRun = process.argv.includes('--dry-run');
  console.log(`Starting CloudFront URL migration... ${isDryRun ? '(DRY RUN)' : ''}`);

  const cloudfrontUrl = process.env.CLOUDFRONT_URL?.replace(/\/$/, '') || `https://${CLOUDFRONT_DOMAIN}`;

  const products = await prisma.product.findMany();
  let updatedCount = 0;

  for (const product of products) {
    let updated = false;
    const dataToUpdate: any = {};

    const replaceUrl = (url: string | null | undefined): string | null => {
      if (!url) return null;
      // Backward compatibility: skip if already CloudFront
      if (url.includes(CLOUDFRONT_DOMAIN)) return url;
      // Optional: Replace regional S3 urls too if they exist
      if (url.includes('.s3.') && url.includes('amazonaws.com')) {
         const urlObj = new URL(url);
         return `${cloudfrontUrl}${urlObj.pathname}`;
      }
      return url;
    };

    const replaceArrayUrls = (urls: string[] | null | undefined): string[] | undefined => {
      if (!urls || !Array.isArray(urls)) return undefined;
      const newUrls = urls.map(u => replaceUrl(u) || u);
      if (JSON.stringify(newUrls) !== JSON.stringify(urls)) return newUrls;
      return undefined;
    };

    // Update single string fields
    const singleFields = ['image', 'thumbnail', 'cartonLabel', 'machineArtwork', 'qrCode'] as const;
    for (const field of singleFields) {
      const currentVal = product[field];
      if (typeof currentVal === 'string') {
        const newVal = replaceUrl(currentVal);
        if (newVal !== currentVal) {
          dataToUpdate[field] = newVal;
          updated = true;
        }
      }
    }

    // Update array fields
    const arrayFields = ['images', 'mrpStickers', 'customDeclarations', 'brochure'] as const;
    for (const field of arrayFields) {
      const currentVal = product[field];
      if (Array.isArray(currentVal)) {
        const newVal = replaceArrayUrls(currentVal);
        if (newVal) {
          dataToUpdate[field] = newVal;
          updated = true;
        }
      }
    }

    if (updated) {
      if (!isDryRun) {
        await prisma.product.update({
          where: { id: product.id },
          data: dataToUpdate,
        });
      }
      updatedCount++;
      console.log(`${isDryRun ? '[DRY RUN] Would update' : 'Updated'} product: ${product.modelNumber}`);
    }
  }

  console.log(`\nMigration complete. ${isDryRun ? 'Would update' : 'Updated'} ${updatedCount} products.`);
}

updateUrls()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
